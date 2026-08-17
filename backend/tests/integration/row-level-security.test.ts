import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { newId } from '../../src/shared/ids'
import { connectMigrationSql, connectRuntimeSql, resetDatabase } from '../helpers/test-database'
import { createTestInfrastructure, type TestInfrastructure } from '../helpers/test-infrastructure'

/**
 * Row-level security, proven against real PostgreSQL.
 *
 * This is the layer that catches the mistake application review cannot: a
 * repository method that forgets its tenant predicate. The tests below assert
 * the database's behaviour, not the application's, so they would fail if RLS
 * were disabled even while every application-level test still passed.
 *
 * Threat classes 1, 2, 18 and 19 from master prompt section 54.
 */

let infrastructure: TestInfrastructure
let runtime: Client
let migration: Client

const alpha = newId()
const beta = newId()

/** Seed two organizations as the schema owner, bypassing RLS deliberately. */
async function seedTenants(): Promise<void> {
  for (const [id, slug, name] of [
    [alpha, `alpha-${id6()}`, 'Alpha Innovation Lab'],
    [beta, `beta-${id6()}`, 'Beta Innovation Hub'],
  ] as const) {
    await migration.query(
      `insert into organization (id, slug, name, organization_type, status, visibility,
                                 created_at, updated_at)
       values ($1, $2, $3, 'UNIVERSITY_CLUB', 'ACTIVE', 'PRIVATE', now(), now())`,
      [id, slug, name],
    )
    await migration.query(
      `insert into organization_settings (organization_id, join_policy, allowed_email_domains,
                                          created_at, updated_at)
       values ($1, 'INVITE_ONLY', '{}', now(), now())`,
      [id],
    )
  }
}

function id6(): string {
  return Math.random().toString(36).slice(2, 8)
}

beforeAll(async () => {
  infrastructure = await createTestInfrastructure()
  runtime = await connectRuntimeSql()
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await runtime.end()
  await migration.end()
  await infrastructure.dispose()
})

beforeEach(async () => {
  await resetDatabase(migration)
  await seedTenants()
})

