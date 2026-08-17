import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase, seedTechnologyTags } from '../helpers/test-database'

/**
 * Innovation portfolio (master prompt section 26): direct creation,
 * promotion from a finalized submission (one promotion per submission by
 * default), explicit stage transitions with recorded history, milestones,
 * evidence, metrics/measurements, the public projection, and portfolio
 * analytics.
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
  await seedTechnologyTags(migration, ['TypeScript'])
})

async function approvedOrganization(
  ownerCookie: string,
): Promise<{ organizationId: string; slug: string }> {
  const slug = `portfolio-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Portfolio Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'An innovation-portfolio fixture organization.',
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
  return { organizationId: approval.body.organizationId, slug }
}

async function publishedChallenge(ownerCookie: string, organizationId: string): Promise<string> {
  const challengeSlug = `portfolio-challenge-${crypto.randomUUID().slice(0, 8)}`
  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Portfolio Fixture Challenge',
        slug: challengeSlug,
        participationPolicy: 'OPEN_AUTHENTICATED',
        minTeamSize: 1,
        maxTeamSize: 3,
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

/** Registers a participant and produces a FINALIZED submission for them. */
async function finalizedSubmission(
  organizationId: string,
  challengeId: string,
): Promise<{ participant: { cookie: string; userId: string }; submissionId: string }> {
  const participant = await createVerifiedUser(app)
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: participant.cookie },
  )

  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
    { cookies: participant.cookie },
  )
  const submissionId = created.body.id

  await app.request(
    'PATCH',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/draft`,
    {
      body: {
        title: 'Portfolio-Bound Project',
        problemStatement: 'A real problem.',
        solutionDescription: 'A real solution.',
        technologyTags: ['TypeScript'],
      },
      cookies: participant.cookie,
    },
  )

  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/finalize`,
    { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: participant.cookie },
  )

  return { participant, submissionId }
}

test('an org admin can create an innovation item directly', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const created = await app.request<{ id: string; stage: string; title: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/innovations`,
    {
      body: { title: 'Continuous Ideation Item', thesis: 'A promising direction worth exploring.' },
      cookies: owner.cookie,
    },
  )
  expect(created.status).toBe(201)
  expect(created.body.stage).toBe('DISCOVERY')

  const fetched = await app.request<{ title: string }>(
    'GET',
    `/api/v1/organizations/${organizationId}/innovations/${created.body.id}`,
    { cookies: owner.cookie },
  )
  expect(fetched.status).toBe(200)
  expect(fetched.body.title).toBe('Continuous Ideation Item')

  const list = await app.request<{ items: { id: string }[] }>(
    'GET',
    `/api/v1/organizations/${organizationId}/innovations`,
    { cookies: owner.cookie },
  )
  expect(list.body.items.some((item) => item.id === created.body.id)).toBe(true)
})

test('promoting a finalized submission works once; a second attempt is a 409', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const challengeId = await publishedChallenge(owner.cookie, organizationId)
  const { submissionId } = await finalizedSubmission(organizationId, challengeId)

  const promoted = await app.request<{ id: string; sourceSubmissionId: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/promote-to-innovation`,
    { body: { title: 'Promoted Project' }, cookies: owner.cookie },
  )
  expect(promoted.status).toBe(201)
  expect(promoted.body.sourceSubmissionId).toBe(submissionId)

  const again = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/promote-to-innovation`,
    { body: { title: 'Second attempt' }, cookies: owner.cookie },
  )
  expect(again.status).toBe(409)
})

test('promoting a non-finalized (draft) submission is rejected', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const challengeId = await publishedChallenge(owner.cookie, organizationId)
  const participant = await createVerifiedUser(app)
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: participant.cookie },
  )
  const draft = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
    { cookies: participant.cookie },
  )

  const attempt = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${draft.body.id}/promote-to-innovation`,
    { body: { title: 'Should fail' }, cookies: owner.cookie },
  )
  expect(attempt.status).toBe(422)
})

