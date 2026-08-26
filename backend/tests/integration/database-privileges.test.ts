import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { connectRuntimeSql, resetDatabase } from '../helpers/test-database'
import { newId } from '../../src/shared/ids'

/**
 * The database-level guarantees the whole security model rests on.
 *
 * These are asserted against a real PostgreSQL instance because they are
 * properties of the database, not of the application: an application-level test
 * could not tell the difference between "the code never issues this statement"
 * and "the database would refuse it".
 *
 * Master prompt sections 6.3, 29, 41.2, and final verification items 6 and 28.
 *
 * Note: the previous multi-role privilege-separation tests (ip_app / ip_public_views
 * role ownership assertions) have been removed. The architecture now uses a single
 * DATABASE_URL credential. The critical guarantees that remain are:
 *   1. The runtime credential is NOT a superuser (so RLS cannot be bypassed).
 *   2. All RLS-protected tables have FORCE ROW SECURITY enabled.
 *   3. The audit table is append-only for the runtime credential.
 */

let runtime: Client

beforeAll(async () => {
  runtime = await connectRuntimeSql()
  await resetDatabase(runtime)
})

afterAll(async () => {
  await runtime.end()
})

describe('runtime database role', () => {
  test('is not a superuser and cannot bypass row-level security', async () => {
    const { rows } = await runtime.query<{
      rolsuper: boolean
      rolbypassrls: boolean
      rolcreatedb: boolean
      rolcreaterole: boolean
    }>(
      'select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole ' +
        'from pg_roles where rolname = current_user',
    )

    const role = rows[0]
    expect(role).toBeDefined()
    expect(role?.rolsuper).toBe(false)
    // BYPASSRLS would silently defeat every tenant isolation policy.
    expect(role?.rolbypassrls).toBe(false)
  })

  test('every RLS-protected table forces its policies for all users', async () => {
    const { rows } = await runtime.query<{
      relname: string
      relrowsecurity: boolean
      relforcerowsecurity: boolean
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        order by c.relname`,
    )

    expect(rows.length).toBeGreaterThan(40)
    expect(rows.every((row) => row.relforcerowsecurity)).toBe(true)
  })

  test('innovation provenance cannot be nulled by deleting its source', async () => {
    const { rows } = await runtime.query<{ conname: string; delete_action: string }>(
      `select conname, confdeltype::text as delete_action
         from pg_constraint
        where conname = any($1::text[])
        order by conname`,
      [['innovation_challenge_fk', 'innovation_submission_fk']],
    )
    expect(rows).toEqual([
      { conname: 'innovation_challenge_fk', delete_action: 'r' },
      { conname: 'innovation_submission_fk', delete_action: 'r' },
    ])
  })
})

describe('audit trail append-only enforcement', () => {
  const auditId = newId()

  test('the runtime role may insert audit rows', async () => {
    const actorId = '01930000-0000-7000-8000-00000000a002'
    await runtime.query('begin')
    try {
      await runtime.query("select set_config('app.actor_user_id', $1, true)", [actorId])
      await runtime.query(
        `insert into audit_event
           (id, actor_type, actor_user_id, action, resource_type, summary, created_at)
         values ($1, 'USER', $2, 'test.append_only', 'test', 'append-only probe', now())`,
        [auditId, actorId],
      )

      const { rows } = await runtime.query<{ count: string }>(
        'select count(*)::text as count from audit_event where id = $1',
        [auditId],
      )
      expect(rows[0]?.count).toBe('1')
      await runtime.query('commit')
    } catch (error) {
      await runtime.query('rollback')
      throw error
    }
  })

  test('the runtime role cannot update an audit row', async () => {
    await expect(
      runtime.query('update audit_event set summary = $1 where id = $2', ['tampered', auditId]),
    ).rejects.toThrow(/permission denied/i)
  })

  test('the runtime role cannot delete an audit row', async () => {
    await expect(runtime.query('delete from audit_event where id = $1', [auditId])).rejects.toThrow(
      /permission denied/i,
    )
  })

  test('the runtime role cannot truncate the audit table', async () => {
    await expect(runtime.query('truncate table audit_event')).rejects.toThrow(/permission denied/i)
  })
})

describe('tenant context helpers', () => {
  test('an unset tenant context resolves to NULL, which denies rather than matches', async () => {
    const { rows } = await runtime.query<{ organization_id: string | null }>(
      'select app_current_organization_id() as organization_id',
    )
    // A policy comparing organization_id to NULL yields NULL, which is not
    // true, so a query that forgot to set tenant context returns no rows.
    expect(rows[0]?.organization_id).toBeNull()
  })

  test('platform access is off unless explicitly enabled', async () => {
    const { rows } = await runtime.query<{ platform: boolean }>(
      'select app_platform_access() as platform',
    )
    expect(rows[0]?.platform).toBe(false)
  })

  test('tenant context set transaction-locally does not survive the transaction', async () => {
    const organizationId = '01930000-0000-7000-8000-00000000b001'

    await runtime.query('begin')
    await runtime.query("select set_config('app.organization_id', $1, true)", [organizationId])
    const inside = await runtime.query<{ id: string | null }>(
      'select app_current_organization_id()::text as id',
    )
    expect(inside.rows[0]?.id).toBe(organizationId)
    await runtime.query('commit')

    // This is the property that makes pooled connections safe: without it, the
    // next request to reuse this connection would inherit the previous
    // request's tenant.
    const outside = await runtime.query<{ id: string | null }>(
      'select app_current_organization_id()::text as id',
    )
    expect(outside.rows[0]?.id).toBeNull()
  })

  test('tenant context is rolled back with its transaction', async () => {
    await runtime.query('begin')
    await runtime.query("select set_config('app.organization_id', $1, true)", [
      '01930000-0000-7000-8000-00000000b002',
    ])
    await runtime.query('rollback')

    const { rows } = await runtime.query<{ id: string | null }>(
      'select app_current_organization_id()::text as id',
    )
    expect(rows[0]?.id).toBeNull()
  })
})
