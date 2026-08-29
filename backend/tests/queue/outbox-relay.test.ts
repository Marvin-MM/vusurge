import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { newId } from '../../src/shared/ids'
import {
  createOutboxDispatcher,
  createOutboxListener,
  createOutboxRelay,
  type OutboxRelay,
} from '../../src/shared/outbox'
import { QueueName } from '../../src/shared/queue'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'
import {
  clearRedis,
  createTestInfrastructure,
  type TestInfrastructure,
} from '../helpers/test-infrastructure'

/**
 * The event-driven outbox relay, against real PostgreSQL and real Redis.
 *
 * The property that justifies the whole refactor: a transaction that commits
 * an outbox row must produce a published BullMQ job without any polling
 * interval elapsing — the notification does the waking — and a notification
 * that arrives while the relay is busy must not be lost.
 */

let infrastructure: TestInfrastructure
let sql: Client
let relay: OutboxRelay

async function insertOutboxEvent(
  overrides: Partial<{
    eventType: string
    availableAt: string
    organizationId: string | null
  }> = {},
): Promise<string> {
  const id = newId()
  await sql.query(
    `insert into outbox_event
       (id, event_type, queue_name, aggregate_type, organization_id,
        payload, state, available_at, dedupe_key, created_at, updated_at)
     values ($1, $2, $3, 'test', $4::uuid, '{"probe":true}'::jsonb,
             'PENDING', coalesce($5::timestamptz, now()), null, now(), now())`,
    [
      id,
      overrides.eventType ?? 'test.relay',
      QueueName.Email,
      overrides.organizationId ?? null,
      overrides.availableAt ?? null,
    ],
  )
  return id
}

/** Insert + notify exactly like a committed application transaction would. */
async function commitOutboxEvent(
  overrides: Parameters<typeof insertOutboxEvent>[0] = {},
): Promise<string> {
  const id = await insertOutboxEvent(overrides)
  await sql.query('select pg_notify($1, $2)', ['outbox_event', JSON.stringify({ n: 1 })])
  return id
}

/** Wait until the condition holds or the deadline passes. */
async function eventually(assertion: () => Promise<void>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      await assertion()
      return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw lastError instanceof Error ? lastError : new Error('eventually() timed out')
}

beforeAll(async () => {
  infrastructure = await createTestInfrastructure({ OUTBOX_POLL_INTERVAL_MS: '30000' })
  sql = await connectMigrationSql()

  const dispatcher = createOutboxDispatcher(
    infrastructure.transactions,
    infrastructure.queues,
    infrastructure.config,
    infrastructure.logger,
  )
  const listener = createOutboxListener(infrastructure.config, infrastructure.logger)
  relay = createOutboxRelay({
    dispatcher,
    listener,
    config: infrastructure.config,
    logger: infrastructure.logger,
  })

  await relay.start()
})

afterAll(async () => {
  await relay.stop()
  await clearRedis(infrastructure)
  await infrastructure.dispose()
  await sql.end()
})

beforeEach(async () => {
  await resetDatabase(sql)
  await clearRedis(infrastructure)
})

describe('outbox relay (LISTEN/NOTIFY)', () => {
  test('a committed event is published without waiting for the fallback interval', async () => {
    const id = await commitOutboxEvent({ eventType: 'test.notify' })

    await eventually(async () => {
      const job = await infrastructure.queues.get(QueueName.Email).getJob(id)
      expect(job).toBeDefined()
    })

    await eventually(async () => {
      const { rows } = await sql.query<{ state: string }>(
        'select state from outbox_event where id = $1',
        [id],
      )
      expect(rows[0]?.state).toBe('ENQUEUED')
    })
  })

  test('a burst of events in one notification is fully drained', async () => {
    const ids: string[] = []
    for (let index = 0; index < 12; index += 1) {
      ids.push(await insertOutboxEvent({ eventType: `test.burst.${index}` }))
    }
    await sql.query('select pg_notify($1, $2)', ['outbox_event', JSON.stringify({ n: 12 })])

    await eventually(async () => {
      const { rows } = await sql.query<{ count: string }>(
        "select count(*)::text as count from outbox_event where state = 'ENQUEUED'",
      )
      expect(rows[0]?.count).toBe('12')
    }, 10_000)
  })

  test('a rolled-back transaction never wakes the relay', async () => {
    await sql.query('begin')
    const id = newId()
    await sql.query(
      `insert into outbox_event
         (id, event_type, queue_name, aggregate_type, payload, state, created_at, updated_at)
       values ($1, 'test.rollback', $2, 'test', '{"probe":true}'::jsonb, 'PENDING', now(), now())`,
      [id, QueueName.Email],
    )
    await sql.query('select pg_notify($1, $2)', ['outbox_event', JSON.stringify({ n: 1 })])
    await sql.query('rollback')

    // The row is gone (rolled back) and no spurious dispatch happened: give
    // the relay a moment and confirm the queue stayed empty.
    await new Promise((resolve) => setTimeout(resolve, 750))
    const job = await infrastructure.queues.get(QueueName.Email).getJob(id)
    expect(job).toBeUndefined()
  })

  test('a delayed event is picked up when it becomes available', async () => {
    // Production path for delayed events: the writer notifies at INSERT time
    // (inside the transaction), the relay wakes, finds nothing dispatchable
    // yet, and caps its sleep at the row's available_at.
    const id = await commitOutboxEvent({
      eventType: 'test.delayed-wake',
      availableAt: new Date(Date.now() + 1_500).toISOString(),
    })

    // Not dispatchable yet.
    await new Promise((resolve) => setTimeout(resolve, 300))
    const { rows } = await sql.query<{ state: string }>(
      'select state from outbox_event where id = $1',
      [id],
    )
    expect(rows[0]?.state).toBe('PENDING')

    // The relay's sleep was capped at the availability time; it wakes on its
    // own — no second notification is sent for delayed availability.
    await eventually(async () => {
      const result = await sql.query<{ state: string }>(
        'select state from outbox_event where id = $1',
        [id],
      )
      expect(result.rows[0]?.state).toBe('ENQUEUED')
    }, 8_000)
  }, 15_000)

  test('the writer notifies inside the committing transaction', async () => {
    // The production writer path: outbox.write() issues pg_notify itself, in
    // the same transaction as the insert. Platform access because the relay
    // test has no tenant context; production callers reach the same writer
    // through withTenant/withPlatformAccess.
    const id = await infrastructure.transactions.withPlatformAccess(
      async (tx) =>
        infrastructure.outbox.write(tx, {
          eventType: 'email.delivery_requested',
          queueName: QueueName.Email,
          aggregateType: 'test',
          payload: { probe: true },
          dedupeKey: `email.delivery_requested:${newId()}`,
        }),
      { purpose: 'Exercise the production outbox writer notify path in tests.' },
    )

    await eventually(async () => {
      const job = await infrastructure.queues.get(QueueName.Email).getJob(id)
      expect(job).toBeDefined()
    })
  })
})
