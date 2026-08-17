import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { isDatabaseUnavailableError, isRetryableDatabaseError } from '../../src/shared/database'
import { newId } from '../../src/shared/ids'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'
import { createTestInfrastructure, type TestInfrastructure } from '../helpers/test-infrastructure'

/**
 * Transaction boundary behaviour under contention.
 *
 * The properties here are what every check-then-write invariant later in the
 * system relies on: tenant context is transaction-local, serialization failures
 * are retried but nothing else is, and database time — not process time — is
 * the authority for deadline decisions (master prompt sections 6.3, 32).
 */

let infrastructure: TestInfrastructure
let sql: Client

beforeAll(async () => {
  infrastructure = await createTestInfrastructure()
  sql = await connectMigrationSql()
})

afterAll(async () => {
  // Do not leak the synthetic `test.serializable` outbox event into suites
  // that run after this file and exercise the real dispatcher catalogue.
  await resetDatabase(sql)
  await infrastructure.dispose()
  await sql.end()
})

beforeEach(async () => {
  await resetDatabase(sql)
})

describe('tenant transaction context', () => {
  const organizationId = '01930000-0000-7000-8000-00000000c001'

  test('publishes the tenant into the transaction', async () => {
    const observed = await infrastructure.transactions.withTenant(organizationId, async (tx) => {
      const rows = await tx.$queryRaw<{ id: string | null }[]>`
        select app_current_organization_id()::text as id
      `
      return rows[0]?.id
    })

    expect(observed).toBe(organizationId)
  })

  test('does not leak the tenant to the next transaction on the same pool', async () => {
    await infrastructure.transactions.withTenant(organizationId, async (tx) => {
      await tx.$queryRaw`select 1`
    })

    // Prisma hands out pooled connections; a session-level setting would make
    // the next request inherit the previous request's tenant.
    const leaked = await infrastructure.transactions.withoutTenant(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string | null }[]>`
        select app_current_organization_id()::text as id
      `
      return rows[0]?.id
    })

    expect(leaked).toBeNull()
  })

  test('rolls the tenant context back with a failed transaction', async () => {
    await expect(
      infrastructure.transactions.withTenant(organizationId, async (tx) => {
        await tx.$queryRaw`select 1`
        throw new Error('business rule rejected this operation')
      }),
    ).rejects.toThrow('business rule rejected this operation')

    const after = await infrastructure.transactions.withoutTenant(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string | null }[]>`
        select app_current_organization_id()::text as id
      `
      return rows[0]?.id
    })

    expect(after).toBeNull()
  })

  test('keeps concurrent tenants isolated from each other', async () => {
    const tenants = Array.from({ length: 8 }, () => newId())

    const observed = await Promise.all(
      tenants.map((tenant) =>
        infrastructure.transactions.withTenant(tenant, async (tx) => {
          // Interleave the transactions so they genuinely overlap on the pool.
          await tx.$queryRaw`select pg_sleep(0.02)::text as slept`
          const rows = await tx.$queryRaw<{ id: string | null }[]>`
            select app_current_organization_id()::text as id
          `
          return rows[0]?.id
        }),
      ),
    )

    // Every transaction must see its own tenant, never a neighbour's.
    expect(observed).toEqual(tenants)
  })

  test('platform access is off by default and on only when explicitly taken', async () => {
    const withoutAccess = await infrastructure.transactions.withTenant(
      organizationId,
      async (tx) => {
        const rows = await tx.$queryRaw<{ platform: boolean }[]>`
          select app_platform_access() as platform
        `
        return rows[0]?.platform
      },
    )
    expect(withoutAccess).toBe(false)

    const withAccess = await infrastructure.transactions.withPlatformAccess(
      async (tx) => {
        const rows = await tx.$queryRaw<{ platform: boolean }[]>`
          select app_platform_access() as platform
        `
        return rows[0]?.platform
      },
      { purpose: 'integration test: verifying purpose-based platform access' },
    )
    expect(withAccess).toBe(true)
  })

  test('platform access requires a stated purpose', async () => {
    // Platform-wide reach must always be attributable to a reason.
    await expect(
      infrastructure.transactions.withPlatformAccess(async () => undefined, { purpose: '   ' }),
    ).rejects.toThrow(/purpose/)
  })
})

