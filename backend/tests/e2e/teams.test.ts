import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 3 challenge teams: creation, invitations (token accept/decline),
 * captain transfer, member removal, leave, and the organizer exception path
 * (master prompt section 14).
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

interface ApprovedParticipant {
  cookie: string
  userId: string
  email: string
}

async function setupOpenChallenge(maxTeamSize = 3): Promise<{
  owner: { cookie: string }
  organizationId: string
  challengeId: string
}> {
  const owner = await createVerifiedUser(app)
  const slug = `team-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Team Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A teams-module fixture organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PRIVATE',
        acceptedTermsVersion: '1.0',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  const superadmin = await createPlatformSuperadmin(app)
  const approval = await app.request<{ organizationId: string }>(
    'POST',
    `/api/v1/platform/organization-applications/${application.body.id}/approve`,
    { body: {}, cookies: superadmin.cookie },
  )
  const organizationId = approval.body.organizationId

  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Team Challenge',
        slug: `team-challenge-${crypto.randomUUID().slice(0, 6)}`,
        participationPolicy: 'OPEN_AUTHENTICATED',
        maxTeamSize,
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

  return { owner, organizationId, challengeId }
}

async function approvedParticipant(
  organizationId: string,
  challengeId: string,
): Promise<ApprovedParticipant> {
  const user = await createVerifiedUser(app)
  const registered = await app.request<{ status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: user.cookie },
  )
  expect(registered.body.status).toBe('APPROVED')
  return { cookie: user.cookie, userId: user.userId, email: user.email }
}

describe('teams', () => {
  test('create → invite → accept, with member listing hiding no private data', async () => {
    const { organizationId, challengeId } = await setupOpenChallenge()
    const captain = await approvedParticipant(organizationId, challengeId)
    const invitee = await approvedParticipant(organizationId, challengeId)

    const team = await app.request<{ id: string; members: { userId: string; role: string }[] }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { body: { name: 'Rocket Squad' }, cookies: captain.cookie },
    )
    expect(team.status).toBe(201)
    expect(team.body.members).toHaveLength(1)
    expect(team.body.members[0]?.role).toBe('CAPTAIN')

    // A non-participant cannot create a team.
    const stranger = await createVerifiedUser(app)
    const forbidden = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { body: { name: 'Nope' }, cookies: stranger.cookie },
    )
    expect(forbidden.status).toBe(403)

    const invitation = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/invitations`,
      { body: { userId: invitee.userId }, cookies: captain.cookie },
    )
    expect(invitation.status).toBe(201)

    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(invitee.email)
    expect(sent).toBeDefined()
    const acceptUrl = app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>)
    const token = new URL(acceptUrl).pathname.split('/').at(-2)
    expect(token).toBeTruthy()

    const accepted = await app.request<{ members: { userId: string; role: string }[] }>(
      'POST',
      `/api/v1/team-invitations/${token}/accept`,
      { cookies: invitee.cookie },
    )
    expect(accepted.status).toBe(200)
    expect(accepted.body.members).toHaveLength(2)
    expect(
      accepted.body.members.some((m) => m.userId === invitee.userId && m.role === 'MEMBER'),
    ).toBe(true)
    await flushOutbox(app.infrastructure)
    const inviteeNotifications = await app.request<{ items: { category: string }[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: invitee.cookie },
    )
    expect(
      inviteeNotifications.body.items.some(
        (notification) => notification.category === 'TEAM_MEMBERSHIP_CHANGE',
      ),
    ).toBe(true)

    // The invitee can no longer create their own team: already on one.
    const duplicateTeam = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { body: { name: 'Second Team' }, cookies: invitee.cookie },
    )
    expect(duplicateTeam.status).toBe(409)

    const listed = await app.request<{ id: string; members: unknown[] }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { cookies: captain.cookie },
    )
    expect(listed.status).toBe(200)
    expect(listed.body).toHaveLength(1)
  })

  test('team capacity is enforced at invite time', async () => {
    const { organizationId, challengeId } = await setupOpenChallenge(1)
    const captain = await approvedParticipant(organizationId, challengeId)
    const invitee = await approvedParticipant(organizationId, challengeId)

    const team = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { body: { name: 'Solo Squad' }, cookies: captain.cookie },
    )

    const overCapacity = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/invitations`,
      { body: { userId: invitee.userId }, cookies: captain.cookie },
    )
    expect(overCapacity.status).toBe(409)
  })

  test('leave: captain must transfer captaincy first when the team has other members', async () => {
    const { organizationId, challengeId } = await setupOpenChallenge(4)
    const captain = await approvedParticipant(organizationId, challengeId)

    const team = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { body: { name: 'Growing Team' }, cookies: captain.cookie },
    )

    // A solo captain leaving dissolves the team.
    const left = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/leave`,
      { cookies: captain.cookie },
    )
    expect(left.status).toBe(204)

    const gone = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}`,
      { cookies: captain.cookie },
    )
    expect(gone.status).toBe(404)
  })

  test('organizer exception can add a member directly', async () => {
    const { owner, organizationId, challengeId } = await setupOpenChallenge(4)
    const captain = await approvedParticipant(organizationId, challengeId)
    const extra = await approvedParticipant(organizationId, challengeId)

    const team = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { body: { name: 'Exception Team' }, cookies: captain.cookie },
    )

    const forbiddenForCaptain = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/organizer-exception`,
      {
        body: {
          action: 'ADD_MEMBER',
          userId: extra.userId,
          reason: 'Captain trying to self-serve.',
        },
        cookies: captain.cookie,
      },
    )
    expect(forbiddenForCaptain.status).toBe(403)

    const added = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}/organizer-exception`,
      {
        body: {
          action: 'ADD_MEMBER',
          userId: extra.userId,
          reason: 'Post-deadline correction approved.',
        },
        cookies: owner.cookie,
      },
    )
    expect(added.status).toBe(204)

    const team2 = await app.request<{ members: unknown[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams/${team.body.id}`,
      { cookies: owner.cookie },
    )
    expect(team2.body.members).toHaveLength(2)
  })
})
