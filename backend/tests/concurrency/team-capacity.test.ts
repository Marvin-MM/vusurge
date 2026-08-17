import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Proves master prompt section 14's concurrency requirement for real: "two
 * users must not both take the last available slot." Two invitees accept
 * concurrently for a team with exactly one open slot; `lockTeamForUpdate`
 * (a `SELECT ... FOR UPDATE` inside the accept transaction) must serialize
 * them so only one acceptance succeeds.
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
  const slug = `capacity-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Capacity Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A team-capacity concurrency fixture organization.',
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

async function approvedParticipant(organizationId: string, challengeId: string) {
  const user = await createVerifiedUser(app)
  const registered = await app.request<{ status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: user.cookie },
  )
  expect(registered.body.status).toBe('APPROVED')
  return user
}

test('two concurrent invitation acceptances cannot both take the last team slot', async () => {
  const owner = await createVerifiedUser(app)
  const organizationId = await approvedOrganization(owner.cookie)

  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Capacity Challenge',
        slug: `capacity-challenge-${crypto.randomUUID().slice(0, 6)}`,
        participationPolicy: 'OPEN_AUTHENTICATED',
        maxTeamSize: 2,
        minTeamSize: 1,
      },
      cookies: owner.cookie,
    },
  )
  const challengeId = created.body.id
  const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
    { body: { submissionDeadline, reason: 'Set the initial deadline.' }, cookies: owner.cookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
    { body: {}, cookies: owner.cookie },
  )

  const captain = await approvedParticipant(organizationId, challengeId)
  const invitee1 = await approvedParticipant(organizationId, challengeId)
  const invitee2 = await approvedParticipant(organizationId, challengeId)

  const team = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
    { body: { name: 'Last Slot Team' }, cookies: captain.cookie },
  )

  // maxTeamSize is 2 and the captain already occupies one slot: exactly one
  // slot remains, and both invitees will race for it.
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/invitations`,
    { body: { userId: invitee1.userId }, cookies: captain.cookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/invitations`,
    { body: { userId: invitee2.userId }, cookies: captain.cookie },
  )

  await flushOutbox(app.infrastructure)

  function tokenFor(email: string): string {
    const sent = app.infrastructure.fakeEmail.latestTo(email)
    if (sent === undefined) throw new Error(`No invitation email sent to ${email}`)
    const url = app.infrastructure.fakeEmail.extractUrl(sent)
    const token = new URL(url).pathname.split('/').at(-2)
    if (token === undefined) throw new Error('No token in invitation URL')
    return token
  }

  const token1 = tokenFor(invitee1.email)
  const token2 = tokenFor(invitee2.email)

  const [result1, result2] = await Promise.all([
    app.request('POST', `/api/v1/team-invitations/${token1}/accept`, { cookies: invitee1.cookie }),
    app.request('POST', `/api/v1/team-invitations/${token2}/accept`, { cookies: invitee2.cookie }),
  ])

  const statuses = [result1.status, result2.status].sort()
  expect(statuses).toEqual([200, 409])

  const finalTeam = await app.request<{ members: unknown[] }>(
    'GET',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}`,
    { cookies: captain.cookie },
  )
  expect(finalTeam.body.members).toHaveLength(2)
})
