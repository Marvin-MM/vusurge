import type { AppConfig } from '../config/config.schema'
import type { TenantTransactionRunner } from '../database'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'
import { isQueueName } from '../queue/queue-names'
import type { QueueRegistry } from '../queue/queue-registry'

/**
 * Outbox dispatcher and reconciler.
 *
 * Runs in the worker process. Claims committed outbox rows in bounded batches
 * and publishes them to BullMQ using the outbox row's own identifier as the job
 * ID, so redelivering the same row can never create a second job.
 *
 * Claiming uses `for update skip locked`, which lets several dispatcher
 * replicas share the backlog without blocking each other and without any two
 * of them claiming the same row.
 *
 * A claim changes the row to ENQUEUED in the same SQL statement that selects
 * it. Publishing happens after that transaction commits. A crash before queue
 * publication therefore leaves a leased ENQUEUED row that the stale-event
 * reconciler returns to PENDING; a crash after publication is harmless because
 * the outbox row id is also the BullMQ job id.
 */

interface ClaimedEvent {
  id: string
  event_type: string
  queue_name: string
  payload: unknown
  attempts: number
  organization_id: string | null
  request_id: string | null
  trace_parent: string | null
}

export interface OutboxDispatcher {
  /** Dispatch one batch. Returns how many events were published. */
  dispatchBatch(): Promise<number>
  /** Reclaim events stuck in ENQUEUED. Returns how many were reset. */
  reconcileStale(): Promise<number>
  /** Age in seconds of the oldest event still awaiting dispatch. */
  oldestPendingAgeSeconds(): Promise<number>
}

