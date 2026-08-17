import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { connectMigrationSql, connectRuntimeSql, resetDatabase } from '../helpers/test-database'

/**
 * The database-level guarantees the whole security model rests on.
 *
 * These are asserted against a real PostgreSQL instance because they are
 * properties of the database, not of the application: an application-level test
 * could not tell the difference between "the code never issues this statement"
 * and "the database would refuse it".
 *
 * Master prompt sections 6.3, 29, 41.2, and final verification items 6 and 28.
 */

let runtime: Client
let migration: Client

beforeAll(async () => {
  runtime = await connectRuntimeSql()
  migration = await connectMigrationSql()
  await resetDatabase(migration)
})

afterAll(async () => {
  await runtime.end()
  await migration.end()
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
    expect(role?.rolcreatedb).toBe(false)
    expect(role?.rolcreaterole).toBe(false)
  })

  test('runtime and migration sessions are pinned to UTC', async () => {
    const runtimeTimezone = await runtime.query<{ TimeZone: string }>('show timezone')
    const migrationTimezone = await migration.query<{ TimeZone: string }>('show timezone')
    expect(runtimeTimezone.rows[0]?.TimeZone).toBe('UTC')
    expect(migrationTimezone.rows[0]?.TimeZone).toBe('UTC')
  })

  test('owns no tables in the public schema', async () => {
    const { rows } = await runtime.query<{ count: string }>(
      `select count(*)::text as count
       from pg_tables
       where schemaname = 'public' and tableowner = current_user`,
    )
    // Ownership would let the role alter or drop its own RLS policies.
    expect(rows[0]?.count).toBe('0')
  })

  test('cannot create objects in the public schema', async () => {
    await expect(
      runtime.query('create table should_not_exist (id uuid primary key)'),
    ).rejects.toThrow(/permission denied/i)
  })

  test('cannot assume the no-login public projection owner', async () => {
    await expect(runtime.query('set role ip_public_views')).rejects.toThrow(
      /permission denied|not permitted/i,
    )
  })

  test('media resolver execution is granted only to the runtime role', async () => {
    const { rows } = await migration.query<{
      resolver: string
      public_execute: boolean
      runtime_execute: boolean
    }>(
      `select resolver,
              exists (
                select 1
                from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
              ) as public_execute,
              has_function_privilege('ip_app', p.oid, 'EXECUTE') as runtime_execute
       from unnest($1::text[]) as requested(resolver)
       join pg_proc p on p.oid = resolver::regprocedure
       order by resolver`,
      [
        [
          'public.app_resolve_media_asset_context(uuid,uuid)',
          'public.app_resolve_public_media_delivery(uuid)',
        ],
      ],
    )
    expect(rows).toEqual([
      {
        resolver: 'public.app_resolve_media_asset_context(uuid,uuid)',
        public_execute: false,
        runtime_execute: true,
      },
      {
        resolver: 'public.app_resolve_public_media_delivery(uuid)',
        public_execute: false,
        runtime_execute: true,
      },
    ])
  })

  test('every RLS-protected table forces its policies for table owners', async () => {
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

  test('public projections have one dedicated no-login owner and security barriers', async () => {
    const { rows } = await runtime.query<{
      relname: string
      owner: string
      options: string[] | null
      rolcanlogin: boolean
    }>(
      `select c.relname, pg_get_userbyid(c.relowner) as owner,
              c.reloptions as options, r.rolcanlogin
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         join pg_roles r on r.oid = c.relowner
        where n.nspname = 'public'
          and c.relname = any($1::text[])
        order by c.relname`,
      [
        [
          'public_organization_view',
          'public_challenge_view',
          'public_innovation_view',
          'public_challenge_track_view',
          'public_announcement_view',
          'public_faq_view',
          'public_submission_result_view',
          'public_project_view',
        ],
      ],
    )

    expect(rows).toHaveLength(8)
    for (const row of rows) {
      expect(row.owner).toBe('ip_public_views')
      expect(row.rolcanlogin).toBe(false)
      expect(row.options).toContain('security_barrier=true')
      expect(row.options).toContain('security_invoker=false')
    }
  })

  test('public projection grants are read-only and the definer can read only its sources', async () => {
    const views = [
      'public_announcement_view',
      'public_challenge_track_view',
      'public_challenge_view',
      'public_faq_view',
      'public_innovation_view',
      'public_organization_view',
      'public_project_view',
      'public_submission_result_view',
    ]
    const sources = [
      'announcement',
      'challenge',
      'challenge_team',
      'challenge_track',
      'faq',
      'innovation',
      'organization',
      'result_snapshot',
      'submission',
      'submission_result',
      'submission_technology',
      'submission_version',
    ]

    const { rows: runtimeViewGrants } = await migration.query<{
      table_name: string
      privilege_type: string
    }>(
      `select table_name, privilege_type
         from information_schema.role_table_grants
        where grantee = 'ip_app'
          and table_schema = 'public'
          and table_name = any($1::text[])
        order by table_name, privilege_type`,
      [views],
    )
    expect(runtimeViewGrants).toEqual(
      views.map((table_name) => ({ table_name, privilege_type: 'SELECT' })),
    )

    const { rows: definerSources } = await migration.query<{ relname: string }>(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and has_table_privilege('ip_public_views', c.oid, 'SELECT')
        order by c.relname`,
    )
    expect(definerSources.map((row) => row.relname)).toEqual(sources)

    await expect(
      runtime.query('update public_organization_view set name = name where false'),
    ).rejects.toThrow(/permission denied/i)
    const { rows: privateAccess } = await migration.query<{ allowed: boolean }>(
      "select has_table_privilege('ip_public_views', 'public.user', 'SELECT') as allowed",
    )
    expect(privateAccess[0]?.allowed).toBe(false)
  })

  test('innovation provenance cannot be nulled by deleting its source', async () => {
    const { rows } = await migration.query<{ conname: string; delete_action: string }>(
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
  const auditId = '01930000-0000-7000-8000-00000000a001'

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
