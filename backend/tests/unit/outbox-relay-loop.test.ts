import { afterEach, describe, expect, test } from 'bun:test'
import type { AppConfig } from '../../src/shared/config/config.schema'
import { createLogger } from '../../src/shared/logging'
import type { DispatchOutcome, OutboxDispatcher } from '../../src/shared/outbox/outbox-dispatcher'
import type { OutboxListener } from '../../src/shared/outbox/outbox-listener'
import { createOutboxRelay } from '../../src/shared/outbox/outbox-relay'

/**
 * Relay loop mechanics, with the dispatcher and listener faked.
 *
 * The integration suite (tests/queue/outbox-relay.test.ts) proves the
 * LISTEN/NOTIFY path end to end against real PostgreSQL. What only a fake can
 * prove deterministically is the loop's own decision table: when it keeps
 * draining, when it sleeps, how long it sleeps, and that a notification
 * landing mid-drain is folded rather than lost.
 */

interface FakeDispatcherOptions {
  /** Results per dispatchBatch() call; the last entry repeats when exhausted. */
  readonly script: readonly DispatchOutcome[]
  readonly nextAvailableAt?: () => Date | null
  /** Optional async gate consulted before each call's result is returned. */
  readonly gate?: (call: number) => Promise<void>
}

function fakeDispatcher(options: FakeDispatcherOptions): OutboxDispatcher & { calls: number } {
  let calls = 0
  return {
    calls: 0,
    async dispatchBatch(): Promise<DispatchOutcome> {
      calls += 1
      this.calls = calls
      if (options.gate !== undefined) await options.gate(calls)
      const index = Math.min(calls - 1, options.script.length - 1)
      return options.script[index] as DispatchOutcome
    },
    async reconcileStale(): Promise<number> {
      return 0
    },
    async oldestPendingAgeSeconds(): Promise<number> {
      return 0
    },
    async nextPendingAvailableAt(): Promise<Date | null> {
      return options.nextAvailableAt ? options.nextAvailableAt() : null
    },
  }
}

interface FakeListener extends OutboxListener {
  /** Deliver a notification as pg would. */
  notify(payload: string): void
  /** Deliver a reconnect event. */
  reconnect(): void
}

function fakeListener(): FakeListener {
  let notificationHandler: ((payload: string) => void) | undefined
  let connectedHandler: (() => void) | undefined
  return {
    async start(): Promise<void> {},
    onNotification(handler): void {
      notificationHandler = handler
    },
    onConnected(handler): void {
      connectedHandler = handler
    },
    async stop(): Promise<void> {},
    notify(payload: string): void {
      notificationHandler?.(payload)
    },
    reconnect(): void {
      connectedHandler?.()
    },
  }
}

const relayConfig = {
  worker: {
    outbox: {
      batchSize: 2,
      pollIntervalMs: 300_000,
      staleEnqueuedAfterMs: 300_000,
      maxAttempts: 10,
    },
  },
} as unknown as AppConfig

const logger = createLogger({
  app: { environment: 'test', serviceName: 'test', processRole: 'worker', version: '0' },
  observability: { logLevel: 'fatal', logPretty: false },
} as unknown as AppConfig)

const settle = () => new Promise((resolve) => setTimeout(resolve, 10))

const relays: Array<{ stop(): Promise<void> }> = []

afterEach(async () => {
  await Promise.all(relays.splice(0).map((relay) => relay.stop()))
})

describe('outbox relay loop mechanics', () => {
  test('drains until a batch comes back partial, then sleeps', async () => {
    const dispatcher = fakeDispatcher({
      // Full batch, full batch, then partial: exactly three dispatch calls.
      script: [
        { claimed: 2, published: 2 },
        { claimed: 2, published: 2 },
        { claimed: 1, published: 1 },
      ],
    })
    const listener = fakeListener()
    const relay = createOutboxRelay({ dispatcher, listener, config: relayConfig, logger })
    relays.push(relay)

    await relay.start()
    await settle()

    expect(dispatcher.calls).toBe(3)
  })

  test('an empty first batch costs exactly one dispatch call', async () => {
    const dispatcher = fakeDispatcher({ script: [{ claimed: 0, published: 0 }] })
    const listener = fakeListener()
    const relay = createOutboxRelay({ dispatcher, listener, config: relayConfig, logger })
    relays.push(relay)

    await relay.start()
    await settle()

    expect(dispatcher.calls).toBe(1)
  })

  test('a notification wakes the relay from its fallback sleep', async () => {
    const dispatcher = fakeDispatcher({ script: [{ claimed: 0, published: 0 }] })
    const listener = fakeListener()
    const relay = createOutboxRelay({ dispatcher, listener, config: relayConfig, logger })
    relays.push(relay)

    await relay.start()
    await settle()
    expect(dispatcher.calls).toBe(1)

    listener.notify('{"n":1}')
    await settle()
    expect(dispatcher.calls).toBe(2)
  })

  test('a notification landing mid-drain is folded, not lost', async () => {
    let releaseFirstDispatch!: () => void
    const firstDispatchGated = new Promise<void>((resolve) => {
      releaseFirstDispatch = resolve
    })
    const dispatcher = fakeDispatcher({
      script: [{ claimed: 0, published: 0 }],
      // Park only the first dispatch, so the notify arrives while a drain runs.
      gate: (call) => (call === 1 ? firstDispatchGated : Promise.resolve()),
    })
    const listener = fakeListener()
    const relay = createOutboxRelay({ dispatcher, listener, config: relayConfig, logger })
    relays.push(relay)

    await relay.start()
    await settle()

    // Notification arrives while dispatch #1 is still in flight: no sleeper
    // exists, so it must set the pending flag instead of being dropped.
    listener.notify('{"n":1}')
    releaseFirstDispatch()
    await settle()

    // The folded wake-up runs one more dispatch before sleeping again.
    expect(dispatcher.calls).toBe(2)
  })

  test('sleep is capped at the next delayed available_at', async () => {
    let probes = 0
    const inOneSecond = () => new Date(Date.now() + 1_000)
    const dispatcher = fakeDispatcher({
      script: [{ claimed: 0, published: 0 }],
      nextAvailableAt: () => {
        probes += 1
        return inOneSecond()
      },
    })
    const listener = fakeListener()
    const relay = createOutboxRelay({ dispatcher, listener, config: relayConfig, logger })
    relays.push(relay)

    await relay.start()
    await settle()

    // pollIntervalMs is 300s; the 1s delayed event must fire a wake (and
    // therefore another dispatch + probe) far sooner.
    await new Promise((resolve) => setTimeout(resolve, 1_600))
    expect(probes).toBeGreaterThanOrEqual(2)
    expect(dispatcher.calls).toBeGreaterThanOrEqual(2)
  })

  test('stop halts the loop without another dispatch', async () => {
    const dispatcher = fakeDispatcher({ script: [{ claimed: 0, published: 0 }] })
    const listener = fakeListener()
    const relay = createOutboxRelay({ dispatcher, listener, config: relayConfig, logger })

    await relay.start()
    await settle()
    const callsAtStop = dispatcher.calls

    await relay.stop()
    await settle()

    expect(dispatcher.calls).toBe(callsAtStop)
  })
})
