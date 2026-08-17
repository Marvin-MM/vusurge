import type { PrismaTransactionClient } from '../database'
import { newId } from '../ids'
import { getRequestContext } from '../logging'
import { currentTraceContext } from '../observability'
import type { QueueName } from '../queue/queue-names'
import { type DomainEventType, expectedQueueFor } from './event-catalog'

/**
 * Writing transactional outbox events.
 *
 * The rule this exists to enforce: a durable business change and the async
 * effects it owes are committed in ONE PostgreSQL transaction. The alternative
 * — commit, then enqueue — loses the effect whenever the process dies in
 * between, and enqueue-then-commit fires effects for changes that rolled back.
 *
 * Every function here takes a transaction client and must be called inside the
 * same transaction as the change it accompanies. It never talks to Redis.
 */

export interface OutboxEventInput {
  /** Domain event name, e.g. 'challenge.deadline_extended'. */
  readonly eventType: DomainEventType
  /** Logical queue that will process this event. */
  readonly queueName: QueueName
  readonly aggregateType: string
  readonly aggregateId?: string
  readonly organizationId?: string
  /**
   * Identifiers and safe scalars only. The handler re-reads authoritative state
   * from PostgreSQL: a payload that carries a stale copy of business state will
   * eventually act on it.
   */
  readonly payload: Record<string, unknown>
  /**
   * Stable key that makes this event unique. Two attempts at the same logical
   * effect produce the same key, so the unique index rejects the duplicate.
   */
  readonly dedupeKey: string
  /** Delay before the event becomes eligible for dispatch. */
  readonly availableInMs?: number
}

export interface OutboxWriter {
  write(tx: PrismaTransactionClient, event: OutboxEventInput): Promise<string>
  writeMany(tx: PrismaTransactionClient, events: readonly OutboxEventInput[]): Promise<string[]>
}

export function createOutboxWriter(): OutboxWriter {
  async function write(tx: PrismaTransactionClient, event: OutboxEventInput): Promise<string> {
    const expectedQueue = expectedQueueFor(event.eventType)
    if (event.queueName !== expectedQueue) {
      throw new Error(
        `Domain event "${event.eventType}" must use queue "${expectedQueue}", not "${event.queueName}".`,
      )
    }
    const context = getRequestContext()
    const traceContext = currentTraceContext()
    const id = newId()

    const availableAt =
      event.availableInMs === undefined ? new Date() : new Date(Date.now() + event.availableInMs)

    const data = {
      id,
      eventType: event.eventType,
      queueName: event.queueName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId ?? null,
      organizationId: event.organizationId ?? null,
      payload: event.payload as never,
      dedupeKey: event.dedupeKey,
      availableAt,
      requestId: context?.requestId ?? null,
      traceParent: traceContext.traceParent ?? null,
    }

    // Upsert returns the actual durable row. The previous createMany path
    // returned the newly generated id even when the insert was skipped, which
    // could hand callers an identifier that did not exist.
    const durable = await tx.outboxEvent.upsert({
      where: { dedupeKey: event.dedupeKey },
      create: data,
      update: {},
      select: { id: true },
    })
    return durable.id
  }

  return {
    write,
    async writeMany(tx, events): Promise<string[]> {
      const ids: string[] = []
      for (const event of events) {
        ids.push(await write(tx, event))
      }
      return ids
    },
  }
}