describe('stage transitions', () => {
  test('transitioning records stage history and notifies the owner', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations`,
      { body: { title: 'Stage Fixture', ownerUserId: owner.userId }, cookies: owner.cookie },
    )
    const innovationId = created.body.id

    const transitioned = await app.request<{ stage: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/transition-stage`,
      {
        body: {
          newStage: 'VALIDATION',
          decision: 'Enough early signal to move into validation.',
          nextReviewDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        },
        cookies: owner.cookie,
      },
    )
    expect(transitioned.status).toBe(200)
    expect(transitioned.body.stage).toBe('VALIDATION')

    const reviewSchedule = await app.infrastructure.transactions.withTenant(organizationId, (tx) =>
      tx.reminderSchedule.findUnique({
        where: { deterministicKey: `innovation:${innovationId}:PORTFOLIO_REVIEW` },
      }),
    )
    expect(reviewSchedule?.kind).toBe('PORTFOLIO_REVIEW')
    expect(reviewSchedule?.status).toBe('SCHEDULED')
    expect(reviewSchedule?.innovationId).toBe(innovationId)

    const history = await app.request<{ previousStage: string | null; newStage: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/stage-history`,
      { cookies: owner.cookie },
    )
    expect(history.status).toBe(200)
    expect(history.body).toHaveLength(1)
    expect(history.body[0]?.previousStage).toBe('DISCOVERY')
    expect(history.body[0]?.newStage).toBe('VALIDATION')

    await flushOutbox(app.infrastructure)
    const notifications = await app.request<{ items: { category: string }[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: owner.cookie },
    )
    expect(notifications.body.items.some((item) => item.category === 'PORTFOLIO_UPDATE')).toBe(true)
  })

  test('transitioning to the current stage is rejected', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations`,
      { body: { title: 'No-op Stage Fixture' }, cookies: owner.cookie },
    )

    const attempt = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations/${created.body.id}/transition-stage`,
      {
        body: { newStage: 'DISCOVERY', decision: 'Attempting a no-op transition.' },
        cookies: owner.cookie,
      },
    )
    expect(attempt.status).toBe(409)
  })

  test('a challenge manager can view but not transition an innovation stage', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations`,
      { body: { title: 'Permission Fixture' }, cookies: owner.cookie },
    )

    const manager = await createVerifiedUser(app)
    await app.request('POST', `/api/v1/organizations/${organizationId}/invitations`, {
      body: { email: manager.email, role: 'CHALLENGE_MANAGER' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    })
    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(manager.email)
    const token = new URL(
      app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>),
    ).pathname
      .split('/')
      .at(-2)
    await app.request('POST', `/api/v1/invitations/${token}/accept`, { cookies: manager.cookie })

    const viewed = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/innovations/${created.body.id}`,
      { cookies: manager.cookie },
    )
    expect(viewed.status).toBe(200)

    const attempt = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations/${created.body.id}/transition-stage`,
      {
        body: { newStage: 'VALIDATION', decision: 'Trying to transition without permission.' },
        cookies: manager.cookie,
      },
    )
    expect(attempt.status).toBe(403)
  })
})

