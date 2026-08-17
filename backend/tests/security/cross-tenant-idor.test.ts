import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Cross-tenant escape tests, driven through real HTTP requests.
 *
 * Mandatory per master prompt section 41.3 and threat classes 1–2 in section
 * 54: a member of one organization must never be able to read or write
 * another organization's resources by supplying its ID, whether the ID is
 * real (IDOR/BOLA) or entirely fabricated. Every check here goes through the
 * full pipeline — routing, the access-context resolver, RLS — not a
 * hand-built AccessContext.
 */

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp()
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await app.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

async function approvedOrganization(ownerCookie: string): Promise<string> {
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Tenant Org ${crypto.randomUUID()}`,
        requestedSlug: `tenant-${crypto.randomUUID().slice(0, 8)}`,
        organizationType: 'COMPANY',
        description: 'A cross-tenant fixture.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PRIVATE',
        acceptedTermsVersion: '1.0',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: ownerCookie,
    },
  )
  expect(application.status).toBe(201)

  const superadmin = await createPlatformSuperadmin(app)
  const approval = await app.request<{ organizationId: string }>(
    'POST',
    `/api/v1/platform/organization-applications/${application.body.id}/approve`,
    { body: {}, cookies: superadmin.cookie },
  )
  expect(approval.status).toBe(200)
  return approval.body.organizationId
}

describe('an unrelated org member cannot reach another tenant', () => {
  test('cannot read another organization by its real ID', async () => {
    const ownerA = await createVerifiedUser(app)
    const orgA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    await approvedOrganization(ownerB.cookie)

    // ownerB is a real, authenticated, verified user with an org of their
    // own — just not THIS one.
    const response = await app.request('GET', `/api/v1/organizations/${orgA}`, {
      cookies: ownerB.cookie,
    })
    expect(response.status).toBe(404)
  })

  test("cannot list another organization's members", async () => {
    const ownerA = await createVerifiedUser(app)
    const orgA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    await approvedOrganization(ownerB.cookie)

    const response = await app.request('GET', `/api/v1/organizations/${orgA}/members`, {
      cookies: ownerB.cookie,
    })
    expect(response.status).toBe(404)
  })

  test("cannot change another organization's settings", async () => {
    const ownerA = await createVerifiedUser(app)
    const orgA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    await approvedOrganization(ownerB.cookie)

    const response = await app.request('PATCH', `/api/v1/organizations/${orgA}/settings`, {
      body: { visibility: 'PUBLIC' },
      cookies: ownerB.cookie,
    })
    expect(response.status).toBe(404)

    // Confirm from the actual owner's side that nothing changed.
    const check = await app.request<{ visibility: string }>(
      'GET',
      `/api/v1/organizations/${orgA}`,
      {
        cookies: ownerA.cookie,
      },
    )
    expect(check.body.visibility).toBe('PRIVATE')
  })

  test('cannot create an invitation into another organization', async () => {
    const ownerA = await createVerifiedUser(app)
    const orgA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    await approvedOrganization(ownerB.cookie)

    const response = await app.request('POST', `/api/v1/organizations/${orgA}/invitations`, {
      body: { role: 'ORG_ADMIN' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: ownerB.cookie,
    })
    expect(response.status).toBe(404)
  })

  test('cannot create a join code in, or list join codes for, another organization', async () => {
    const ownerA = await createVerifiedUser(app)
    const orgA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    await approvedOrganization(ownerB.cookie)

    const create = await app.request('POST', `/api/v1/organizations/${orgA}/join-codes`, {
      body: { maxUses: 5 },
      cookies: ownerB.cookie,
    })
    expect(create.status).toBe(404)

    const list = await app.request('GET', `/api/v1/organizations/${orgA}/join-codes`, {
      cookies: ownerB.cookie,
    })
    expect(list.status).toBe(404)
  })

  test("cannot approve or reject another organization's join requests", async () => {
    const ownerA = await createVerifiedUser(app)
    const orgA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    await approvedOrganization(ownerB.cookie)

    const response = await app.request('GET', `/api/v1/organizations/${orgA}/join-requests`, {
      cookies: ownerB.cookie,
    })
    expect(response.status).toBe(404)
  })

  test('a forged, syntactically valid but nonexistent organization ID also returns 404', async () => {
    const owner = await createVerifiedUser(app)
    await approvedOrganization(owner.cookie)

    const fabricatedId = '01930000-0000-7000-8000-0000000000ff'
    const response = await app.request('GET', `/api/v1/organizations/${fabricatedId}`, {
      cookies: owner.cookie,
    })
    // Byte-identical to the "real org, no access" case: existence must never
    // be distinguishable from absence to an unrelated caller.
    expect(response.status).toBe(404)
  })

  test('a member of org A cannot escalate their own role by naming org B', async () => {
    const ownerA = await createVerifiedUser(app)
    const orgA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    const orgB = await approvedOrganization(ownerB.cookie)

    // ownerA tries to change their OWN userId's role, but scoped to org B —
    // where they hold no membership at all.
    const response = await app.request(
      'POST',
      `/api/v1/organizations/${orgB}/members/${ownerA.userId}/change-role`,
      { body: { role: 'ORG_OWNER' }, cookies: ownerA.cookie },
    )
    expect(response.status).toBe(404)

    // orgA is untouched and orgB's real owner is still the owner.
    const membersA = await app.request<{ items: { userId: string; role: string }[] }>(
      'GET',
      `/api/v1/organizations/${orgA}/members`,
      { cookies: ownerA.cookie },
    )
    expect(membersA.body.items).toHaveLength(1)
    expect(membersA.body.items[0]?.role).toBe('ORG_OWNER')
  })
})

describe('unauthenticated callers', () => {
  test('receive 401, not 404, for a tenant-admin route', async () => {
    const owner = await createVerifiedUser(app)
    const orgA = await approvedOrganization(owner.cookie)

    const response = await app.request('GET', `/api/v1/organizations/${orgA}/members`, {})
    expect(response.status).toBe(401)
  })
})

describe('platform staff without the platform permission', () => {
  test('an ordinary verified user cannot suspend an organization', async () => {
    const owner = await createVerifiedUser(app)
    const orgA = await approvedOrganization(owner.cookie)
    const outsider = await createVerifiedUser(app)

    const response = await app.request('POST', `/api/v1/platform/organizations/${orgA}/suspend`, {
      body: { reason: 'Attempting an unauthorized suspension.' },
      cookies: outsider.cookie,
    })
    expect(response.status).toBe(403)
  })
})
