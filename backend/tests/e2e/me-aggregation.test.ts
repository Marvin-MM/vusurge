import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * The `/me/*` cross-organization aggregation endpoints (route-audit gap
 * fix): a user's challenge participations, team invitations, and challenge
 * staff (judge/mentor) invitations, each spanning every organization the
 * caller has any relationship to — the same structural situation as
 * `/me/organizations`, resolved through narrow self-only database functions.
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
  const slug = `me-agg-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Me Aggregation Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A /me aggregation fixture organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PRIVATE',
        acceptedTermsVersion: '1.0',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: ownerCookie,
    },
  )
  const superadmin = await createPlatformSuperadmin(app)
  const approval = await app.request<{ organizationId: string }>(
    'POST',
    `/api/v1/platform/organization-applications/${application.body.id}/approve`,
    { body: {}, cookies: superadmin.cookie },
  )
  return approval.body.organizationId
}

async function openChallenge(
  organizationId: string,
  ownerCookie: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Aggregation Challenge',
        slug: `me-agg-challenge-${crypto.randomUUID().slice(0, 6)}`,
        participationPolicy: 'OPEN_AUTHENTICATED',
        maxTeamSize: 3,
        minTeamSize: 1,
        ...overrides,
      },
      cookies: ownerCookie,
    },
  )
  const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${created.body.id}/reschedule`,
    { body: { submissionDeadline, reason: 'Set the initial deadline.' }, cookies: ownerCookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${created.body.id}/publish`,
    { body: {}, cookies: ownerCookie },
  )
  return created.body.id
}

describe('me: challenge participations', () => {
  test('lists a participation across an organization the caller does not belong to', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie)

    const applicant = await createVerifiedUser(app)
    const registered = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: applicant.cookie },
    )
    expect(registered.status).toBe(201)

    const mine = await app.request<
      { organizationId: string; challengeId: string; status: string }[]
    >('GET', '/api/v1/me/challenge-participations', { cookies: applicant.cookie })
    expect(mine.status).toBe(200)
    expect(mine.body).toHaveLength(1)
    expect(mine.body[0]?.organizationId).toBe(organizationId)
    expect(mine.body[0]?.challengeId).toBe(challengeId)
    expect(mine.body[0]?.status).toBe('APPROVED')

    const otherUser = await createVerifiedUser(app)
    const empty = await app.request<unknown[]>('GET', '/api/v1/me/challenge-participations', {
      cookies: otherUser.cookie,
    })
    expect(empty.body).toHaveLength(0)
  })
})

describe('me: team invitations', () => {
  test('lists a pending team invitation with the team name resolved', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie)

    const captain = await createVerifiedUser(app)
    const captainRegistered = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: captain.cookie },
    )
    expect(captainRegistered.status).toBe(201)

    const invitee = await createVerifiedUser(app)
    const inviteeRegistered = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: invitee.cookie },
    )
    expect(inviteeRegistered.status).toBe(201)

    const team = await app.request<{ id: string; name: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { body: { name: 'Aggregation Squad' }, cookies: captain.cookie },
    )
    expect(team.status).toBe(201)

    const invitation = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/invitations`,
      { body: { userId: invitee.userId }, cookies: captain.cookie },
    )
    expect(invitation.status).toBe(201)

    const mine = await app.request<
      { organizationId: string; teamId: string; teamName: string; status: string }[]
    >('GET', '/api/v1/me/team-invitations', { cookies: invitee.cookie })
    expect(mine.status).toBe(200)
    expect(mine.body).toHaveLength(1)
    expect(mine.body[0]?.organizationId).toBe(organizationId)
    expect(mine.body[0]?.teamId).toBe(team.body.id)
    expect(mine.body[0]?.teamName).toBe('Aggregation Squad')
    expect(mine.body[0]?.status).toBe('PENDING')
  })
})

describe('me: challenge staff invitations', () => {
  test('lists a pending judge invitation matched by email', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie)

    const judge = await createVerifiedUser(app)
    const invitation = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/staff-invitations`,
      { body: { role: 'JUDGE', email: judge.email }, cookies: owner.cookie },
    )
    expect(invitation.status).toBe(201)
    await flushOutbox(app.infrastructure)

    const mine = await app.request<
      { organizationId: string; challengeId: string; role: string; status: string }[]
    >('GET', '/api/v1/me/challenge-staff-invitations', { cookies: judge.cookie })
    expect(mine.status).toBe(200)
    expect(mine.body).toHaveLength(1)
    expect(mine.body[0]?.organizationId).toBe(organizationId)
    expect(mine.body[0]?.challengeId).toBe(challengeId)
    expect(mine.body[0]?.role).toBe('JUDGE')
    expect(mine.body[0]?.status).toBe('PENDING')

    const unrelatedUser = await createVerifiedUser(app)
    const empty = await app.request<unknown[]>('GET', '/api/v1/me/challenge-staff-invitations', {
      cookies: unrelatedUser.cookie,
    })
    expect(empty.body).toHaveLength(0)
  })
})
