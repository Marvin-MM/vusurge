import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 2 challenge lifecycle: create (DRAFT) → publish → reschedule →
 * extend-deadline → close (simulated) → reopen → cancel/archive, plus the
 * authorization and cross-tenant boundaries around each transition.
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
  const slug = `challenge-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Challenge Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A challenge-lifecycle fixture organization.',
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

async function inviteChallengeManager(
  ownerCookie: string,
  organizationId: string,
): Promise<{ email: string; password: string; cookie: string; userId: string }> {
  const manager = await createVerifiedUser(app)
  const invitation = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/invitations`,
    {
      body: { email: manager.email, role: 'CHALLENGE_MANAGER' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: ownerCookie,
    },
  )
  expect(invitation.status).toBe(201)

  await flushOutbox(app.infrastructure)
  const sent = app.infrastructure.fakeEmail.latestTo(manager.email)
  expect(sent).toBeDefined()
  const acceptUrl = app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>)
  const token = new URL(acceptUrl).pathname.split('/').at(-2)
  expect(token).toBeTruthy()

  const accept = await app.request('POST', `/api/v1/invitations/${token}/accept`, {
    cookies: manager.cookie,
  })
  expect(accept.status).toBe(200)

  return manager
}

describe('challenge lifecycle', () => {
  test('create → publish → reschedule → extend-deadline → cancel', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const created = await app.request<{ id: string; status: string; slug: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      {
        body: {
          title: 'Build the Future',
          slug: 'build-the-future',
          summary: 'An innovation challenge.',
          submissionRequirements: 'A working demo and a writeup.',
        },
        cookies: owner.cookie,
      },
    )
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('DRAFT')
    const challengeId = created.body.id

    // Publishing without a submission deadline is rejected.
    const publishWithoutDeadline = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
      { body: {}, cookies: owner.cookie },
    )
    expect(publishWithoutDeadline.status).toBe(400)

    const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const rescheduled = await app.request<{ status: string; submissionDeadline: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
      { body: { submissionDeadline, reason: 'Set the initial deadline.' }, cookies: owner.cookie },
    )
    expect(rescheduled.status).toBe(200)
    expect(rescheduled.body.submissionDeadline).toBe(submissionDeadline)

    const published = await app.request<{ status: string; publishedAt: string | null }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
      { body: {}, cookies: owner.cookie },
    )
    expect(published.status).toBe(200)
    expect(published.body.status).toBe('OPEN')
    expect(published.body.publishedAt).not.toBeNull()

    // Publishing again is rejected: no longer DRAFT.
    const republish = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
      { body: {}, cookies: owner.cookie },
    )
    expect(republish.status).toBe(409)

    // Structural fields can no longer change once published.
    const structuralEdit = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      { body: { minTeamSize: 2, maxTeamSize: 4 }, cookies: owner.cookie },
    )
    expect(structuralEdit.status).toBe(409)

    // Cosmetic fields remain editable.
    const cosmeticEdit = await app.request<{ summary: string }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      { body: { summary: 'Updated summary.' }, cookies: owner.cookie },
    )
    expect(cosmeticEdit.status).toBe(200)
    expect(cosmeticEdit.body.summary).toBe('Updated summary.')

    const shorterDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const shortenAttempt = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
      {
        body: { submissionDeadline: shorterDeadline, reason: 'Try to shorten.' },
        cookies: owner.cookie,
      },
    )
    // No participation exists yet, so shortening is allowed.
    expect(shortenAttempt.status).toBe(200)

    const laterDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const extended = await app.request<{ submissionDeadline: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/extend-deadline`,
      { body: { newDeadline: laterDeadline, reason: 'Give more time.' }, cookies: owner.cookie },
    )
    expect(extended.status).toBe(200)
    expect(extended.body.submissionDeadline).toBe(laterDeadline)

    // A deadline earlier than the current one is rejected by extend-deadline.
    const badExtend = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/extend-deadline`,
      { body: { newDeadline: shorterDeadline, reason: 'Should fail.' }, cookies: owner.cookie },
    )
    expect(badExtend.status).toBe(400)

    const cancelled = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/cancel`,
      { body: { reason: 'No longer running this challenge.' }, cookies: owner.cookie },
    )
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.status).toBe('CANCELLED')

    // Cancelled challenges cannot be edited or cancelled again.
    const editAfterCancel = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      { body: { summary: 'Too late.' }, cookies: owner.cookie },
    )
    expect(editAfterCancel.status).toBe(409)

    const recancel = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/cancel`,
      { body: { reason: 'Cancelling again.' }, cookies: owner.cookie },
    )
    expect(recancel.status).toBe(409)

    const archived = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/archive`,
      { body: { reason: 'Archiving the cancelled challenge.' }, cookies: owner.cookie },
    )
    expect(archived.status).toBe(200)
    expect(archived.body.status).toBe('ARCHIVED')
  })

  test('a challenge manager can create and publish; a plain member cannot', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const manager = await inviteChallengeManager(owner.cookie, organizationId)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      { body: { title: 'Manager Challenge', slug: 'manager-challenge' }, cookies: manager.cookie },
    )
    expect(created.status).toBe(201)

    const plainMember = await createVerifiedUser(app)
    const joinCode = await app.request<{ plaintextCode: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/join-codes`,
      { body: {}, cookies: owner.cookie },
    )
    expect(joinCode.status).toBe(200)
    const redeem = await app.request('POST', `/api/v1/join-codes/redeem`, {
      body: { code: joinCode.body.plaintextCode },
      cookies: plainMember.cookie,
    })
    expect(redeem.status).toBe(200)

    const forbiddenCreate = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      { body: { title: 'Denied', slug: 'denied' }, cookies: plainMember.cookie },
    )
    expect(forbiddenCreate.status).toBe(403)

    // A plain member can still view the challenge.
    const view = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${created.body.id}`,
      { cookies: plainMember.cookie },
    )
    expect(view.status).toBe(200)
  })

  test('an unrelated user gets 404, not 403, for a challenge in a private org', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      { body: { title: 'Hidden Challenge', slug: 'hidden-challenge' }, cookies: owner.cookie },
    )
    expect(created.status).toBe(201)

    const outsider = await createVerifiedUser(app)
    const probe = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${created.body.id}`,
      { cookies: outsider.cookie },
    )
    expect(probe.status).toBe(404)

    const listProbe = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges`,
      { cookies: outsider.cookie },
    )
    expect(listProbe.status).toBe(404)
  })

  test('an approved participant who is not an org member can view the challenge', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      {
        body: {
          title: 'Participant Visible Challenge',
          slug: 'participant-visible-challenge',
          participationPolicy: 'OPEN_AUTHENTICATED',
          visibility: 'PUBLIC',
        },
        cookies: owner.cookie,
      },
    )
    expect(created.status).toBe(201)
    const challengeId = created.body.id

    const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const rescheduled = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
      { body: { submissionDeadline, reason: 'Set the initial deadline.' }, cookies: owner.cookie },
    )
    expect(rescheduled.status).toBe(200)
    const published = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
      { body: {}, cookies: owner.cookie },
    )
    expect(published.status).toBe(200)
    expect(published.body.status).toBe('OPEN')

    // The participant holds no organization membership at all: the only
    // relationship is the APPROVED participation on this one challenge.
    const participant = await createVerifiedUser(app)
    const registered = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: participant.cookie },
    )
    expect(registered.status).toBe(201)
    expect(registered.body.status).toBe('APPROVED')

    const view = await app.request<{ id: string }>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      { cookies: participant.cookie },
    )
    expect(view.status).toBe(200)
    expect(view.body.id).toBe(challengeId)

    // The narrow participation grant is scoped to that one challenge: a second
    // challenge in the same organization stays invisible.
    const otherChallenge = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      { body: { title: 'Other Challenge', slug: 'other-challenge' }, cookies: owner.cookie },
    )
    expect(otherChallenge.status).toBe(201)
    const otherView = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${otherChallenge.body.id}`,
      { cookies: participant.cookie },
    )
    expect(otherView.status).toBe(404)

    // An authenticated user with no participation at all still gets the
    // existence-preserving 404, not a 403.
    const stranger = await createVerifiedUser(app)
    const strangerView = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      { cookies: stranger.cookie },
    )
    expect(strangerView.status).toBe(404)
  })

  test('reopen only works from CLOSED, and requires a future deadline', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      { body: { title: 'Reopen Me', slug: 'reopen-me' }, cookies: owner.cookie },
    )
    const challengeId = created.body.id

    // Cannot reopen a DRAFT challenge.
    const reopenDraft = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reopen`,
      {
        body: {
          newDeadline: new Date(Date.now() + 86400000).toISOString(),
          reason: 'Reopening the draft challenge.',
        },
        cookies: owner.cookie,
      },
    )
    expect(reopenDraft.status).toBe(409)

    // A past deadline is rejected outright, independent of status.
    const reopenPast = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reopen`,
      {
        body: {
          newDeadline: new Date(Date.now() - 86400000).toISOString(),
          reason: 'Reopening with a past deadline.',
        },
        cookies: owner.cookie,
      },
    )
    expect(reopenPast.status).toBe(400)
  })

  test('reopen succeeds once the submission deadline has actually passed', async () => {
    // CLOSED is a derived state (master prompt section 10.4): no worker ever
    // persists it. A challenge whose deadline has elapsed stays OPEN in the
    // database, and reopen must recognize that as "effectively closed" by
    // reading the authoritative deadline rather than a literal status value.
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      { body: { title: 'Expires Soon', slug: 'expires-soon' }, cookies: owner.cookie },
    )
    const challengeId = created.body.id

    // Keep a wide margin so a loaded CI host cannot cross the deadline during
    // the setup requests. The test advances the authoritative database value
    // explicitly below instead of depending on a wall-clock sleep.
    const soonDeadline = new Date(Date.now() + 60_000).toISOString()
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
      {
        body: { submissionDeadline: soonDeadline, reason: 'Short-lived deadline.' },
        cookies: owner.cookie,
      },
    )
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
      { body: {}, cookies: owner.cookie },
    )

    // Still OPEN before the deadline elapses: reopening now is rejected.
    const tooEarly = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reopen`,
      {
        body: {
          newDeadline: new Date(Date.now() + 86400000).toISOString(),
          reason: 'Too early.',
        },
        cookies: owner.cookie,
      },
    )
    expect(tooEarly.status).toBe(409)

    await migration.query(
      `update challenge
          set submission_deadline = clock_timestamp() - interval '1 second',
              updated_at = clock_timestamp()
        where id = $1`,
      [challengeId],
    )

    const newDeadline = new Date(Date.now() + 86400000).toISOString()
    const reopened = await app.request<{ status: string; submissionDeadline: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reopen`,
      {
        body: { newDeadline, reason: 'Extending after the deadline passed.' },
        cookies: owner.cookie,
      },
    )
    expect(reopened.status).toBe(200)
    expect(reopened.body.status).toBe('OPEN')
    expect(reopened.body.submissionDeadline).toBe(newDeadline)
  })
})
