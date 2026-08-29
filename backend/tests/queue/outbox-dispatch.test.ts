import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { newId } from '../../src/shared/ids'
import { createOutboxDispatcher, type OutboxDispatcher } from '../../src/shared/outbox'
import { QueueName } from '../../src/shared/queue'
import { recordOutboxFailure } from '../../src/workers/job-router'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'
import {
  clearRedis,
  createTestInfrastructure,
  type TestInfrastructure,
} from '../helpers/test-infrastructure'

/**
 * Transactional outbox behaviour, against real PostgreSQL and real BullMQ.
 *
 * The properties under test are the ones that make "commit the change and its
 * obligation together" actually safe (master prompt sections 20 and 41.5):
 * claims are exclusive, dispatch is deduplicated, a queue outage delays rather
 * than loses an effect, and a stuck row is recoverable.
 */

let infrastructure: TestInfrastructure
let sql: Client
let dispatcher: OutboxDispatcher

async function insertOutboxEvent(
  overrides: Partial<{
    id: string
    eventType: string
    queueName: string
    availableAt: string
    state: string
    dedupeKey: string | null
    attempts: number
    organizationId: string | null
    traceParent: string | null
  }> = {},
): Promise<string> {
  const id = overrides.id ?? newId()
  await sql.query(
    `insert into outbox_event
       (id, event_type, queue_name, aggregate_type, aggregate_id, organization_id,
        payload, state, available_at, dedupe_key, attempts, trace_parent, created_at, updated_at)
     values ($1, $2, $3, 'test', null, $8::uuid, '{"probe":true}'::jsonb,
             $4::"OutboxState", coalesce($5::timestamptz, now()), $6, $7, $9, now(), now())`,
    [
      id,
      overrides.eventType ?? 'test.event',
      overrides.queueName ?? QueueName.Email,
      overrides.state ?? 'PENDING',
      overrides.availableAt ?? null,
      overrides.dedupeKey ?? null,
      overrides.attempts ?? 0,
      overrides.organizationId ?? null,
      overrides.traceParent ?? null,
    ],
  )
  return id
}

beforeAll(async () => {
  infrastructure = await createTestInfrastructure()
  sql = await connectMigrationSql()
  dispatcher = createOutboxDispatcher(
    infrastructure.transactions,
    infrastructure.queues,
    infrastructure.config,
    infrastructure.logger,
  )
})

afterAll(async () => {
  await clearRedis(infrastructure)
  await infrastructure.dispose()
  await sql.end()
})

beforeEach(async () => {
  await resetDatabase(sql)
  await clearRedis(infrastructure)
})