describe('without tenant context', () => {
  test('the runtime role sees no organizations at all', async () => {
    // The failure mode of a forgotten `set_config` must be "returns nothing",
    // never "returns everything".
    const { rows } = await runtime.query<{ count: string }>(
      'select count(*)::text as count from organization',
    )
    expect(rows[0]?.count).toBe('0')
  })

  test('the runtime role sees no settings, memberships, invitations or codes', async () => {
    for (const table of [
      'organization_settings',
      'organization_membership',
      'organization_invitation',
      'organization_join_code',
      'organization_join_request',
    ]) {
      const { rows } = await runtime.query<{ count: string }>(
        `select count(*)::text as count from ${table}`,
      )
      expect(rows[0]?.count).toBe('0')
    }
  })

  test('the runtime role cannot insert a row it would not be able to read', async () => {
    // WITH CHECK closes the write side: a tenant cannot plant a row into
    // another tenant, or into no tenant at all.
    await expect(
      runtime.query(
        `insert into organization (id, slug, name, organization_type, status, visibility,
                                   created_at, updated_at)
         values ($1, $2, 'Smuggled', 'COMPANY', 'ACTIVE', 'PUBLIC', now(), now())`,
        [newId(), `smuggled-${id6()}`],
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  test('a raw worker connection cannot enumerate tenant outbox records', async () => {
    for (const organizationId of [alpha, beta]) {
      await migration.query(
        `insert into outbox_event
           (id, organization_id, event_type, queue_name, aggregate_type, payload,
            dedupe_key, created_at, updated_at)
         values ($1, $2, 'test.rls', 'email', 'test', '{}'::jsonb, $3, now(), now())`,
        [newId(), organizationId, `test-rls:${organizationId}`],
      )
    }

    const { rows } = await runtime.query<{ count: string }>(
      'select count(*)::text as count from outbox_event',
    )
    expect(rows[0]?.count).toBe('0')
  })
})

describe('with tenant context', () => {
  /** Run a query as the runtime role inside a transaction scoped to one tenant. */
  async function asTenant<T>(organizationId: string, work: () => Promise<T>): Promise<T> {
    await runtime.query('begin')
    try {
      await runtime.query("select set_config('app.organization_id', $1, true)", [organizationId])
      const result = await work()
      await runtime.query('commit')
      return result
    } catch (error) {
      await runtime.query('rollback')
      throw error
    }
  }

  test('sees only its own organization', async () => {
    const visible = await asTenant(alpha, async () => {
      const { rows } = await runtime.query<{ id: string }>('select id from organization')
      return rows.map((row) => row.id)
    })

    expect(visible).toEqual([alpha])
    expect(visible).not.toContain(beta)
  })

  test('a direct lookup of another tenant by primary key returns nothing', async () => {
    // The IDOR case: an attacker who has learned a valid identifier from
    // another organization still gets nothing back.
    const found = await asTenant(alpha, async () => {
      const { rows } = await runtime.query('select id from organization where id = $1', [beta])
      return rows.length
    })

    expect(found).toBe(0)
  })

  test('cannot update another tenant', async () => {
    const updated = await asTenant(alpha, async () => {
      const result = await runtime.query('update organization set name = $1 where id = $2', [
        'Hijacked',
        beta,
      ])
      return result.rowCount
    })

    expect(updated).toBe(0)

    // Confirm from outside RLS that the row really is untouched.
    const { rows } = await migration.query<{ name: string }>(
      'select name from organization where id = $1',
      [beta],
    )
    expect(rows[0]?.name).toBe('Beta Innovation Hub')
  })

  test('cannot delete another tenant', async () => {
    const deleted = await asTenant(alpha, async () => {
      const result = await runtime.query('delete from organization where id = $1', [beta])
      return result.rowCount
    })

    expect(deleted).toBe(0)

    const { rows } = await migration.query<{ count: string }>(
      'select count(*)::text as count from organization where id = $1',
      [beta],
    )
    expect(rows[0]?.count).toBe('1')
  })

  test('cannot insert a child row belonging to another tenant', async () => {
    // The write-side of cross-tenant contamination: planting a membership into
    // an organization the caller does not control.
    await expect(
      asTenant(alpha, () =>
        runtime.query(
          `insert into organization_membership
             (id, organization_id, user_id, role, status, source, joined_at, created_at, updated_at)
           values ($1, $2, $3, 'ORG_OWNER', 'ACTIVE', 'INVITATION', now(), now(), now())`,
          [newId(), beta, newId()],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  test("tenant context exposes only that tenant's infrastructure obligations", async () => {
    for (const organizationId of [alpha, beta]) {
      await migration.query(
        `insert into outbox_event
           (id, organization_id, event_type, queue_name, aggregate_type, payload,
            dedupe_key, created_at, updated_at)
         values ($1, $2, 'test.tenant_infra', 'email', 'test', '{}'::jsonb, $3, now(), now())`,
        [newId(), organizationId, `test-tenant-infra:${organizationId}`],
      )
    }

    const visible = await asTenant(alpha, async () => {
      const { rows } = await runtime.query<{ organization_id: string }>(
        'select organization_id from outbox_event',
      )
      return rows.map((row) => row.organization_id)
    })
    expect(visible).toEqual([alpha])
  })

  test('media metadata is visible only through its actor or tenant context', async () => {
    const ownerA = newId()
    const ownerB = newId()
    const avatarA = newId()
    const avatarB = newId()
    const logoA = newId()
    const logoB = newId()
    for (const [id, suffix] of [
      [ownerA, 'a'],
      [ownerB, 'b'],
    ] as const) {
      await migration.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at)
         values ($1, 'Media RLS Owner', $2, true, now(), now())`,
        [id, `media-rls-${suffix}-${id6()}@example.org`],
      )
    }
    for (const [id, purpose, organizationId, ownerId, resourceType, resourceId] of [
      [avatarA, 'USER_AVATAR', null, ownerA, 'user', ownerA],
      [avatarB, 'USER_AVATAR', null, ownerB, 'user', ownerB],
      [logoA, 'ORGANIZATION_LOGO', alpha, ownerA, 'organization', alpha],
      [logoB, 'ORGANIZATION_LOGO', beta, ownerB, 'organization', beta],
    ] as const) {
      await migration.query(
        `insert into media_asset
           (id, purpose, status, delivery_type, organization_id, owner_user_id,
            resource_type, resource_id, cloudinary_public_id, expires_at, created_at)
         values ($1, $2, 'PENDING', 'AUTHENTICATED', $3, $4, $5, $6, $7,
                 now() + interval '1 hour', now())`,
        [id, purpose, organizationId, ownerId, resourceType, resourceId, `media-rls/${id}`],
      )
    }

    const noContext = await runtime.query<{ id: string }>('select id from media_asset')
    expect(noContext.rows).toEqual([])

    const visible = await asTenant(alpha, async () => {
      await runtime.query("select set_config('app.actor_user_id', $1, true)", [ownerA])
      const { rows } = await runtime.query<{ id: string }>('select id from media_asset order by id')
      return rows.map((row) => row.id)
    })
    expect(visible).toEqual([avatarA, logoA].sort())
    expect(visible).not.toContain(avatarB)
    expect(visible).not.toContain(logoB)

    await expect(
      asTenant(alpha, async () => {
        await runtime.query("select set_config('app.actor_user_id', $1, true)", [ownerA])
        await runtime.query('update media_asset set owner_user_id = $1 where id = $2', [
          ownerB,
          logoA,
        ])
      }),
    ).rejects.toThrow(/authorization scope is immutable/i)

    await expect(
      asTenant(alpha, async () => {
        await runtime.query("select set_config('app.actor_user_id', $1, true)", [ownerA])
        await runtime.query('update media_asset set resource_id = $1 where id = $2', [beta, logoA])
      }),
    ).rejects.toThrow(/authorization scope is immutable/i)

    // The database, not only the route, binds a support screenshot to the
    // ticket creator and the ticket's exact optional organization context.
    const supportTicketId = newId()
    await migration.query(
      `insert into support_ticket
         (id, user_id, organization_id, category, subject, description, created_at, updated_at)
       values ($1, $2, $3, 'BUG', 'Screenshot scope', 'Exact binding fixture', now(), now())`,
      [supportTicketId, ownerA, alpha],
    )
    await expect(
      migration.query(
        `insert into media_asset
           (id, purpose, status, delivery_type, organization_id, owner_user_id,
            resource_type, resource_id, cloudinary_public_id, expires_at, created_at)
         values ($1, 'SUPPORT_TICKET_SCREENSHOT', 'PENDING', 'AUTHENTICATED', $2, $3,
                 'support_ticket', $4, $5, now() + interval '1 hour', now())`,
        [newId(), beta, ownerB, supportTicketId, `media-rls/support-${newId()}`],
      ),
    ).rejects.toThrow(/support-ticket binding is outside its authorization scope/i)

    // Attachment is also a database invariant: pending assets cannot be
    // consumed, while a confirmed exact-resource authorization can be.
    await expect(
      asTenant(alpha, async () => {
        await runtime.query("select set_config('app.actor_user_id', $1, true)", [ownerA])
        await runtime.query('update organization set logo_asset_id = $1 where id = $2', [
          logoA,
          alpha,
        ])
      }),
    ).rejects.toThrow(/not confirmed for this exact resource/i)

    await migration.query(
      `update media_asset
       set status = 'CONFIRMED', format = 'png', bytes = 128, width = 16, height = 16,
           confirmed_at = now()
       where id = $1`,
      [logoA],
    )
    await asTenant(alpha, async () => {
      await runtime.query("select set_config('app.actor_user_id', $1, true)", [ownerA])
      await runtime.query('update organization set logo_asset_id = $1 where id = $2', [
        logoA,
        alpha,
      ])
    })

    // Same-tenant is not sufficient: a challenge-cover authorization for one
    // challenge cannot be attached to another challenge in that organization.
    const challengeA = newId()
    const challengeB = newId()
    const coverA = newId()
    await migration.query(
      `insert into challenge
         (id, organization_id, title, slug, created_by_user_id, updated_at)
       values ($1, $3, 'Media challenge A', $4, $5, now()),
              ($2, $3, 'Media challenge B', $6, $5, now())`,
      [challengeA, challengeB, alpha, `media-a-${id6()}`, ownerA, `media-b-${id6()}`],
    )
    await migration.query(
      `insert into media_asset
         (id, purpose, status, delivery_type, organization_id, challenge_id, owner_user_id,
          resource_type, resource_id, cloudinary_public_id, format, bytes, width, height,
          expires_at, confirmed_at, created_at)
       values ($1, 'CHALLENGE_COVER', 'CONFIRMED', 'AUTHENTICATED', $2, $3, $4,
               'challenge', $3, $5, 'png', 128, 16, 16, now() + interval '1 hour', now(), now())`,
      [coverA, alpha, challengeA, ownerA, `media-rls/${coverA}`],
    )
    await asTenant(alpha, async () => {
      await runtime.query("select set_config('app.actor_user_id', $1, true)", [ownerA])
      await runtime.query('update challenge set cover_asset_id = $1 where id = $2', [
        coverA,
        challengeA,
      ])
    })
    await expect(
      asTenant(alpha, async () => {
        await runtime.query("select set_config('app.actor_user_id', $1, true)", [ownerA])
        await runtime.query('update challenge set cover_asset_id = $1 where id = $2', [
          coverA,
          challengeB,
        ])
      }),
    ).rejects.toThrow(/not confirmed for this exact resource/i)
  })
})

describe('with platform access', () => {
  test('an explicitly authorized platform transaction sees every tenant', async () => {
    const visible = await infrastructure.transactions.withPlatformAccess(
      async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`select id from organization`
        return rows.map((row) => row.id)
      },
      { purpose: 'integration test: platform organization administration' },
    )

    expect(visible).toContain(alpha)
    expect(visible).toContain(beta)
  })

  test('platform access does not persist beyond its transaction', async () => {
    await infrastructure.transactions.withPlatformAccess(
      async (tx) => {
        await tx.$queryRaw`select count(*) from organization`
      },
      { purpose: 'integration test: verifying platform access is transaction-local' },
    )

    // The next operation on the same pool must be back to deny-by-default.
    const afterwards = await infrastructure.transactions.withoutTenant(async (tx) => {
      const rows = await tx.$queryRaw<{ count: bigint }[]>`
        select count(*)::bigint as count from organization
      `
      return Number(rows[0]?.count ?? 0n)
    })

    expect(afterwards).toBe(0)
  })
})

describe('constraints the database enforces', () => {
  test('organization slugs are unique case-insensitively', async () => {
    const slug = `duplicate-${id6()}`
    await migration.query(
      `insert into organization (id, slug, name, organization_type, status, visibility,
                                 created_at, updated_at)
       values ($1, $2, 'First', 'COMPANY', 'ACTIVE', 'PUBLIC', now(), now())`,
      [newId(), slug],
    )

    // "Acme" and "acme" must not be different organizations: that is an
    // impersonation vector as much as a collision.
    await expect(
      migration.query(
        `insert into organization (id, slug, name, organization_type, status, visibility,
                                   created_at, updated_at)
         values ($1, $2, 'Second', 'COMPANY', 'ACTIVE', 'PUBLIC', now(), now())`,
        [newId(), slug.toUpperCase()],
      ),
    ).rejects.toThrow(/duplicate key|unique/i)
  })

  test('the reserved OPEN join policy cannot be activated', async () => {
    await expect(
      migration.query(
        'update organization_settings set join_policy = $1 where organization_id = $2',
        ['OPEN', alpha],
      ),
    ).rejects.toThrow(/organization_join_policy_open_not_activatable_chk/i)
  })

  test('a join code cannot be used more times than its limit', async () => {
    const codeId = newId()
    const creator = newId()
    await migration.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, 'Creator', $2, true, now(), now())`,
      [creator, `creator-${id6()}@example.org`],
    )
    await migration.query(
      `insert into organization_join_code
         (id, organization_id, code_hash, role, expires_at, max_uses, use_count,
          allowed_email_domains, created_by_user_id, created_at, updated_at)
       values ($1, $2, $3, 'MEMBER', now() + interval '7 days', 2, 0, '{}', $4, now(), now())`,
      [codeId, alpha, 'a'.repeat(64), creator],
    )

    await expect(
      migration.query('update organization_join_code set use_count = 3 where id = $1', [codeId]),
    ).rejects.toThrow(/join_code_use_count_within_limit_chk/i)
  })

  test('an invitation must expire in the future', async () => {
    const creator = newId()
    await migration.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, 'Creator', $2, true, now(), now())`,
      [creator, `creator-${id6()}@example.org`],
    )

    // An invitation without a future expiry is a permanent credential.
    await expect(
      migration.query(
        `insert into organization_invitation
           (id, organization_id, token_hash, role, status, expires_at, created_by_user_id,
            resend_count, created_at, updated_at)
         values ($1, $2, $3, 'MEMBER', 'PENDING', now() - interval '1 day', $4, 0, now(), now())`,
        [newId(), alpha, 'b'.repeat(64), creator],
      ),
    ).rejects.toThrow(/invitation_expiry_after_creation_chk/i)
  })

  test('only one pending join request per user per organization', async () => {
    const user = newId()
    await migration.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, 'Requester', $2, true, now(), now())`,
      [user, `requester-${id6()}@example.org`],
    )

    const insertRequest = () =>
      migration.query(
        `insert into organization_join_request
           (id, organization_id, user_id, status, created_at, updated_at)
         values ($1, $2, $3, 'PENDING', now(), now())`,
        [newId(), alpha, user],
      )

    await insertRequest()
    await expect(insertRequest()).rejects.toThrow(/duplicate key|unique/i)
  })

  test('a claimed skill is either a catalogue reference or a custom value, never both', async () => {
    const user = newId()
    await migration.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, 'Skilled', $2, true, now(), now())`,
      [user, `skilled-${id6()}@example.org`],
    )

    const skillId = newId()
    await migration.query(
      `insert into skill (id, name, slug, active, created_at)
       values ($1, 'TypeScript', $2, true, now())`,
      [skillId, `typescript-${id6()}`],
    )

    await expect(
      migration.query(
        `insert into user_skill (id, user_id, skill_id, custom_name, created_at)
         values ($1, $2, $3, 'TypeScript', now())`,
        [newId(), user, skillId],
      ),
    ).rejects.toThrow(/user_skill_exactly_one_source_chk/i)

    await expect(
      migration.query(
        `insert into user_skill (id, user_id, skill_id, custom_name, created_at)
         values ($1, $2, null, null, now())`,
        [newId(), user],
      ),
    ).rejects.toThrow(/user_skill_exactly_one_source_chk/i)
  })
})
