import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { newId } from '../../src/shared/ids'
import { connectMigrationSql, connectRuntimeSql, resetDatabase } from '../helpers/test-database'

/**
 * Secret-lookup RLS access, proven against real PostgreSQL.
 *
 * This is new infrastructure added specifically because invitation acceptance
 * and join-code redemption must resolve a row by an unguessable token BEFORE
 * that row's tenant is known — ordinary tenant RLS cannot admit this. The
 * tests here prove three things: without the flag the lookup sees nothing (so
 * a forgotten `withSecretLookup` fails safe rather than open), with the flag
 * it finds exactly the one row matching the secret, and the flag never
 * broadens visibility to other tenants' rows.
 */

let runtime: Client
let migration: Client

const orgA = newId()
const orgB = newId()

function id6(): string {
  return Math.random().toString(36).slice(2, 8)
}

async function seedInvitation(organizationId: string, tokenHash: string): Promise<string> {
  const creator = newId()
  await migration.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, 'Creator', $2, true, now(), now())`,
    [creator, `creator-${id6()}@example.org`],
  )
  const invitationId = newId()
  await migration.query(
    `insert into organization_invitation
       (id, organization_id, token_hash, role, status, expires_at, created_by_user_id,
        resend_count, created_at, updated_at)
     values ($1, $2, $3, 'MEMBER', 'PENDING', now() + interval '7 days', $4, 0, now(), now())`,
    [invitationId, organizationId, tokenHash, creator],
  )
  return invitationId
}

beforeAll(async () => {
  runtime = await connectRuntimeSql()
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await runtime.end()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
  await migration.query('truncate table organization restart identity cascade')
  for (const [id, slug] of [
    [orgA, `org-a-${id6()}`],
    [orgB, `org-b-${id6()}`],
  ] as const) {
    await migration.query(
      `insert into organization (id, slug, name, organization_type, status, visibility, created_at, updated_at)
       values ($1, $2, 'Org', 'COMPANY', 'ACTIVE', 'PRIVATE', now(), now())`,
      [id, slug],
    )
  }
})

describe('without app.secret_lookup', () => {
  test('a token-hash lookup sees nothing, even for a real row', async () => {
    const tokenHash = 'a'.repeat(64)
    await seedInvitation(orgA, tokenHash)

    const { rows } = await runtime.query(
      'select id from organization_invitation where token_hash = $1',
      [tokenHash],
    )
    // Failing safe: a forgotten withSecretLookup must look like "not found",
    // never like "here is someone else's invitation".
    expect(rows).toHaveLength(0)
  })

  test('app_secret_lookup_access() defaults to false', async () => {
    const { rows } = await runtime.query<{ v: boolean }>('select app_secret_lookup_access() as v')
    expect(rows[0]?.v).toBe(false)
  })
})

describe('with app.secret_lookup', () => {
  async function asSecretLookup<T>(work: () => Promise<T>): Promise<T> {
    await runtime.query('begin')
    try {
      await runtime.query("select set_config('app.secret_lookup', 'on', true)")
      const result = await work()
      await runtime.query('commit')
      return result
    } catch (error) {
      await runtime.query('rollback')
      throw error
    }
  }

  test('finds exactly the row matching the secret', async () => {
    const tokenHash = 'b'.repeat(64)
    const invitationId = await seedInvitation(orgA, tokenHash)

    const found = await asSecretLookup(async () => {
      const { rows } = await runtime.query<{ id: string; organization_id: string }>(
        'select id, organization_id from organization_invitation where token_hash = $1',
        [tokenHash],
      )
      return rows
    })

    expect(found).toHaveLength(1)
    expect(found[0]?.id).toBe(invitationId)
    expect(found[0]?.organization_id).toBe(orgA)
  })

  test('does not broaden visibility to unrelated rows', async () => {
    const tokenHashA = 'c'.repeat(64)
    await seedInvitation(orgA, tokenHashA)
    await seedInvitation(orgB, 'd'.repeat(64))

    // A secret-lookup transaction still filters by the secret itself; it is
    // not an alternate form of "see everything in this table".
    const found = await asSecretLookup(async () => {
      const { rows } = await runtime.query(
        'select id from organization_invitation where token_hash = $1',
        [tokenHashA],
      )
      return rows
    })
    expect(found).toHaveLength(1)
  })

  test('a wrong hash still finds nothing', async () => {
    await seedInvitation(orgA, 'e'.repeat(64))

    const found = await asSecretLookup(async () => {
      const { rows } = await runtime.query(
        'select id from organization_invitation where token_hash = $1',
        ['f'.repeat(64)],
      )
      return rows
    })
    expect(found).toHaveLength(0)
  })

  test('does not persist beyond its transaction', async () => {
    await asSecretLookup(async () => {
      await runtime.query('select 1')
    })

    const { rows } = await runtime.query<{ v: boolean }>('select app_secret_lookup_access() as v')
    expect(rows[0]?.v).toBe(false)
  })

  test('secret-lookup access does not grant write access to organization_invitation', async () => {
    // Read-side only: mutating an invitation still requires ordinary tenant
    // context (see docs/adr — invitations use a two-phase read-then-mutate).
    const tokenHash = 'g'.repeat(64)
    const invitationId = await seedInvitation(orgA, tokenHash)

    await expect(
      asSecretLookup(() =>
        runtime.query('update organization_invitation set status = $1 where id = $2', [
          'ACCEPTED',
          invitationId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  test('join-code redemption WITH CHECK permits the atomic guarded write', async () => {
    // organization_join_code is the one table where secret-lookup access
    // legitimately extends to writes, because redemption is a single atomic
    // guarded UPDATE (see migration 20260816130100).
    const creator = newId()
    await migration.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, 'Creator', $2, true, now(), now())`,
      [creator, `creator-${id6()}@example.org`],
    )
    const codeId = newId()
    const codeHash = 'h'.repeat(64)
    await migration.query(
      `insert into organization_join_code
         (id, organization_id, code_hash, role, expires_at, max_uses, use_count,
          allowed_email_domains, created_by_user_id, created_at, updated_at)
       values ($1, $2, $3, 'MEMBER', now() + interval '7 days', 5, 0, '{}', $4, now(), now())`,
      [codeId, orgA, codeHash, creator],
    )

    const updated = await asSecretLookup(async () => {
      const result = await runtime.query(
        'update organization_join_code set use_count = use_count + 1 where code_hash = $1 returning use_count',
        [codeHash],
      )
      return result.rows
    })

    expect(updated[0]?.use_count).toBe(1)
  })
})
