import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 2 challenge participation: registration eligibility (policy,
 * membership, registration window, terms acceptance, screening), and the
 * organizer decision lifecycle (approve/reject/disqualify/reinstate).
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
  const slug = `part-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Participation Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A participation-module fixture organization.',
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

async function joinAsMember(organizationId: string, ownerCookie: string) {
  const member = await createVerifiedUser(app)
  const joinCode = await app.request<{ plaintextCode: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/join-codes`,
    { body: {}, cookies: ownerCookie },
  )
  await app.request('POST', '/api/v1/join-codes/redeem', {
    body: { code: joinCode.body.plaintextCode },
    cookies: member.cookie,
  })
  return member
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
        title: 'Open Challenge',
        slug: `open-challenge-${crypto.randomUUID().slice(0, 6)}`,
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

describe('participation registration', () => {
  test('auto-approves when the challenge does not require screening', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const member = await joinAsMember(organizationId, owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie)

    const registered = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    expect(registered.status).toBe(201)
    expect(registered.body.status).toBe('APPROVED')

    const mine = await app.request<{ status: string } | null>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/me`,
      { cookies: member.cookie },
    )
    expect(mine.body?.status).toBe('APPROVED')

    // A second registration attempt is a conflict: already active.
    const duplicate = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    expect(duplicate.status).toBe(409)
  })

  test('ORG_MEMBERS_ONLY policy rejects a non-member', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie, {
      participationPolicy: 'ORG_MEMBERS_ONLY',
    })

    const outsider = await createVerifiedUser(app)
    const registered = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: outsider.cookie },
    )
    expect(registered.status).toBe(403)
  })

  test('OPEN_AUTHENTICATED policy allows a non-member to register', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie, {
      participationPolicy: 'OPEN_AUTHENTICATED',
    })

    const outsider = await createVerifiedUser(app)
    const registered = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: outsider.cookie },
    )
    expect(registered.status).toBe(201)
    expect(registered.body.status).toBe('APPROVED')
  })

  test('a challenge with an active terms version requires explicit acceptance', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const member = await joinAsMember(organizationId, owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie)

    const terms = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/versions`,
      { body: { content: '# Rules\n\nBe excellent.' }, cookies: owner.cookie },
    )
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/versions/${terms.body.id}/activate`,
      { cookies: owner.cookie },
    )

    const withoutAcceptance = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    expect(withoutAcceptance.status).toBe(400)

    const withAcceptance = await app.request<{ status: string; termsVersionId: string | null }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: { acceptTermsVersionId: terms.body.id }, cookies: member.cookie },
    )
    expect(withAcceptance.status).toBe(201)
    expect(withAcceptance.body.termsVersionId).toBe(terms.body.id)
  })

  test('screening: requires a matching published form response, then starts PENDING', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const member = await joinAsMember(organizationId, owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie, {
      screeningRequired: true,
    })

    // No screening form configured yet: registration is a conflict.
    const noForm = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    expect(noForm.status).toBe(409)

    const definition = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      {
        body: { purpose: 'CHALLENGE_PARTICIPATION', challengeId, name: 'Screening' },
        cookies: owner.cookie,
      },
    )
    const version = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions`,
      {
        body: {
          schema: {
            fields: [{ key: 'why', type: 'SHORT_TEXT', label: 'Why?', required: true }],
          },
        },
        cookies: owner.cookie,
      },
    )
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions/${version.body.id}/publish`,
      { cookies: owner.cookie },
    )

    // Still missing a formResponseId.
    const missingResponse = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    expect(missingResponse.status).toBe(400)

    const response = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      { body: { responseData: { why: 'Because I can.' } }, cookies: member.cookie },
    )

    const registered = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: { formResponseId: response.body.id }, cookies: member.cookie },
    )
    expect(registered.status).toBe(201)
    expect(registered.body.status).toBe('PENDING')
  })

  test('submit-application validates the screening response and registers in one step', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie, {
      screeningRequired: true,
      participationPolicy: 'OPEN_AUTHENTICATED',
    })

    const definition = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      {
        body: { purpose: 'CHALLENGE_PARTICIPATION', challengeId, name: 'Screening' },
        cookies: owner.cookie,
      },
    )
    const version = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions`,
      {
        body: {
          schema: { fields: [{ key: 'why', type: 'SHORT_TEXT', label: 'Why?', required: true }] },
        },
        cookies: owner.cookie,
      },
    )
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions/${version.body.id}/publish`,
      { cookies: owner.cookie },
    )

    // A non-member applicant: submit-application must work without any
    // prior organization membership (OPEN_AUTHENTICATED).
    const applicant = await createVerifiedUser(app)

    const firstDraft = await app.request<{
      id: string
      formVersionId: string
      responseData: Record<string, unknown>
    }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/application`,
      { body: { responseData: {} }, cookies: applicant.cookie },
    )
    expect(firstDraft.status).toBe(200)
    expect(firstDraft.body.formVersionId).toBe(version.body.id)

    const updatedDraft = await app.request<typeof firstDraft.body>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/application`,
      {
        body: { responseData: { why: 'A saved answer.' } },
        cookies: applicant.cookie,
      },
    )
    expect(updatedDraft.body.id).toBe(firstDraft.body.id)
    expect(updatedDraft.body.responseData).toEqual({ why: 'A saved answer.' })

    const invalid = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/submit-application`,
      { body: { responseData: {} }, cookies: applicant.cookie },
    )
    expect(invalid.status).toBe(400)

    const submitted = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/submit-application`,
      { body: { responseData: { why: 'Because I want to build.' } }, cookies: applicant.cookie },
    )
    expect(submitted.status).toBe(201)
    expect(submitted.body.status).toBe('PENDING')

    const persistedResponse = await app.infrastructure.transactions.withTenant(
      organizationId,
      (tx) =>
        tx.formResponse.findFirstOrThrow({
          where: { organizationId, challengeId, userId: applicant.userId },
        }),
    )
    expect(persistedResponse.id).toBe(firstDraft.body.id)
    expect(persistedResponse.isDraft).toBe(false)
    expect(persistedResponse.responseData).toEqual({ why: 'Because I want to build.' })

    const editSubmitted = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/application`,
      { body: { responseData: { why: 'Changed later.' } }, cookies: applicant.cookie },
    )
    expect(editSubmitted.status).toBe(409)

    const mine = await app.request<{ status: string } | null>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/me`,
      { cookies: applicant.cookie },
    )
    expect(mine.body?.status).toBe('PENDING')
  })
})

describe('participation decisions', () => {
  test('organizer approve/reject/disqualify/reinstate lifecycle', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const member = await joinAsMember(organizationId, owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie, {
      screeningRequired: true,
    })

    const definition = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      {
        body: { purpose: 'CHALLENGE_PARTICIPATION', challengeId, name: 'Screening' },
        cookies: owner.cookie,
      },
    )
    const version = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions`,
      {
        body: {
          schema: { fields: [{ key: 'why', type: 'SHORT_TEXT', label: 'Why?', required: true }] },
        },
        cookies: owner.cookie,
      },
    )
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions/${version.body.id}/publish`,
      { cookies: owner.cookie },
    )
    const response = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      { body: { responseData: { why: 'x' } }, cookies: member.cookie },
    )
    const registered = await app.request<{ id: string; status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: { formResponseId: response.body.id }, cookies: member.cookie },
    )
    expect(registered.body.status).toBe('PENDING')
    const participationId = registered.body.id

    // A plain member cannot approve.
    const forbiddenApprove = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participants/${participationId}/approve`,
      { body: {}, cookies: member.cookie },
    )
    expect(forbiddenApprove.status).toBe(403)

    const approved = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participants/${participationId}/approve`,
      { body: {}, cookies: owner.cookie },
    )
    expect(approved.status).toBe(200)
    expect(approved.body.status).toBe('APPROVED')
    await flushOutbox(app.infrastructure)
    expect(app.infrastructure.fakeEmail.latestTo(member.email)?.subject).toContain(
      'participation approved',
    )
    const decisionNotifications = await app.request<{ items: { category: string }[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: member.cookie },
    )
    expect(
      decisionNotifications.body.items.some(
        (notification) => notification.category === 'PARTICIPATION_DECISION',
      ),
    ).toBe(true)

    // Approving again is rejected: no longer pending.
    const reapprove = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participants/${participationId}/approve`,
      { body: {}, cookies: owner.cookie },
    )
    expect(reapprove.status).toBe(409)

    const disqualified = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participants/${participationId}/disqualify`,
      { body: { reason: 'Violated the code of conduct.' }, cookies: owner.cookie },
    )
    expect(disqualified.status).toBe(200)
    expect(disqualified.body.status).toBe('DISQUALIFIED')

    // A disqualified participant cannot self-register again.
    const reRegisterAttempt = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: { formResponseId: response.body.id }, cookies: member.cookie },
    )
    expect(reRegisterAttempt.status).toBe(403)

    const reinstated = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participants/${participationId}/reinstate`,
      { body: { reason: 'Appeal upheld after review.' }, cookies: owner.cookie },
    )
    expect(reinstated.status).toBe(200)
    expect(reinstated.body.status).toBe('APPROVED')
  })

  test('withdraw and re-register resets to a fresh application', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const member = await joinAsMember(organizationId, owner.cookie)
    const challengeId = await openChallenge(organizationId, owner.cookie)

    const registered = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    expect(registered.body.status).toBe('APPROVED')

    const withdrawn = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/withdraw`,
      { cookies: member.cookie },
    )
    expect(withdrawn.status).toBe(200)
    expect(withdrawn.body.status).toBe('WITHDRAWN')

    const reRegistered = await app.request<{ status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
      { body: {}, cookies: member.cookie },
    )
    expect(reRegistered.status).toBe(201)
    expect(reRegistered.body.status).toBe('APPROVED')
  })
})
