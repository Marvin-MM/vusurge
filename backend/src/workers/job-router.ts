import type { Infrastructure } from '../container'
import { describeError } from '../shared/logging'

/**
 * Routing from outbox events to their handlers.
 *
 * Every job that reaches a worker originated as a committed outbox row, so the
 * handler's contract is: re-read authoritative state from PostgreSQL, perform
 * the effect, and mark the outbox row processed. Handlers must be idempotent —
 * a job can legitimately be delivered more than once. The dispatcher first
 * leases the row as ENQUEUED and then publishes; its reconciler re-delivers a
 * lease whose job was lost or never reached Redis.
 */

export interface JobContext {
  readonly infrastructure: Infrastructure
  readonly outboxEventId: string
  readonly eventType: string
  readonly organizationId: string | null
  readonly requestId: string | null
  readonly payload: Record<string, unknown>
  readonly attempt: number
}

export type JobHandler = (context: JobContext) => Promise<void>

export interface JobRouter {
  register(eventType: string, handler: JobHandler): void
  /** Register the same handler for several event types. */
  registerAll(eventTypes: readonly string[], handler: JobHandler): void
  handlerFor(eventType: string): JobHandler | undefined
  registeredEventTypes(): readonly string[]
}

export function createJobRouter(): JobRouter {
  const handlers = new Map<string, JobHandler>()

  return {
    register(eventType, handler): void {
      if (handlers.has(eventType)) {
        // A duplicate registration means two modules believe they own the same
        // effect, which would make behaviour depend on wiring order.
        throw new Error(`A handler is already registered for event type "${eventType}".`)
      }
      handlers.set(eventType, handler)
    },

    registerAll(eventTypes, handler): void {
      for (const eventType of eventTypes) {
        this.register(eventType, handler)
      }
    },

    handlerFor(eventType): JobHandler | undefined {
      return handlers.get(eventType)
    },

    registeredEventTypes(): readonly string[] {
      return [...handlers.keys()].sort()
    },
  }
}

/**
 * Mark an outbox event processed.
 *
 * Called by the worker after a handler succeeds. Idempotent: a redelivered job
 * whose row is already PROCESSED simply updates nothing.
 */
export async function markOutboxProcessed(
  infrastructure: Infrastructure,
  outboxEventId: string,
): Promise<void> {
  await infrastructure.transactions.withPlatformAccess(
    (tx) => tx.$executeRaw`
      update outbox_event
      set state = 'PROCESSED',
          processed_at = now(),
          updated_at = now()
      where id = ${outboxEventId}::uuid
        and processed_at is null
    `,
    { purpose: `Acknowledge processed outbox obligation ${outboxEventId}.` },
  )
}

/** Record a handler failure against the outbox row for operator visibility. */
export async function recordOutboxFailure(
  infrastructure: Infrastructure,
  outboxEventId: string,
  error: unknown,
  isFinalAttempt: boolean,
): Promise<void> {
  const message = (error instanceof Error ? error.message : 'Handler failed').slice(0, 1000)

  try {
    await infrastructure.transactions.withPlatformAccess(
      (tx) => tx.$executeRaw`
        update outbox_event
        set last_error = ${message},
            state = case when ${isFinalAttempt} then 'FAILED'::"OutboxState" else state end,
            updated_at = now()
        where id = ${outboxEventId}::uuid
          and state = 'ENQUEUED'
          and processed_at is null
      `,
      { purpose: `Record worker failure for outbox obligation ${outboxEventId}.` },
    )
  } catch (updateError) {
    infrastructure.logger.error(
      { err: describeError(updateError), outboxEventId },
      'Failed to record an outbox handler failure',
    )
  }
}
