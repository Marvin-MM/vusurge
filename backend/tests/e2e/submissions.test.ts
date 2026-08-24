import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase, seedTechnologyTags } from '../helpers/test-database'

/**
 * Phase 3 submissions: logical identity, immutable versions, the synchronous
 * finalization transaction with Idempotency-Key, and the organizer lifecycle
 * (master prompt section 15).
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
  await seedTechnologyTags(migration, ['TypeScript', 'PostgreSQL'])
})

async function setupOpenChallenge(
  overrides: Record<string, unknown> = {},
  deadlineOffsetMs = 30 * 24 * 60 * 60 * 1000,
): Promise<{
  owner: { cookie: string }
  organizationId: string
  challengeId: string
}> {
  const owner = await createVerifiedUser(app)
  const slug = `sub-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Submissions Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A submissions-module fixture organization.',
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
        title: 'Submissions Challenge',
        slug: `sub-challenge-${crypto.randomUUID().slice(0, 6)}`,
        participationPolicy: 'OPEN_AUTHENTICATED',
        minTeamSize: 1,
        maxTeamSize: 3,
        ...overrides,
      },
      cookies: owner.cookie,
    },
  )
  const challengeId = created.body.id
  const submissionDeadline = new Date(Date.now() + deadlineOffsetMs).toISOString()
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

describe('submissions', () => {
  test('create → draft → finalize, with idempotent replay', async () => {
    const { organizationId, challengeId } = await setupOpenChallenge()
    const participant = await approvedParticipant(organizationId, challengeId)

    const created = await app.request<{ id: string; status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
      { cookies: participant.cookie },
    )
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('DRAFT')
    const submissionId = created.body.id

    // Finalizing without required fields is rejected.
    const finalizeWithoutFields = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/finalize`,
      { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: participant.cookie },
    )
    expect(finalizeWithoutFields.status).toBe(400)

    // An Idempotency-Key is required.
    const finalizeWithoutKey = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/finalize`,
      { cookies: participant.cookie },
    )
    expect(finalizeWithoutKey.status).toBe(422)

    const wrongResourceAuthorization = await app.request(
      'POST',
      '/api/v1/media/images/upload-authorization',
      {
        body: {
          purpose: 'SUBMISSION_SCREENSHOT',
          organizationId,
          challengeId,
          resourceId: crypto.randomUUID(),
          mimeType: 'image/png',
        },
        cookies: participant.cookie,
      },
    )
    expect(wrongResourceAuthorization.status).toBe(404)

    const screenshotAuthorization = await app.request<{ assetId: string }>(
      'POST',
      '/api/v1/media/images/upload-authorization',
      {
        body: {
          purpose: 'SUBMISSION_SCREENSHOT',
          organizationId,
          challengeId,
          resourceId: submissionId,
          mimeType: 'image/png',
        },
        cookies: participant.cookie,
      },
    )
    expect(screenshotAuthorization.status).toBe(200)
    const screenshotConfirmation = await app.request<{ status: string }>(
      'POST',
      '/api/v1/media/images/confirm',
      { body: { assetId: screenshotAuthorization.body.assetId }, cookies: participant.cookie },
    )
    expect(screenshotConfirmation.body.status).toBe('CONFIRMED')

    const draft = await app.request<{
      draftVersion: { title: string }
      screenshots: Array<{ mediaAssetId: string }>
    }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/draft`,
      {
        body: {
          title: 'Rocket Launcher',
          problemStatement: 'Manual launches are slow.',
          solutionDescription: 'An automated launch platform.',
          technologyTags: ['TypeScript', 'PostgreSQL'],
          screenshotAssetIds: [screenshotAuthorization.body.assetId],
        },
        cookies: participant.cookie,
      },
    )
    expect(draft.status).toBe(200)
    expect(draft.body.draftVersion.title).toBe('Rocket Launcher')
    expect(draft.body.screenshots).toEqual([
      expect.objectContaining({ mediaAssetId: screenshotAuthorization.body.assetId }),
    ])

    const idempotencyKey = crypto.randomUUID()
    const finalized = await app.request<{ status: string; draftVersion: { isFinal: boolean } }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/finalize`,
      { headers: { 'idempotency-key': idempotencyKey }, cookies: participant.cookie },
    )
    expect(finalized.status).toBe(200)
    expect(finalized.body.status).toBe('FINALIZED')

    // Replaying the same idempotency key returns the stored result without
    // re-running the finalize transaction.
    const replayed = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/finalize`,
      { headers: { 'idempotency-key': idempotencyKey }, cookies: participant.cookie },
    )
    expect(replayed.status).toBe(200)
    expect(replayed.body.status).toBe('FINALIZED')

    const versions = await app.request<{ isFinal: boolean }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/versions`,
      { cookies: participant.cookie },
    )
    expect(versions.status).toBe(200)
    expect(versions.body.some((v) => v.isFinal)).toBe(true)
  })

  test('finalize is rejected once the deadline has passed, even though status is still OPEN', async () => {
    // A short-lived deadline: create the submission and save the draft well
    // before it elapses, then let it pass before calling finalize. Nothing
    // ever flips challenge.status to CLOSED automatically (that scheduled
    // transition is out of scope until Phase 5), so this is the only way to
    // prove finalize reads the database-authoritative deadline directly
    // rather than trusting the cached status.
    const { organizationId, challengeId } = await setupOpenChallenge({}, 2000)
    const participant = await approvedParticipant(organizationId, challengeId)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
      { cookies: participant.cookie },
    )
    await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/draft`,
      {
        body: {
          title: 'Late Entry',
          problemStatement: 'x',
          solutionDescription: 'y',
        },
        cookies: participant.cookie,
      },
    )

    await new Promise((resolve) => setTimeout(resolve, 2500))

    const finalize = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/finalize`,
      { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: participant.cookie },
    )
    expect(finalize.status).toBe(409)
  }, 10_000)

  test('organizer reopen, disqualify, and reinstate', async () => {
    const { owner, organizationId, challengeId } = await setupOpenChallenge()
    const participant = await approvedParticipant(organizationId, challengeId)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
      { cookies: participant.cookie },
    )
    await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/draft`,
      {
        body: { title: 'Entry', problemStatement: 'x', solutionDescription: 'y' },
        cookies: participant.cookie,
      },
    )
    const finalized = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/finalize`,
      { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: participant.cookie },
    )
    expect(finalized.body.status).toBe('FINALIZED')

    // A plain participant cannot disqualify.
    const forbiddenDisqualify = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/disqualify`,
      { body: { reason: 'Self-disqualification attempt.' }, cookies: participant.cookie },
    )
    expect(forbiddenDisqualify.status).toBe(403)

    const disqualified = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/disqualify`,
      { body: { reason: 'Violated the rules of the challenge.' }, cookies: owner.cookie },
    )
    expect(disqualified.status).toBe(200)
    expect(disqualified.body.status).toBe('DISQUALIFIED')

    // A disqualified submission cannot be edited.
    const editAfterDisqualify = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/draft`,
      { body: { title: 'Trying to sneak an edit in.' }, cookies: participant.cookie },
    )
    expect(editAfterDisqualify.status).toBe(409)

    const reinstated = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/reinstate`,
      { body: { reason: 'Appeal upheld after review.' }, cookies: owner.cookie },
    )
    expect(reinstated.status).toBe(200)
    expect(reinstated.body.status).toBe('FINALIZED')

    const reopened = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/reopen`,
      { body: { reason: 'Allow one more edit before judging.' }, cookies: owner.cookie },
    )
    expect(reopened.status).toBe(200)
    expect(reopened.body.status).toBe('DRAFT')
  })

  test('only a team member can view, edit, or finalize a submission', async () => {
    const { owner, organizationId, challengeId } = await setupOpenChallenge()
    const participant = await approvedParticipant(organizationId, challengeId)
    const outsider = await approvedParticipant(organizationId, challengeId)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
      { cookies: participant.cookie },
    )

    const forbiddenEdit = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}/draft`,
      { body: { title: 'Hijacked' }, cookies: outsider.cookie },
    )
    expect(forbiddenEdit.status).toBe(403)

    // The organizer can still view it via the broader view permission.
    const organizerView = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}`,
      { cookies: owner.cookie },
    )
    expect(organizerView.status).toBe(200)

    const outsiderView = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${created.body.id}`,
      { cookies: outsider.cookie },
    )
    expect(outsiderView.status).toBe(403)
  })

  /**
   * An organization MEMBER holds `submission.create`/`edit_own`/`submit` by
   * role (roles.ts's MEMBER_PERMISSIONS) — exactly the same grants an APPROVED
   * participant receives via CHALLENGE_PARTICIPANT_PERMISSIONS. Permission
   * checks alone therefore cannot distinguish "a member of the host org who
   * never registered" from "a registered participant", so the participation
   * record itself has to be the gate. Without it, any member of the hosting
   * organization could open a submission on a challenge they never entered.
   */
  test('an org member who never registered cannot start a submission', async () => {
    const { owner, organizationId, challengeId } = await setupOpenChallenge()

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

    // The member is a real, active member of the host org but has no
    // participation record for this challenge.
    const participation = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/me`,
      { cookies: member.cookie },
    )
    expect(participation.status).toBe(200)
    expect(participation.body).toBeFalsy()

    const denied = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
      { cookies: member.cookie },
    )
    expect(denied.status).toBe(403)

    // No stray implicit solo team was created as a side effect of the attempt.
    const teams = await app.request<{ id: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/teams`,
      { cookies: owner.cookie },
    )
    expect(teams.body).toHaveLength(0)

    // Registering first makes the very same call succeed — proving the gate is
    // the participation record, not some unrelated denial.
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    const allowed = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
      { cookies: member.cookie },
    )
    expect(allowed.status).toBe(201)
  })

  /**
   * The withdrawn/rejected/disqualified case: a participation row exists but is
   * not APPROVED, so it must not confer submission access either.
   */
  test('a withdrawn participant cannot start a submission', async () => {
    const { organizationId, challengeId } = await setupOpenChallenge()
    const participant = await approvedParticipant(organizationId, challengeId)

    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/withdraw`,
      { cookies: participant.cookie },
    )

    const denied = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
      { cookies: participant.cookie },
    )
    expect(denied.status).toBe(403)
  })
})