export function createOutboxDispatcher(
  transactions: TenantTransactionRunner,
  queues: QueueRegistry,
  config: AppConfig,
  logger: Logger,
): OutboxDispatcher {
  const metrics = appMetrics()
  const { batchSize, staleEnqueuedAfterMs, maxAttempts } = config.worker.outbox

  return {
    async dispatchBatch(): Promise<number> {
      // Claim and state transition are one SQL statement. Keeping the state
      // predicate on the UPDATE is important under READ COMMITTED: if another
      // dispatcher commits after this statement takes its snapshot, PostgreSQL
      // rechecks the updated tuple and this claim returns no duplicate row.
      // Publishing happens after commit, so Redis cannot hold a database lock.
      const claimed = await transactions.withPlatformAccess(
        async (tx) => {
          return tx.$queryRaw<ClaimedEvent[]>`
          with ranked as materialized (
            select id, available_at, created_at,
              row_number() over (
                partition by coalesce(organization_id::text, '__global__')
                order by available_at asc, created_at asc
              ) as tenant_rank
            from outbox_event
            where state = 'PENDING'
              and available_at <= now()
              and attempts < ${maxAttempts}
          ), candidates as materialized (
            select e.id
            from outbox_event e
            join ranked on ranked.id = e.id
            where e.state = 'PENDING'
              and e.available_at <= now()
              and e.attempts < ${maxAttempts}
            order by ranked.tenant_rank asc, e.available_at asc, e.created_at asc
            limit ${batchSize}
            for update of e skip locked
          )
          update outbox_event e
          set state = 'ENQUEUED',
              enqueued_at = now(),
              attempts = e.attempts + 1,
              updated_at = now()
          from candidates
          where e.id = candidates.id
            and e.state = 'PENDING'
            and e.available_at <= now()
            and e.attempts < ${maxAttempts}
          returning e.id, e.event_type, e.queue_name, e.payload, e.attempts,
                    e.organization_id, e.request_id, e.trace_parent
        `
        },
        { purpose: 'Claim the cross-tenant transactional-outbox dispatch batch.' },
      )

      if (claimed.length === 0) return 0

      let published = 0

      for (const event of claimed) {
        if (!isQueueName(event.queue_name)) {
          // An unroutable event must not be retried forever.
          await markFailed(event.id, `Unknown queue "${event.queue_name}"`)
          continue
        }

        try {
          await queues.enqueue(
            event.queue_name,
            event.event_type,
            {
              outboxEventId: event.id,
              eventType: event.event_type,
              organizationId: event.organization_id,
              requestId: event.request_id,
              traceParent: event.trace_parent,
              payload: event.payload,
            },
            // The outbox row id is the job id: BullMQ rejects a duplicate,
            // which is precisely the deduplication we want.
            { jobId: event.id },
          )
          published += 1
          metrics.outboxDispatched.add(1, { queue: event.queue_name })
        } catch (error) {
          // Redis is unavailable or refused the job. Return the row to PENDING
          // so the next sweep retries; the obligation is never lost.
          logger.warn(
            { err: describeError(error), outboxEventId: event.id, queue: event.queue_name },
            'Failed to publish outbox event; returning it to PENDING',
          )
          await returnToPending(event.id, error)
        }
      }

      return published
    },

    async reconcileStale(): Promise<number> {
      // An ENQUEUED row whose job never completed (worker crash, Redis flush)
      // is returned to PENDING so the effect is retried.
      const { result, exhausted } = await transactions.withPlatformAccess(
        async (tx) => {
          const result = await tx.$executeRaw`
            update outbox_event
            set state = 'PENDING',
                enqueued_at = null,
                available_at = now(),
                updated_at = now()
            where state = 'ENQUEUED'
              and enqueued_at < now() - (${staleEnqueuedAfterMs}::bigint * interval '1 millisecond')
              and attempts < ${maxAttempts}
          `

          // Rows that exhausted their attempts stop consuming dispatch capacity and
          // become visible as failures for operators.
          const exhausted = await tx.$executeRaw`
            update outbox_event
            set state = 'FAILED',
                updated_at = now(),
                last_error = coalesce(last_error, 'Exceeded maximum dispatch attempts')
            where state in ('PENDING', 'ENQUEUED')
              and attempts >= ${maxAttempts}
          `
          return { result, exhausted }
        },
        { purpose: 'Reconcile stale and exhausted transactional-outbox obligations.' },
      )

      if (result > 0) {
        metrics.outboxReconciled.add(result)
        logger.warn({ count: result }, 'Reclaimed stale outbox events')
      }

      if (exhausted > 0) {
        logger.error(
          { count: exhausted },
          'Outbox events exhausted their dispatch attempts and require operator attention',
        )
      }

      return result
    },

    async oldestPendingAgeSeconds(): Promise<number> {
      const rows = await transactions.withPlatformAccess(
        (tx) => tx.$queryRaw<{ age_seconds: number | null }[]>`
          select extract(epoch from (now() - min(created_at)))::double precision as age_seconds
          from outbox_event
          where state in ('PENDING', 'ENQUEUED')
        `,
        { purpose: 'Measure the cross-tenant transactional-outbox backlog age.' },
      )
      const age = rows[0]?.age_seconds ?? 0
      metrics.outboxOldestPendingAgeSeconds.record(age)
      return age
    },
  }

  async function returnToPending(id: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Dispatch failed'
    await transactions.withPlatformAccess(
      (tx) => tx.$executeRaw`
        update outbox_event
        set state = 'PENDING',
            enqueued_at = null,
            available_at = now() + interval '5 seconds',
            last_error = ${message},
            updated_at = now()
        where id = ${id}::uuid
          and state = 'ENQUEUED'
          and processed_at is null
      `,
      { purpose: `Return outbox event ${id} to the pending state after queue failure.` },
    )
  }

  async function markFailed(id: string, message: string): Promise<void> {
    await transactions.withPlatformAccess(
      (tx) => tx.$executeRaw`
        update outbox_event
        set state = 'FAILED',
            last_error = ${message},
            updated_at = now()
        where id = ${id}::uuid
          and state = 'ENQUEUED'
          and processed_at is null
      `,
      { purpose: `Quarantine unroutable outbox event ${id}.` },
    )
    logger.error({ outboxEventId: id, reason: message }, 'Outbox event marked FAILED')
  }
}
