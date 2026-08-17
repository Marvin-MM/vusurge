import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { AppError, conflict, ErrorCode } from '../../src/shared/errors'
import type { IdempotencyStore } from '../../src/shared/idempotency'
import { newId } from '../../src/shared/ids'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'
import { createTestInfrastructure, type TestInfrastructure } from '../helpers/test-infrastructure'

/**
 * Idempotency behaviour under client retries and concurrency.
 *
 * Required on high-value POSTs — final submission, invitation creation, export
 * requests, result publication — where a network retry must not duplicate the
 * effect (master prompt section 33).
 */

let infrastructure: TestInfrastructure
let store: IdempotencyStore
let sql: Client

const actorUserId = '01930000-0000-7000-8000-0000000000aa'

beforeAll(async () => {
  infrastructure = await createTestInfrastructure()
  store = infrastructure.idempotency
  sql = await connectMigrationSql()
})

afterAll(async () => {
  await infrastructure.dispose()
  await sql.end()
})

beforeEach(async () => {
  await resetDatabase(sql)
})

describe('idempotent execution', () => {
  test('runs the operation once and returns its result', async () => {
    let invocations = 0
    const key = newId()

    const result = await store.run(
      { actorUserId, operation: 'submission.finalize', key, requestBody: { submissionId: 'a' } },
      async () => {
        invocations += 1
        return { status: 201, body: { id: 'submission-1' } }
      },
    )

    expect(invocations).toBe(1)
    expect(result.replayed).toBe(false)
    expect(result.value).toEqual({ id: 'submission-1' })
  })

  test('replays the stored response without re-running the operation', async () => {
    let invocations = 0
    const key = newId()
    const body = { submissionId: 'a' }
    const operation = async () => {
      invocations += 1
      return { status: 201, body: { id: 'submission-1' } }
    }

    await store.run(
      { actorUserId, operation: 'submission.finalize', key, requestBody: body },
      operation,
    )
    const replay = await store.run(
      { actorUserId, operation: 'submission.finalize', key, requestBody: body },
      operation,
    )

    // The effect happened once; the client still gets its answer.
    expect(invocations).toBe(1)
    expect(replay.replayed).toBe(true)
    expect(replay.value).toEqual({ id: 'submission-1' })
  })

  test('is insensitive to request key ordering', async () => {
    const key = newId()
    let invocations = 0
    const operation = async () => {
      invocations += 1
      return { status: 201, body: { ok: true } }
    }

    await store.run(
      { actorUserId, operation: 'export.request', key, requestBody: { a: 1, b: 2 } },
      operation,
    )
    // The same payload with keys in a different order is the same request.
    await store.run(
      { actorUserId, operation: 'export.request', key, requestBody: { b: 2, a: 1 } },
      operation,
    )

    expect(invocations).toBe(1)
  })

  test('rejects key reuse with a different body', async () => {
    const key = newId()
    await store.run(
      { actorUserId, operation: 'export.request', key, requestBody: { scope: 'challenge-a' } },
      async () => ({ status: 202, body: { exportId: '1' } }),
    )

    // Silently returning the first response would hide the fact that the second
    // request never happened.
    await expect(
      store.run(
        { actorUserId, operation: 'export.request', key, requestBody: { scope: 'challenge-b' } },
        async () => ({ status: 202, body: { exportId: '2' } }),
      ),
    ).rejects.toThrow(/already used with a different request body/)
  })

  test('scopes keys to the actor', async () => {
    const key = 'shared-key'
    let invocations = 0
    const operation = async () => {
      invocations += 1
      return { status: 201, body: { ok: true } }
    }

    await store.run(
      { actorUserId, operation: 'invitation.create', key, requestBody: {} },
      operation,
    )
    await store.run(
      {
        actorUserId: '01930000-0000-7000-8000-0000000000bb',
        operation: 'invitation.create',
        key,
        requestBody: {},
      },
      operation,
    )

    // One user's key must never suppress another user's request.
    expect(invocations).toBe(2)
  })

  test('scopes keys to the operation', async () => {
    const key = 'shared-key-2'
    let invocations = 0
    const operation = async () => {
      invocations += 1
      return { status: 201, body: { ok: true } }
    }

    await store.run(
      { actorUserId, operation: 'invitation.create', key, requestBody: {} },
      operation,
    )
    await store.run({ actorUserId, operation: 'export.request', key, requestBody: {} }, operation)

    expect(invocations).toBe(2)
  })
})

