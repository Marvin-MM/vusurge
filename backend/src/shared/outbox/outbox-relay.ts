import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'
import type { OutboxDispatcher } from './outbox-dispatcher'
import type { OutboxListener } from './outbox-listener'

/**
 * The event-driven outbox relay.
 *
 * Replaces the old fixed-interval poller. Wake-ups come from three sources:
 *
 *   notification   the writer's pg_notify fired — dispatch immediately
 *   listener gap   the LISTEN connection (re)connected; notifications sent
 *                  while it was down were dropped, so sweep once
 *   fallback timer OUTBOX_POLL_INTERVAL_MS, a safety net bounding the damage
 *                  of anything the two above can miss
 *
 * The relay runs a two-phase loop: drain until a batch comes back partial,
 * then sleep until the next wake-up. A notification that arrives mid-drain
 * sets a pending flag and is honoured as soon as the drain tail re-checks, so
 * an event committed while a sweep was in flight can never wait for the
 * fallback interval.
 *
 * Delayed events (available_at in the future) cannot be notified for at their
 * availability time, so the sleep is capped at the earliest future
 * available_at — the relay wakes up exactly when the next delayed row becomes
 * dispatchable.
 */

/** Upper bound on batches drained per wake-up; the fallback continues beyond. */
const MAX_ROUNDS_PER_WAKE = 100
/** Small buffer added to a delayed wake so clock skew cannot undershoot. */
const DELAYED_WAKE_BUFFER_MS = 250

export interface OutboxRelay {
  start(): Promise<void>
  stop(): Promise<void>
}

interface RelayDependencies {
  readonly dispatcher: OutboxDispatcher
  readonly listener: OutboxListener
  readonly config: AppConfig
  readonly logger: Logger
}

export function createOutboxRelay(deps: RelayDependencies): OutboxRelay {
  const { dispatcher, listener, config, logger } = deps
  const metrics = appMetrics()
  const { batchSize, pollIntervalMs } = config.worker.outbox

  let running = false
  let loop: Promise<void> | undefined

  // Sleep-phase state. JS is single-threaded and pg delivers notification
  // events synchronously, so a wake either lands while a sleeper exists (it
  // resolves the sleeper) or while none does (the flag is checked before the
  // next sleep is armed). Both orders are safe.
  let pendingWake = false
  let sleeperResolve: ((source: WakeSource) => void) | undefined
  let sleepTimer: ReturnType<typeof setTimeout> | undefined

  type WakeSource = 'notification' | 'fallback' | 'reconnect'

  function wake(source: WakeSource): void {
    if (!running) return
    metrics.outboxRelayWakes.add(1, { source })

    if (sleeperResolve !== undefined) {
      const resolve = sleeperResolve
      sleeperResolve = undefined
      if (sleepTimer !== undefined) {
        clearTimeout(sleepTimer)
        sleepTimer = undefined
      }
      resolve(source)
    } else {
      // A drain is running (or a wake already queued): fold into it.
      pendingWake = true
    }
  }

  /**
   * Sleep until a wake-up, but never longer than the fallback interval, and
   * never past the earliest future available_at (delayed events).
   */
  function sleepUntilWake(): Promise<WakeSource> {
    if (pendingWake) {
      pendingWake = false
      return Promise.resolve('notification')
    }

    return new Promise<WakeSource>((resolve) => {
      const arm = (ms: number) => {
        // A notification may have landed while the availability probe was in
        // flight (nothing was armed for it to resolve): honour it now.
        if (pendingWake) {
          pendingWake = false
          resolve('notification')
          return
        }
        sleeperResolve = resolve
        sleepTimer = setTimeout(() => {
          sleepTimer = undefined
          const settle = sleeperResolve
          sleeperResolve = undefined
          settle?.('fallback')
        }, ms)
      }

      dispatcher
        .nextPendingAvailableAt()
        .then((availableAt) => {
          if (!running) {
            resolve('fallback')
            return
          }
          let ms = pollIntervalMs
          if (availableAt !== null) {
            const until = availableAt.getTime() - Date.now() + DELAYED_WAKE_BUFFER_MS
            if (until > 0 && until < ms) ms = until
          }
          arm(ms)
        })
        .catch(() => {
          // The probe is an optimization; falling back to the plain interval
          // is always correct.
          if (!running) {
            resolve('fallback')
            return
          }
          arm(pollIntervalMs)
        })
    })
  }

  async function runLoop(initialSource: WakeSource): Promise<void> {
    let source = initialSource

    while (running) {
      // --- Drain phase ------------------------------------------------------
      try {
        let rounds = 0
        for (;;) {
          if (!running) return
          const outcome = await dispatcher.dispatchBatch()

          if (outcome.published > 0) {
            logger.debug({ published: outcome.published, source }, 'Dispatched outbox events')
          }

          rounds += 1
          // Keep draining only while batches come back full: a partial batch
          // means the table had nothing more dispatchable, and re-querying
          // would recreate the old poller's idle load.
          if (outcome.claimed < batchSize) break
          if (rounds >= MAX_ROUNDS_PER_WAKE) {
            logger.warn(
              { rounds, source },
              'Outbox relay drain hit its per-wake round cap; continuing on next wake-up',
            )
            break
          }
        }
      } catch (error) {
        logger.error({ err: describeError(error), source }, 'Outbox relay drain failed')
      }

      if (!running) return

      // --- Sleep phase ------------------------------------------------------
      source = await sleepUntilWake()
    }
  }

  return {
    async start(): Promise<void> {
      if (running) return
      running = true

      listener.onNotification(() => wake('notification'))
      listener.onConnected(() => wake('reconnect'))

      await listener.start()

      // An initial sweep: rows may have committed while this process was down
      // (rolling deploy), and notifications are not replayed.
      logger.info(
        { fallbackIntervalMs: pollIntervalMs, batchSize },
        'Outbox relay started (LISTEN/NOTIFY driven with fallback polling)',
      )
      loop = runLoop('reconnect')
    },

    async stop(): Promise<void> {
      if (!running) return
      running = false

      if (sleepTimer !== undefined) {
        clearTimeout(sleepTimer)
        sleepTimer = undefined
      }
      const resolve = sleeperResolve
      sleeperResolve = undefined
      resolve?.('fallback')

      await listener.stop()

      if (loop !== undefined) {
        // The loop exits at its next `running` check; the in-flight batch is
        // allowed to finish so no claim is abandoned mid-publish.
        await loop.catch(() => undefined)
        loop = undefined
      }
    },
  }
}