describe('database time authority', () => {
  test('reads the current instant from the database, not the process', async () => {
    const dbTime = await infrastructure.transactions.withoutTenant((tx) =>
      infrastructure.transactions.databaseNow(tx),
    )

    expect(dbTime).toBeInstanceOf(Date)
    // Sanity: the two clocks should be close on one machine, but only the
    // database's answer is ever used to accept or reject a deadline.
    expect(Math.abs(dbTime.getTime() - Date.now())).toBeLessThan(60_000)
  })

  test('advances within a single long transaction', async () => {
    // clock_timestamp() rather than now(): now() is frozen at transaction
    // start, which would let a slow transaction accept a submission after the
    // deadline passed mid-flight.
    const [first, second] = await infrastructure.transactions.withoutTenant(async (tx) => {
      const before = await infrastructure.transactions.databaseNow(tx)
      await tx.$queryRaw`select pg_sleep(0.05)::text as slept`
      const after = await infrastructure.transactions.databaseNow(tx)
      return [before, after]
    })

    expect((second as Date).getTime()).toBeGreaterThan((first as Date).getTime())
  })
})

describe('retry classification', () => {
  test('recognises serialization and deadlock failures as retryable', () => {
    expect(isRetryableDatabaseError({ code: '40001' })).toBe(true)
    expect(isRetryableDatabaseError({ code: '40P01' })).toBe(true)
  })

  test('does not retry constraint violations or permission errors', () => {
    // Retrying these would just repeat the same failure while holding capacity.
    expect(isRetryableDatabaseError({ code: '23505' })).toBe(false)
    expect(isRetryableDatabaseError({ code: '23503' })).toBe(false)
    expect(isRetryableDatabaseError({ code: '42501' })).toBe(false)
    expect(isRetryableDatabaseError(new Error('boom'))).toBe(false)
  })

  test('reads the SQLSTATE out of the Prisma driver-adapter wrapper', () => {
    // Regression: Prisma 7 reports its own P2010 at the top level and nests the
    // real SQLSTATE. Reading only the top level classified every serialization
    // failure as non-retryable, silently disabling the retry path.
    const wrapped = {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010',
      meta: {
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '40001',
            originalMessage: 'could not serialize access due to concurrent update',
            kind: 'TransactionWriteConflict',
          },
        },
      },
    }

    expect(isRetryableDatabaseError(wrapped)).toBe(true)
    // A Prisma error code is not a SQLSTATE and must never be treated as one.
    expect(isRetryableDatabaseError({ code: 'P2010' })).toBe(false)
  })

  test('recognises connectivity failures as unavailability', () => {
    expect(isDatabaseUnavailableError({ code: '08006' })).toBe(true)
    expect(isDatabaseUnavailableError({ code: '57P03' })).toBe(true)
    expect(isDatabaseUnavailableError({ code: '23505' })).toBe(false)
  })
})

describe('serializable retries', () => {
  test('two serializable transactions on the same row resolve deterministically', async () => {
    const eventId = newId()
    await sql.query(
      `insert into outbox_event
         (id, event_type, queue_name, aggregate_type, payload, state, available_at,
          attempts, created_at, updated_at)
       values ($1, 'test.serializable', 'email', 'test', '{}'::jsonb, 'PENDING', now(),
               0, now(), now())`,
      [eventId],
    )

    const bump = () =>
      infrastructure.transactions.withPlatformAccess(
        async (tx) => {
          const rows = await tx.$queryRaw<{ attempts: number }[]>`
            select attempts from outbox_event where id = ${eventId}::uuid
          `
          const current = rows[0]?.attempts ?? 0
          // Widen the conflict window so the two transactions genuinely race.
          await tx.$queryRaw`select pg_sleep(0.03)::text as slept`
          await tx.$executeRaw`
            update outbox_event set attempts = ${current + 1} where id = ${eventId}::uuid
          `
        },
        {
          purpose: 'Exercise serializable retry behavior on a global infrastructure row.',
          isolationLevel: 'Serializable',
        },
      )

    await Promise.all([bump(), bump()])

    const { rows } = await sql.query<{ attempts: number }>(
      'select attempts from outbox_event where id = $1',
      [eventId],
    )
    // A lost update would leave this at 1. Serializable isolation plus the
    // bounded retry must produce 2.
    expect(rows[0]?.attempts).toBe(2)
  })
})
