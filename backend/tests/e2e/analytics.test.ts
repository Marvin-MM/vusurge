import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/** Organization analytics (master prompt section 24): overview, per-challenge summaries, and deep-dive. */

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

async function approvedOrganization(ownerCookie: string): Promise<{ organizationId: string }> {
  const slug = `analytics-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Analytics Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'An analytics-module fixture organization.',
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
  return { organizationId: approval.body.organizationId }
}

async function publishedChallenge(ownerCookie: string, organizationId: string) {
  const challengeSlug = `analytics-challenge-${crypto.randomUUID().slice(0, 8)}`
  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Analytics Fixture Challenge',
        slug: challengeSlug,
        participationPolicy: 'OPEN_AUTHENTICATED',
      },
      cookies: ownerCookie,
    },
  )
  const challengeId = created.body.id
  const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
    { body: { submissionDeadline, reason: 'Set the initial deadline.' }, cookies: ownerCookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
    { body: {}, cookies: ownerCookie },
  )
  return challengeId
}

test('analytics overview reflects registered/approved participants', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const challengeId = await publishedChallenge(owner.cookie, organizationId)

  const participant = await createVerifiedUser(app)
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: participant.cookie },
  )

  const overview = await app.request<{
    registrations: number
    approvedParticipants: number
    finalSubmissions: number
    completionRate: number
  }>('GET', `/api/v1/organizations/${organizationId}/analytics/overview`, { cookies: owner.cookie })
  expect(overview.status).toBe(200)
  expect(overview.body.registrations).toBe(1)
  // OPEN_AUTHENTICATED participation auto-approves.
  expect(overview.body.approvedParticipants).toBe(1)
  expect(overview.body.finalSubmissions).toBe(0)
  expect(overview.body.completionRate).toBe(0)
})

test('per-challenge summaries and the deep-dive endpoint report the same challenge', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const challengeId = await publishedChallenge(owner.cookie, organizationId)

  const summaries = await app.request<{ items: never } | { challengeId: string; title: string }[]>(
    'GET',
    `/api/v1/organizations/${organizationId}/analytics/challenges`,
    { cookies: owner.cookie },
  )
  expect(summaries.status).toBe(200)
  const list = summaries.body as { challengeId: string; title: string }[]
  expect(list.some((row) => row.challengeId === challengeId)).toBe(true)

  const deepDive = await app.request<{ submissionsPerTrack: unknown[]; registrations: number }>(
    'GET',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/analytics`,
    { cookies: owner.cookie },
  )
  expect(deepDive.status).toBe(200)
  expect(Array.isArray(deepDive.body.submissionsPerTrack)).toBe(true)
})

test('a plain member without AnalyticsViewOrg cannot read analytics', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const member = await createVerifiedUser(app)
  await app.request('POST', `/api/v1/organizations/${organizationId}/invitations`, {
    body: { email: member.email, role: 'MEMBER' },
    headers: { 'idempotency-key': crypto.randomUUID() },
    cookies: owner.cookie,
  })
  await flushOutbox(app.infrastructure)
  const sent = app.infrastructure.fakeEmail.latestTo(member.email)
  const token = new URL(
    app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>),
  ).pathname
    .split('/')
    .at(-2)
  const accepted = await app.request('POST', `/api/v1/invitations/${token}/accept`, {
    cookies: member.cookie,
  })
  expect(accepted.status).toBe(200)

  const overview = await app.request(
    'GET',
    `/api/v1/organizations/${organizationId}/analytics/overview`,
    { cookies: member.cookie },
  )
  expect(overview.status).toBe(403)
})

test('analytics for a nonexistent challenge in the organization is a 404', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const missing = await app.request(
    'GET',
    `/api/v1/organizations/${organizationId}/challenges/${crypto.randomUUID()}/analytics`,
    { cookies: owner.cookie },
  )
  expect(missing.status).toBe(404)
})
