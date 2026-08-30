import { Client } from 'pg'
import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'
import { OUTBOX_NOTIFY_CHANNEL } from './outbox-channel'

/**
 * Dedicated PostgreSQL session for LISTEN/NOTIFY.
 *
 * LISTEN registration is session state, so this must be its own connection —
 * never a pooled one. That is also why the URL must bypass any transaction-mode
 * pooler (Neon's pooled endpoint, PgBouncer): a pooler forwards statements to
 * arbitrary server sessions, so a LISTEN issued through it can register on one
 * session while notifications arrive on another. DATABASE_LISTENER_URL exists
 * for exactly that deployment shape; when it is unset the runtime DATABASE_URL
 * is assumed to already be a direct connection.
 *
 * Reconnects with capped exponential backoff and reports every successful
 * (re)connection through `onConnected`, so the relay can sweep for events that
 * committed while the listener was down — notifications are not queued for
 * absent listeners.
 */

export interface OutboxListener {
  /**
   * Connect and issue LISTEN. Resolves once the registration is confirmed
   * (or fails fast if the database is unreachable at startup).
   */
  start(): Promise<void>
  /** Invoke `onNotification` for every payload on the channel. */
  onNotification(handler: (payload: string) => void): void
  /**
   * Invoke `onConnected` once at startup and again after every reconnect.
   * Listeners miss notifications sent while disconnected; a reconnect is the
   * signal to sweep.
   */
  onConnected(handler: () => void): void
  stop(): Promise<void>
}

/** How long the startup delivery self-test waits for its probe notification. */
const SELF_TEST_TIMEOUT_MS = 10_000

/**
 * Probe payload for the delivery self-test. Distinct from writer payloads so
 * the relay can distinguish a self-test from real work; either way, a
 * wake-up on the channel is a wake-up.
 */
const SELF_TEST_PAYLOAD = JSON.stringify({ selfTest: true })

export function createOutboxListener(config: AppConfig, logger: Logger): OutboxListener {
  const connectionString = config.database.listenerUrl ?? config.database.url
  const channel = OUTBOX_NOTIFY_CHANNEL
  const metrics = appMetrics()

  let client: Client | undefined
  let stopped = false
  let restartTimer: ReturnType<typeof setTimeout> | undefined
  let notificationHandler: ((payload: string) => void) | undefined
  let connectedHandler: (() => void) | undefined
  let probeResolver: ((received: boolean) => void) | undefined

  /**
   * Delivery self-test: notify the channel from this same connection and
   * confirm the notification comes back. A LISTEN that registered on the
   * wrong server session (a pooled URL slipped through) still "succeeds" as
   * a statement — the only way to detect it is to round-trip a real
   * notification. Run once per connection at startup; a failure is logged
   * loudly with the fix, because every wake-up would otherwise silently
   * degrade to fallback-only polling.
   */
  async function verifyDelivery(connection: Client): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (received: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        probeResolver = undefined
        resolve(received)
      }

      // The 'notification' handler consults this before the typed handler,
      // so the probe is observed even though onNotification is wired later.
      probeResolver = finish

      const timeout = setTimeout(() => finish(false), SELF_TEST_TIMEOUT_MS)
      timeout.unref?.()

      connection
        .query('select pg_notify($1, $2)', [channel, SELF_TEST_PAYLOAD])
        .catch(() => finish(false))
    })
  }

  async function connect(attempt: number): Promise<void> {
    if (stopped) return

    const connection = new Client({
      connectionString,
      application_name: `${config.app.serviceName}-outbox-listener`,
    })

    // pg delivers LISTEN payloads as 'notification' events. Registration must
    // be re-issued after every reconnect: it does not survive a dropped
    // session.
    connection.on('notification', (message) => {
      if (message.channel !== channel) return
      // The self-test probe settles first, so it never reaches the relay as
      // a (harmless but noisy) wake-up.
      const probe = probeResolver
      if (probe !== undefined && message.payload === SELF_TEST_PAYLOAD) {
        probe(true)
        return
      }
      notificationHandler?.(message.payload ?? '')
    })

    connection.on('error', (error) => {
      // 'end' does not fire for every transport-level failure, so an error on
      // the current connection is treated as a drop: clear it and reconnect.
      // Errors on a connection that is no longer current (already replaced or
      // torn down) are ignored.
      if (stopped || client !== connection) return
      logger.warn(
        { err: describeError(error), channel },
        'Outbox listener connection error; reconnecting',
      )
      client = undefined
      scheduleRestart(attempt + 1)
    })

    connection.on('end', () => {
      // A clean end (server restart, network idle timeout) still needs a
      // reconnect: the relay must not silently stop receiving wake-ups.
      if (stopped || client !== connection) return
      logger.warn({ channel }, 'Outbox listener connection ended; reconnecting')
      client = undefined
      scheduleRestart(attempt + 1)
    })

    try {
      await connection.connect()
      await connection.query(`listen ${channel}`)
    } catch (error) {
      logger.error(
        { err: describeError(error), attempt },
        'Outbox listener failed to connect; retrying',
      )
      await teardown(connection)
      scheduleRestart(attempt + 1)
      return
    }

    client = connection
    logger.info({ channel }, 'Outbox listener connected and listening')

    // Round-trip a probe notification once at startup. A failure means every
    // real notification would be lost too, so say so plainly — with the most
    // likely cause — instead of letting dispatch silently degrade to the
    // fallback interval.
    const delivered = await verifyDelivery(connection)
    metrics.outboxNotifySelfTest.add(1, { result: delivered ? 'passed' : 'failed' })
    if (!delivered) {
      logger.error(
        { channel, hasListenerUrl: config.database.listenerUrl !== undefined },
        'Outbox listener self-test FAILED: pg_notify on the channel did not arrive on this ' +
          'connection. Dispatch will degrade to fallback-only polling. The listener URL almost ' +
          'certainly goes through a transaction-mode pooler (Neon pooled endpoint, PgBouncer), ' +
          'where LISTEN registration cannot survive. Set DATABASE_LISTENER_URL to a DIRECT ' +
          '(non-pooled) endpoint.',
      )
    } else {
      logger.info({ channel }, 'Outbox listener self-test passed: notifications round-trip')
    }

    // Startup, and every reconnect: notifications sent while absent were
    // dropped, so the relay sweeps as soon as it hears from us.
    connectedHandler?.()
  }

  async function teardown(connection: Client): Promise<void> {
    try {
      await connection.end()
    } catch {
      // The connection was already dead; nothing to clean up.
    }
    if (client === connection) client = undefined
  }

  function scheduleRestart(attempt: number): void {
    if (stopped || restartTimer !== undefined) return
    const delayMs = Math.min(200 * 2 ** Math.min(attempt, 5), 5_000)
    restartTimer = setTimeout(() => {
      restartTimer = undefined
      void connect(attempt)
    }, delayMs)
    restartTimer.unref?.()
  }

  return {
    async start(): Promise<void> {
      await connect(0)
    },

    onNotification(handler): void {
      notificationHandler = handler
    },

    onConnected(handler): void {
      connectedHandler = handler
    },

    async stop(): Promise<void> {
      stopped = true
      if (restartTimer !== undefined) {
        clearTimeout(restartTimer)
        restartTimer = undefined
      }
      if (client !== undefined) {
        await teardown(client)
      }
    },
  }
}