describe('outbox dispatch', () => {
  test('publishes a pending event and marks it ENQUEUED', async () => {
    const traceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    const id = await insertOutboxEvent({ eventType: 'test.dispatch', traceParent })

    const outcome = await dispatcher.dispatchBatch()
    expect(outcome.claimed).toBe(1)
    expect(outcome.published).toBe(1)

    const { rows } = await sql.query<{ state: string; attempts: number; enqueued_at: Date | null }>(
      'select state, attempts, enqueued_at from outbox_event where id = $1',
      [id],
    )
    expect(rows[0]?.state).toBe('ENQUEUED')
    expect(rows[0]?.attempts).toBe(1)
    expect(rows[0]?.enqueued_at).not.toBeNull()

    // The BullMQ job id is the outbox row id, which is what makes a redelivery
    // of the same obligation collapse into one job.
    const job = await infrastructure.queues.get(QueueName.Email).getJob(id)
    expect(job).toBeDefined()
    expect(job?.data.outboxEventId).toBe(id)
    expect(job?.data.traceParent).toBe(traceParent)
  })

  test('does not dispatch an event before its available_at', async () => {
    await insertOutboxEvent({
      eventType: 'test.delayed',
      availableAt: new Date(Date.now() + 60_000).toISOString(),
    })

    expect((await dispatcher.dispatchBatch()).published).toBe(0)
  })

  test('reports the next future available_at for delayed events', async () => {
    const inFortySeconds = new Date(Date.now() + 40_000)
    await insertOutboxEvent({
      eventType: 'test.delayed-probe',
      availableAt: inFortySeconds.toISOString(),
    })
    await insertOutboxEvent({ eventType: 'test.ready' })

    const next = await dispatcher.nextPendingAvailableAt()
    expect(next).not.toBeNull()
    const nextMs = next?.getTime() ?? 0
    expect(nextMs).toBeGreaterThan(Date.now() + 30_000)
    expect(nextMs).toBeLessThan(Date.now() + 50_000)
  })

  test('re-dispatching the same row produces exactly one queue job', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.duplicate' })

    await dispatcher.dispatchBatch()
    // Force the row back to PENDING as the reconciler would after a crash.
    await sql.query("update outbox_event set state = 'PENDING', enqueued_at = null where id = $1", [
      id,
    ])
    await dispatcher.dispatchBatch()

    const queue = infrastructure.queues.get(QueueName.Email)
    const counts = await queue.getJobCounts('waiting', 'delayed', 'active')
    const total = (counts['waiting'] ?? 0) + (counts['delayed'] ?? 0) + (counts['active'] ?? 0)
    expect(total).toBe(1)
  })

  test('a concurrent dispatcher cannot claim the same row', async () => {
    for (let index = 0; index < 5; index += 1) {
      await insertOutboxEvent({ eventType: `test.concurrent.${index}` })
    }

    // Two dispatchers sweeping simultaneously: skip-locked must partition the
    // batch between them rather than letting both claim the same rows.
    const [first, second] = await Promise.all([
      dispatcher.dispatchBatch(),
      dispatcher.dispatchBatch(),
    ])

    expect(first.claimed + second.claimed).toBe(5)
    expect(first.published + second.published).toBe(5)

    const { rows } = await sql.query<{ count: string }>(
      "select count(*)::text as count from outbox_event where state = 'ENQUEUED' and attempts > 1",
    )
    // No row was claimed twice.
    expect(rows[0]?.count).toBe('0')
  })

  test('interleaves tenants within a batch so an old noisy tenant cannot monopolize it', async () => {
    const noisyOrganizationId = newId()
    const quietOrganizationId = newId()
    for (let index = 0; index < 4; index += 1) {
      await insertOutboxEvent({
        eventType: `test.noisy.${index}`,
        organizationId: noisyOrganizationId,
        availableAt: new Date(Date.now() - 60_000 + index).toISOString(),
      })
    }
    await insertOutboxEvent({
      eventType: 'test.quiet',
      organizationId: quietOrganizationId,
      availableAt: new Date(Date.now() - 1_000).toISOString(),
    })

    const fairConfig = {
      ...infrastructure.config,
      worker: {
        ...infrastructure.config.worker,
        outbox: { ...infrastructure.config.worker.outbox, batchSize: 2 },
      },
    }
    const fairDispatcher = createOutboxDispatcher(
      infrastructure.transactions,
      infrastructure.queues,
      fairConfig,
      infrastructure.logger,
    )
    expect((await fairDispatcher.dispatchBatch()).published).toBe(2)

    const { rows } = await sql.query<{ organization_id: string }>(
      `select organization_id::text
       from outbox_event where state = 'ENQUEUED'
       order by organization_id`,
    )
    expect(rows.map((row) => row.organization_id).sort()).toEqual(
      [noisyOrganizationId, quietOrganizationId].sort(),
    )
  })

  test('an event with an unroutable queue is failed rather than retried forever', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.badqueue', queueName: 'not-a-queue' })

    await dispatcher.dispatchBatch()

    const { rows } = await sql.query<{ state: string; last_error: string | null }>(
      'select state, last_error from outbox_event where id = $1',
      [id],
    )
    expect(rows[0]?.state).toBe('FAILED')
    expect(rows[0]?.last_error).toContain('not-a-queue')
  })
})

describe('outbox deduplication', () => {
  test('the unique dedupe key keeps a duplicated obligation to one row', async () => {
    const dedupeKey = `challenge.deadline_extended:${newId()}`

    await insertOutboxEvent({ eventType: 'test.dedupe', dedupeKey })
    await expect(insertOutboxEvent({ eventType: 'test.dedupe', dedupeKey })).rejects.toThrow(
      /duplicate key|unique/i,
    )

    const { rows } = await sql.query<{ count: string }>(
      'select count(*)::text as count from outbox_event where dedupe_key = $1',
      [dedupeKey],
    )
    expect(rows[0]?.count).toBe('1')
  })

  test('events without a dedupe key are independent', async () => {
    await insertOutboxEvent({ eventType: 'test.nodedupe' })
    await insertOutboxEvent({ eventType: 'test.nodedupe' })

    const { rows } = await sql.query<{ count: string }>(
      "select count(*)::text as count from outbox_event where event_type = 'test.nodedupe'",
    )
    expect(rows[0]?.count).toBe('2')
  })
})

