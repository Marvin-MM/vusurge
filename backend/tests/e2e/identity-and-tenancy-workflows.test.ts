import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 1 critical workflows (master prompt section 41.6, items 1–4, 17):
 *
 *   1. signup → verify → accept organization invitation
 *   2. signup → optional join-code onboarding
 *   3. a user with zero organizations remains valid indefinitely
 *   4. apply for organization → platform approval → owner membership
 *  17. a private organization never appears in public search/listing
 *
 * Every step goes through the real HTTP pipeline — Elysia routing, the
 * mounted Better Auth handler, the access-context resolver, RLS — the same
 * path a production request takes.
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
  // Other test files in this same run leave PENDING outbox rows behind with
  // synthetic event types (e.g. "test.serializable") that no real handler
  // knows about. flushOutbox processes every pending row it finds, so this
  // suite needs a clean slate rather than tripping over unrelated fixtures.
  await resetDatabase(migration)
})

async function approvedOrganization(
  ownerCookie: string,
  visibility: 'PRIVATE' | 'PUBLIC' = 'PRIVATE',
): Promise<{ organizationId: string; slug: string }> {
  const slug = `workflow-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Workflow Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'An end-to-end workflow fixture.',
        requesterRelationship: 'Founder',
        requestedVisibility: visibility,
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

  return { organizationId: approval.body.organizationId, slug }
}

describe('workflow 1: signup → verify → accept organization invitation', () => {
  test('an invited user becomes an active member with the invited role', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)

    const invitee = await createVerifiedUser(app)

    const invitation = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/invitations`,
      {
        body: { email: invitee.email, role: 'CHALLENGE_MANAGER' },
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: owner.cookie,
      },
    )
    expect(invitation.status).toBe(201)

    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(invitee.email)
    expect(sent).toBeDefined()
    const acceptUrl = app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>)
    const token = new URL(acceptUrl).pathname.split('/').at(-2)
    expect(token).toBeTruthy()

    const accept = await app.request<{ organizationId: string }>(
      'POST',
      `/api/v1/invitations/${token}/accept`,
      { cookies: invitee.cookie },
    )
    expect(accept.status).toBe(200)
    expect(accept.body.organizationId).toBe(organizationId)

    const membership = await app.request<{ items: { userId: string; role: string }[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/members`,
      { cookies: owner.cookie },
    )
    const invited = membership.body.items.find((m) => m.userId === invitee.userId)
    expect(invited?.role).toBe('CHALLENGE_MANAGER')
  })

  test('a second acceptance attempt with the same token is rejected', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const invitee = await createVerifiedUser(app)

    await app.request('POST', `/api/v1/organizations/${organizationId}/invitations`, {
      body: { email: invitee.email, role: 'MEMBER' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    })
    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(invitee.email)
    const token = new URL(
      app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>),
    ).pathname
      .split('/')
      .at(-2)

    const first = await app.request('POST', `/api/v1/invitations/${token}/accept`, {
      cookies: invitee.cookie,
    })
    expect(first.status).toBe(200)

    const second = await app.request('POST', `/api/v1/invitations/${token}/accept`, {
      cookies: invitee.cookie,
    })
    expect(second.status).toBe(409)
  })

  test('an invitation email-bound to someone else is refused', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const invitee = await createVerifiedUser(app)
    const impostor = await createVerifiedUser(app)

    await app.request('POST', `/api/v1/organizations/${organizationId}/invitations`, {
      body: { email: invitee.email, role: 'MEMBER' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    })
    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(invitee.email)
    const token = new URL(
      app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>),
    ).pathname
      .split('/')
      .at(-2)

    const response = await app.request('POST', `/api/v1/invitations/${token}/accept`, {
      cookies: impostor.cookie,
    })
    expect(response.status).toBe(403)
  })
})

describe('workflow 2: signup with optional join-code onboarding', () => {
  test('a fresh user can redeem a join code immediately after verifying', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)

    const joinCode = await app.request<{ plaintextCode: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/join-codes`,
      { body: { maxUses: 5 }, cookies: owner.cookie },
    )
    expect(joinCode.status).toBe(200)

    const newcomer = await createVerifiedUser(app)
    const redemption = await app.request('POST', '/api/v1/join-codes/redeem', {
      body: { code: joinCode.body.plaintextCode },
      cookies: newcomer.cookie,
    })
    expect(redemption.status).toBe(200)

    const me = await app.request<{ organizationId: string; role: string }[]>(
      'GET',
      '/api/v1/me/organizations',
      { cookies: newcomer.cookie },
    )
    expect(me.body.some((entry) => entry.organizationId === organizationId)).toBe(true)
  })
})