describe('failure handling', () => {
  test('releases the claim after an unexpected failure so a retry can proceed', async () => {
    const key = newId()

    await expect(
      store.run(
        { actorUserId, operation: 'submission.finalize', key, requestBody: {} },
        async () => {
          throw new Error('transient database failure')
        },
      ),
    ).rejects.toThrow('transient database failure')

    // The claim must not poison the key: the client should be able to retry.
    const retry = await store.run(
      { actorUserId, operation: 'submission.finalize', key, requestBody: {} },
      async () => ({ status: 201, body: { ok: true } }),
    )
    expect(retry.replayed).toBe(false)
    expect(retry.value).toEqual({ ok: true })
  })

  test('a business rejection is remembered so the retry is deterministic', async () => {
    const key = newId()

    await expect(
      store.run(
        { actorUserId, operation: 'submission.finalize', key, requestBody: {} },
        async () => {
          throw conflict(ErrorCode.SUBMISSION_ALREADY_FINALIZED, 'Already finalized.')
        },
      ),
    ).rejects.toThrow(AppError)

    // Retrying the same key returns the same rejection rather than succeeding.
    await expect(
      store.run(
        { actorUserId, operation: 'submission.finalize', key, requestBody: {} },
        async () => ({
          status: 201,
          body: { ok: true },
        }),
      ),
    ).rejects.toThrow('Already finalized.')
  })

  test('rolls back partial business writes while committing the exact 4xx response', async () => {
    const key = newId()
    const providerEventId = newId()

    await expect(
      store.run({ actorUserId, operation: 'webhook.accept', key, requestBody: {} }, async (tx) => {
        await tx.webhookEvent.create({
          data: {
            id: newId(),
            provider: 'test',
            providerEventId,
            eventType: 'test.partial',
            payload: {},
          },
        })
        throw conflict(ErrorCode.CONFLICT, 'Deterministic rejection.')
      }),
    ).rejects.toThrow('Deterministic rejection.')

    const partial = await sql.query('select id from webhook_event where provider_event_id = $1', [
      providerEventId,
    ])
    expect(partial.rowCount).toBe(0)

    await expect(
      store.run({ actorUserId, operation: 'webhook.accept', key, requestBody: {} }, async () => ({
        status: 200,
        body: { shouldNotRun: true },
      })),
    ).rejects.toThrow('Deterministic rejection.')
  })
})

describe('concurrency', () => {
  test('two simultaneous retries execute the operation exactly once', async () => {
    const key = newId()
    let invocations = 0

    const operation = async () => {
      invocations += 1
      // Widen the window in which both attempts overlap.
      await Bun.sleep(60)
      return { status: 201, body: { id: 'once' } }
    }

    const results = await Promise.allSettled([
      store.run({ actorUserId, operation: 'submission.finalize', key, requestBody: {} }, operation),
      store.run({ actorUserId, operation: 'submission.finalize', key, requestBody: {} }, operation),
    ])

    // Exactly one executes. The waiter blocks on the transaction-scoped lock
    // and then receives the committed response as a replay.
    expect(invocations).toBe(1)

    const fulfilled = results.filter((entry) => entry.status === 'fulfilled')
    const rejected = results.filter((entry) => entry.status === 'rejected')
    expect(fulfilled).toHaveLength(2)
    expect(rejected).toHaveLength(0)
    expect(
      fulfilled.map(
        (entry) => (entry as PromiseFulfilledResult<{ replayed: boolean }>).value.replayed,
      ),
    ).toEqual(expect.arrayContaining([false, true]))
  })
})

describe('retention', () => {
  test('purges expired records', async () => {
    const key = newId()
    await store.run(
      { actorUserId, operation: 'export.request', key, requestBody: {} },
      async () => ({
        status: 202,
        body: { ok: true },
      }),
    )

    await sql.query("update idempotency_record set expires_at = now() - interval '1 day'")
    expect(await store.purgeExpired()).toBeGreaterThanOrEqual(1)

    const { rows } = await sql.query<{ count: string }>(
      'select count(*)::text as count from idempotency_record',
    )
    expect(rows[0]?.count).toBe('0')
  })
})