describe('milestones, evidence, and metrics', () => {
  test('milestone CRUD, including auto-timestamping completedAt', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations`,
      { body: { title: 'Milestone Fixture' }, cookies: owner.cookie },
    )
    const innovationId = created.body.id

    const milestone = await app.request<{ id: string; status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/milestones`,
      { body: { title: 'Ship an MVP', status: 'IN_PROGRESS' }, cookies: owner.cookie },
    )
    expect(milestone.status).toBe(201)

    const completed = await app.request<{ status: string; completedAt: string | null }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/milestones/${milestone.body.id}`,
      { body: { status: 'COMPLETED' }, cookies: owner.cookie },
    )
    expect(completed.body.status).toBe('COMPLETED')
    expect(completed.body.completedAt).not.toBeNull()

    const list = await app.request<{ id: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/milestones`,
      { cookies: owner.cookie },
    )
    expect(list.body).toHaveLength(1)

    const deleted = await app.request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/milestones/${milestone.body.id}`,
      { cookies: owner.cookie },
    )
    expect(deleted.status).toBe(204)
  })

  test('evidence can be attached and removed', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations`,
      { body: { title: 'Evidence Fixture' }, cookies: owner.cookie },
    )
    const innovationId = created.body.id

    const imageAuthorization = await app.request<{ assetId: string }>(
      'POST',
      '/api/v1/media/images/upload-authorization',
      {
        body: {
          purpose: 'PORTFOLIO_EVIDENCE',
          organizationId,
          resourceId: innovationId,
          mimeType: 'image/png',
        },
        cookies: owner.cookie,
      },
    )
    expect(imageAuthorization.status).toBe(200)
    await app.request('POST', '/api/v1/media/images/confirm', {
      body: { assetId: imageAuthorization.body.assetId },
      cookies: owner.cookie,
    })

    const evidence = await app.request<{ id: string; mediaAssetId: string | null }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/evidence`,
      {
        body: {
          type: 'MEDIA_ASSET',
          title: 'User research screenshot',
          mediaAssetId: imageAuthorization.body.assetId,
        },
        cookies: owner.cookie,
      },
    )
    expect(evidence.status).toBe(201)
    expect(evidence.body.mediaAssetId).toBe(imageAuthorization.body.assetId)

    const delivery = await app.request<{ url: string }>(
      'GET',
      `/api/v1/media/images/${imageAuthorization.body.assetId}/delivery`,
      { cookies: owner.cookie },
    )
    expect(delivery.status).toBe(200)

    const list = await app.request<{ id: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/evidence`,
      { cookies: owner.cookie },
    )
    expect(list.body).toHaveLength(1)

    const deleted = await app.request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/evidence/${evidence.body.id}`,
      { cookies: owner.cookie },
    )
    expect(deleted.status).toBe(204)
  })

  test('metric definitions and measurements', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations`,
      { body: { title: 'Metric Fixture' }, cookies: owner.cookie },
    )
    const innovationId = created.body.id

    const metric = await app.request<{ id: string; name: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/metrics`,
      {
        body: { name: 'Weekly active users', metricType: 'NUMBER', targetValue: '1000' },
        cookies: owner.cookie,
      },
    )
    expect(metric.status).toBe(201)

    const measurement = await app.request<{ value: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/metrics/${metric.body.id}/measurements`,
      { body: { value: '250', measuredAt: new Date().toISOString() }, cookies: owner.cookie },
    )
    expect(measurement.status).toBe(201)
    expect(measurement.body.value).toBe('250')

    const measurements = await app.request<{ items: { value: string }[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/innovations/${innovationId}/metrics/${metric.body.id}/measurements`,
      { cookies: owner.cookie },
    )
    expect(measurements.body.items).toHaveLength(1)
  })
})

test('only a public_visible innovation is reachable through the public projection', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)

  const privateOne = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/innovations`,
    { body: { title: 'Internal Only Item' }, cookies: owner.cookie },
  )
  const publicOne = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/innovations`,
    { body: { title: 'Publicly Shared Item', publicVisible: true }, cookies: owner.cookie },
  )

  const publicList = await app.request<{ items: { title: string }[] }>(
    'GET',
    `/api/v1/public/organizations/${slug}/innovations`,
  )
  expect(publicList.status).toBe(200)
  expect(publicList.body.items.some((item) => item.title === 'Publicly Shared Item')).toBe(true)
  expect(publicList.body.items.some((item) => item.title === 'Internal Only Item')).toBe(false)
  void privateOne
  void publicOne
})

test('portfolio analytics reports stage counts and conversion rate', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const challengeId = await publishedChallenge(owner.cookie, organizationId)
  const { submissionId } = await finalizedSubmission(organizationId, challengeId)

  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/promote-to-innovation`,
    { body: { title: 'Analytics Fixture' }, cookies: owner.cookie },
  )

  const analytics = await app.request<{
    totalInnovations: number
    byStage: { stage: string; count: number }[]
    portfolioConversionRate: number
  }>('GET', `/api/v1/organizations/${organizationId}/analytics/portfolio`, {
    cookies: owner.cookie,
  })
  expect(analytics.status).toBe(200)
  expect(analytics.body.totalInnovations).toBe(1)
  expect(analytics.body.byStage.some((row) => row.stage === 'DISCOVERY' && row.count === 1)).toBe(
    true,
  )
  expect(analytics.body.portfolioConversionRate).toBe(1)
})