describe('workflow 3: a user with zero organizations remains valid', () => {
  test('an authenticated user with no memberships can still use the platform', async () => {
    const lonely = await createVerifiedUser(app)

    const me = await app.request<{ platformRole: string | null }>('GET', '/api/v1/me', {
      cookies: lonely.cookie,
    })
    expect(me.status).toBe(200)
    expect(me.body.platformRole).toBeNull()

    const organizations = await app.request<unknown[]>('GET', '/api/v1/me/organizations', {
      cookies: lonely.cookie,
    })
    expect(organizations.status).toBe(200)
    expect(organizations.body).toEqual([])

    // Every ordinary authenticated capability remains available.
    const profile = await app.request('PATCH', '/api/v1/me/profile', {
      body: { displayName: 'Still Valid' },
      cookies: lonely.cookie,
    })
    expect(profile.status).toBe(200)
  })
})

describe('workflow 4: apply for organization → platform approval → owner membership', () => {
  test('approval creates an active organization and grants the applicant ORG_OWNER', async () => {
    const applicant = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(applicant.cookie)

    const org = await app.request<{ status: string }>(
      'GET',
      `/api/v1/organizations/${organizationId}`,
      { cookies: applicant.cookie },
    )
    expect(org.status).toBe(200)
    expect(org.body.status).toBe('ACTIVE')

    const members = await app.request<{ items: { userId: string; role: string }[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/members`,
      { cookies: applicant.cookie },
    )
    const ownerMembership = members.body.items.find((m) => m.userId === applicant.userId)
    expect(ownerMembership?.role).toBe('ORG_OWNER')
  })

  test('rejection leaves the applicant without any organization', async () => {
    const applicant = await createVerifiedUser(app)

    const application = await app.request<{ id: string }>(
      'POST',
      '/api/v1/organization-applications',
      {
        body: {
          name: `Rejected Org ${crypto.randomUUID()}`,
          requestedSlug: `rejected-${crypto.randomUUID().slice(0, 8)}`,
          organizationType: 'COMPANY',
          description: 'Should be rejected.',
          requesterRelationship: 'Founder',
          requestedVisibility: 'PRIVATE',
          acceptedTermsVersion: '1.0',
        },
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: applicant.cookie,
      },
    )

    const superadmin = await createPlatformSuperadmin(app)
    const rejection = await app.request(
      'POST',
      `/api/v1/platform/organization-applications/${application.body.id}/reject`,
      {
        body: { reason: 'Does not meet platform criteria at this time.' },
        cookies: superadmin.cookie,
      },
    )
    expect(rejection.status).toBe(204)

    const organizations = await app.request<unknown[]>('GET', '/api/v1/me/organizations', {
      cookies: applicant.cookie,
    })
    expect(organizations.body).toEqual([])

    await flushOutbox(app.infrastructure)
    const decisionEmail = app.infrastructure.fakeEmail.latestTo(applicant.email)
    expect(decisionEmail?.subject).toContain('update on your application')
  })
})

describe('workflow 17 (Phase 1 portion): private organizations never appear publicly', () => {
  test('a private organization is absent from the public listing and lookup', async () => {
    const owner = await createVerifiedUser(app)
    const { slug } = await approvedOrganization(owner.cookie, 'PRIVATE')

    const listing = await app.request<{ items: { slug: string }[] }>(
      'GET',
      '/api/v1/public/organizations',
      {},
    )
    expect(listing.body.items.some((entry) => entry.slug === slug)).toBe(false)

    const direct = await app.request('GET', `/api/v1/public/organizations/${slug}`, {})
    expect(direct.status).toBe(404)
  })

  test('a public organization does appear, and disappears the instant it is made private', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId, slug } = await approvedOrganization(owner.cookie, 'PUBLIC')

    const before = await app.request('GET', `/api/v1/public/organizations/${slug}`, {})
    expect(before.status).toBe(200)

    const patch = await app.request('PATCH', `/api/v1/organizations/${organizationId}/settings`, {
      body: { visibility: 'PRIVATE' },
      cookies: owner.cookie,
    })
    expect(patch.status).toBe(200)

    const after = await app.request('GET', `/api/v1/public/organizations/${slug}`, {})
    expect(after.status).toBe(404)
  })
})
