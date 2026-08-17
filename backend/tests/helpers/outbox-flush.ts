import { markOutboxProcessed } from '../../src/workers/job-router'
import { registerJobHandlers } from '../../src/workers/register-handlers'
import type { TestInfrastructure } from './test-infrastructure'

const activeFlushes = new WeakMap<TestInfrastructure, Promise<number>>()

/**
 * Synchronously drain and process pending outbox events in tests.
 *
 * E2E tests exercise the real HTTP pipeline but do not run a BullMQ worker —
 * there is no queue infrastructure to dispatch to. This calls the same
 * handlers the worker would (via the same `registerJobHandlers` registry), so
 * a test observing "was the invitation email sent" is exercising the real
 * handler logic, not a stand-in for it. It only replaces the transport
 * between commit and handler (BullMQ) with a direct call, exactly the way the
 * outbox pattern is meant to tolerate.
 */
async function drainOutbox(infrastructure: TestInfrastructure): Promise<number> {
  const router = registerJobHandlers(infrastructure)
  let processed = 0
  for (;;) {
    const pending = await infrastructure.transactions.withPlatformAccess(
      (tx) =>
        tx.$queryRaw<
          {
            id: string
            event_type: string
            organization_id: string | null
            request_id: string | null
            payload: unknown
          }[]
        >`
          select id, event_type, organization_id, request_id, payload
          from outbox_event
          where state = 'PENDING'
          order by created_at asc
          limit 500
        `,
      { purpose: 'Synchronously claim outbox obligations in the test transport.' },
    )
    if (pending.length === 0) break

    for (const event of pending) {
      const handler = router.handlerFor(event.event_type)
      if (handler === undefined) {
        throw new Error(
          `No handler registered for outbox event type "${event.event_type}" in tests.`,
        )
      }

      await handler({
        infrastructure,
        outboxEventId: event.id,
        eventType: event.event_type,
        organizationId: event.organization_id,
        requestId: event.request_id,
        payload: (event.payload ?? {}) as Record<string, unknown>,
        attempt: 1,
      })

      await markOutboxProcessed(infrastructure, event.id)
      processed += 1
      if (processed > 10_000) {
        throw new Error('Outbox test flush exceeded 10,000 events; probable event cycle.')
      }
    }
  }

  return processed
}

/**
 * Coalesce concurrent drains for the same infrastructure graph.
 *
 * Authentication helpers are deliberately used under contention tests. Several
 * sign-ups can therefore notice pending mail at the same time. Production has
 * BullMQ's unique job identity between the outbox and the handler; this mutex
 * gives the synchronous test transport the same single-consumer property.
 */
export function flushOutbox(infrastructure: TestInfrastructure): Promise<number> {
  const active = activeFlushes.get(infrastructure)
  if (active !== undefined) return active

  const flush = drainOutbox(infrastructure).finally(() => {
    if (activeFlushes.get(infrastructure) === flush) activeFlushes.delete(infrastructure)
  })
  activeFlushes.set(infrastructure, flush)
  return flush
}