describe('outbox reconciliation', () => {
  test('reclaims a row stuck in ENQUEUED past the stale window', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.stale', state: 'ENQUEUED' })
    await sql.query(
      "update outbox_event set enqueued_at = now() - interval '1 hour' where id = $1",
      [id],
    )

    const reclaimed = await dispatcher.reconcileStale()
    expect(reclaimed).toBeGreaterThanOrEqual(1)

    const { rows } = await sql.query<{ state: string; enqueued_at: Date | null }>(
      'select state, enqueued_at from outbox_event where id = $1',
      [id],
    )
    // The obligation is recoverable: a crashed worker cannot strand it.
    expect(rows[0]?.state).toBe('PENDING')
    expect(rows[0]?.enqueued_at).toBeNull()
  })

  test('leaves a recently enqueued row alone', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.fresh', state: 'ENQUEUED' })
    await sql.query('update outbox_event set enqueued_at = now() where id = $1', [id])

    await dispatcher.reconcileStale()

    const { rows } = await sql.query<{ state: string }>(
      'select state from outbox_event where id = $1',
      [id],
    )
    expect(rows[0]?.state).toBe('ENQUEUED')
  })

  test('marks a row FAILED once it exhausts its dispatch attempts', async () => {
    const id = await insertOutboxEvent({
      eventType: 'test.exhausted',
      attempts: infrastructure.config.worker.outbox.maxAttempts,
    })

    await dispatcher.reconcileStale()

    const { rows } = await sql.query<{ state: string }>(
      'select state from outbox_event where id = $1',
      [id],
    )
    // Visible to operators instead of silently consuming dispatch capacity.
    expect(rows[0]?.state).toBe('FAILED')
  })

  test('reports the age of the oldest undispatched obligation', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.age' })
    await sql.query(
      "update outbox_event set created_at = now() - interval '90 seconds' where id = $1",
      [id],
    )

    const age = await dispatcher.oldestPendingAgeSeconds()
    expect(age).toBeGreaterThanOrEqual(89)
  })
})

describe('queue outage', () => {
  test('a failed publish returns the row to PENDING rather than losing it', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.outage' })

    // Simulate the queue refusing the job by pointing the registry at a closed
    // connection for this one sweep.
    const queue = infrastructure.queues.get(QueueName.Email)
    const originalAdd = queue.add.bind(queue)
    queue.add = (async () => {
      throw new Error('ECONNREFUSED: queue Redis unavailable')
    }) as typeof queue.add

    try {
      const outcome = await dispatcher.dispatchBatch()
      expect(outcome.published).toBe(0)
    } finally {
      queue.add = originalAdd
    }

    const { rows } = await sql.query<{ state: string; last_error: string | null }>(
      'select state, last_error from outbox_event where id = $1',
      [id],
    )
    // The business change already committed; the obligation must survive.
    expect(rows[0]?.state).toBe('PENDING')
    expect(rows[0]?.last_error).toContain('unavailable')
  })

  test('a late queue error cannot reopen an event a worker already processed', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.late-queue-error' })
    const queue = infrastructure.queues.get(QueueName.Email)
    const originalAdd = queue.add.bind(queue)
    queue.add = (async () => {
      // Model an ambiguous provider outcome: Redis accepted and a worker
      // completed the job, but the dispatcher's call still surfaced an error.
      await sql.query(
        `update outbox_event
         set state = 'PROCESSED', processed_at = now(), updated_at = now()
         where id = $1`,
        [id],
      )
      throw new Error('Connection closed after the queue accepted the job')
    }) as typeof queue.add

    try {
      expect((await dispatcher.dispatchBatch()).published).toBe(0)
    } finally {
      queue.add = originalAdd
    }

    const { rows } = await sql.query<{ state: string; processed_at: Date | null }>(
      'select state, processed_at from outbox_event where id = $1',
      [id],
    )
    expect(rows[0]?.state).toBe('PROCESSED')
    expect(rows[0]?.processed_at).not.toBeNull()
  })
})

describe('worker acknowledgement races', () => {
  test('a duplicate worker failure cannot overwrite a successful acknowledgement', async () => {
    const id = await insertOutboxEvent({ eventType: 'test.duplicate-worker', state: 'ENQUEUED' })
    await sql.query(
      `update outbox_event
       set state = 'PROCESSED', processed_at = now(), updated_at = now()
       where id = $1`,
      [id],
    )

    await recordOutboxFailure(infrastructure, id, new Error('late duplicate failure'), true)

    const { rows } = await sql.query<{
      state: string
      last_error: string | null
      processed_at: Date | null
    }>('select state, last_error, processed_at from outbox_event where id = $1', [id])
    expect(rows[0]?.state).toBe('PROCESSED')
    expect(rows[0]?.last_error).toBeNull()
    expect(rows[0]?.processed_at).not.toBeNull()
  })
})
