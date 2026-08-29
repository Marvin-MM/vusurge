import type { PrismaTransactionClient } from '../database'
import { newId } from '../ids'
import { getRequestContext } from '../logging'
import { currentTraceContext } from '../observability'
import type { QueueName } from '../queue/queue-names'
import { type DomainEventType, expectedQueueFor } from './event-catalog'
import { OUTBOX_NOTIFY_CHANNEL, outboxNotifyPayload } from './outbox-channel'

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
  async function insertEvent(
    tx: PrismaTransactionClient,
    event: OutboxEventInput,
  ): Promise<string> {
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

  /** Wake the relay inside the caller's transaction. */
  async function notify(tx: PrismaTransactionClient, insertedCount: number): Promise<void> {
    // pg_notify is transactional: the notification is emitted only if the
    // surrounding transaction commits, so a rolled-back business change can
    // never trigger a pointless dispatch sweep. The row is the source of
    // truth; the notification is only a wake-up hint.
    await tx.$executeRaw`select pg_notify(${OUTBOX_NOTIFY_CHANNEL}, ${outboxNotifyPayload(insertedCount)})`
  }

  return {
    async write(tx, event): Promise<string> {
      const id = await insertEvent(tx, event)
      await notify(tx, 1)
      return id
    },

    async writeMany(tx, events): Promise<string[]> {
      const ids: string[] = []
      for (const event of events) {
        ids.push(await insertEvent(tx, event))
      }
      // Exactly one notification per transaction, not one per event: the
      // relay drains whatever is pending, so a burst committed together is a
      // single wake-up.
      if (events.length > 0) {
        await notify(tx, events.length)
      }
      return ids
    },
  }
}
