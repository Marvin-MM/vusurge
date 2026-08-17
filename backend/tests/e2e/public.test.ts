import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Public challenge projection (master prompt section 34.3): only published,
 * PUBLIC-visibility challenges belonging to an ACTIVE organization are ever
 * reachable here — never a draft, an ORG_MEMBERS/UNLISTED challenge, a
 * moderation-hidden one, or one belonging to a suspended organization.
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

async function approvedOrganization(
  ownerCookie: string,
): Promise<{ organizationId: string; slug: string }> {
  const slug = `public-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Public Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A public-projection fixture organization.',
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

async function createPublishedChallenge(
  ownerCookie: string,
  organizationId: string,
  visibility: 'PUBLIC' | 'ORG_MEMBERS' | 'UNLISTED' = 'PUBLIC',
): Promise<{ challengeId: string; challengeSlug: string }> {
  const challengeSlug = `challenge-${crypto.randomUUID().slice(0, 8)}`
  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Public Fixture Challenge',
        slug: challengeSlug,
        participationPolicy: 'OPEN_AUTHENTICATED',
        visibility,
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
  return { challengeId, challengeSlug }
}

test('a published PUBLIC challenge is reachable through every public route', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)
  const { challengeSlug } = await createPublishedChallenge(owner.cookie, organizationId)

  const global = await app.request<{ items: { slug: string; organizationSlug: string }[] }>(
    'GET',
    '/api/v1/public/challenges',
  )
  expect(global.status).toBe(200)
  expect(
    global.body.items.some((item) => item.slug === challengeSlug && item.organizationSlug === slug),
  ).toBe(true)

  const scoped = await app.request<{ items: { slug: string }[] }>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges`,
  )
  expect(scoped.status).toBe(200)
  expect(scoped.body.items.some((item) => item.slug === challengeSlug)).toBe(true)

  const detail = await app.request<{ slug: string; title: string }>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}`,
  )
  expect(detail.status).toBe(200)
  expect(detail.body.title).toBe('Public Fixture Challenge')
})

test('an unpublished (DRAFT) challenge is never publicly visible', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)
  const draftSlug = `draft-${crypto.randomUUID().slice(0, 8)}`
  await app.request('POST', `/api/v1/organizations/${organizationId}/challenges`, {
    body: {
      title: 'Draft Challenge',
      slug: draftSlug,
      participationPolicy: 'OPEN_AUTHENTICATED',
      visibility: 'PUBLIC',
    },
    cookies: owner.cookie,
  })

  const detail = await app.request(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${draftSlug}`,
  )
  expect(detail.status).toBe(404)

  const list = await app.request<{ items: { slug: string }[] }>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges`,
  )
  expect(list.body.items.some((item) => item.slug === draftSlug)).toBe(false)
})

test('an ORG_MEMBERS-visibility challenge is never publicly visible', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)
  const { challengeSlug } = await createPublishedChallenge(
    owner.cookie,
    organizationId,
    'ORG_MEMBERS',
  )

  const detail = await app.request(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}`,
  )
  expect(detail.status).toBe(404)
})

test('a challenge belonging to a suspended organization disappears from the public surface', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)
  const { challengeSlug } = await createPublishedChallenge(owner.cookie, organizationId)

  const visibleBefore = await app.request(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}`,
  )
  expect(visibleBefore.status).toBe(200)

  const superadmin = await createPlatformSuperadmin(app)
  await app.request('POST', `/api/v1/platform/organizations/${organizationId}/suspend`, {
    body: { reason: 'Investigating a policy violation report.' },
    cookies: superadmin.cookie,
  })

  const visibleAfter = await app.request(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}`,
  )
  expect(visibleAfter.status).toBe(404)
})

test('tracks, announcements, and FAQs: only published content of a public challenge is exposed', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)
  const { challengeId, challengeSlug } = await createPublishedChallenge(
    owner.cookie,
    organizationId,
  )

  const track = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/tracks`,
    { body: { name: 'AI Track' }, cookies: owner.cookie },
  )
  expect(track.status).toBe(201)

  const publishedAnnouncement = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/announcements`,
    { body: { challengeId, title: 'Kickoff', body: 'We begin now.' }, cookies: owner.cookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/announcements/${publishedAnnouncement.body.id}/publish`,
    { cookies: owner.cookie },
  )
  const draftAnnouncement = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/announcements`,
    { body: { challengeId, title: 'Not yet', body: 'Still drafting.' }, cookies: owner.cookie },
  )

  const publishedFaq = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/faqs`,
    { body: { challengeId, question: 'When?', answer: 'Now.' }, cookies: owner.cookie },
  )
  await app.request(
    'PATCH',
    `/api/v1/organizations/${organizationId}/faqs/${publishedFaq.body.id}`,
    {
      body: { isPublished: true },
      cookies: owner.cookie,
    },
  )
  const draftFaq = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/faqs`,
    { body: { challengeId, question: 'Why?', answer: 'Because.' }, cookies: owner.cookie },
  )

  const tracks = await app.request<{ id: string; name: string }[]>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}/tracks`,
  )
  expect(tracks.status).toBe(200)
  expect(tracks.body.map((t) => t.id)).toEqual([track.body.id])

  const announcements = await app.request<{ id: string; title: string }[]>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}/announcements`,
  )
  expect(announcements.status).toBe(200)
  expect(announcements.body.map((a) => a.id)).toEqual([publishedAnnouncement.body.id])
  expect(announcements.body.map((a) => a.id)).not.toContain(draftAnnouncement.body.id)

  const faqs = await app.request<{ id: string; question: string }[]>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}/faqs`,
  )
  expect(faqs.status).toBe(200)
  expect(faqs.body.map((f) => f.id)).toEqual([publishedFaq.body.id])
  expect(faqs.body.map((f) => f.id)).not.toContain(draftFaq.body.id)

  // A nonexistent challenge slug is a 404, not an empty list.
  const missing = await app.request(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/does-not-exist/tracks`,
  )
  expect(missing.status).toBe(404)
})

test('results are publicly visible only once the organizer publishes them', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)
  const { challengeId, challengeSlug } = await createPublishedChallenge(
    owner.cookie,
    organizationId,
  )

  const participant = await createVerifiedUser(app)
  const registered = await app.request<{ status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: participant.cookie },
  )
  expect(registered.body.status).toBe('APPROVED')

  const submission = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
    { cookies: participant.cookie },
  )
  await app.request(
    'PATCH',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submission.body.id}/draft`,
    {
      body: { title: 'A great idea', problemStatement: 'x', solutionDescription: 'y' },
      cookies: participant.cookie,
    },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submission.body.id}/finalize`,
    { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: participant.cookie },
  )

  const rubric = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/rubrics`,
    { body: { name: 'Main Rubric' }, cookies: owner.cookie },
  )
  const version = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/rubrics/${rubric.body.id}/versions`,
    {
      body: {
        criteria: [{ key: 'quality', label: 'Quality', minScore: 0, maxScore: 10, weight: 1 }],
      },
      cookies: owner.cookie,
    },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/rubrics/${rubric.body.id}/versions/${version.body.id}/activate`,
    { cookies: owner.cookie },
  )

  const judge = await createVerifiedUser(app)
  const invitation = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/staff-invitations`,
    { body: { role: 'JUDGE', email: judge.email }, cookies: owner.cookie },
  )
  expect(invitation.status).toBe(201)
  await flushOutbox(app.infrastructure)
  const sent = app.infrastructure.fakeEmail.latestTo(judge.email)
  const acceptUrl = app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>)
  const token = new URL(acceptUrl).pathname.split('/').at(-2)
  const accepted = await app.request<{ id: string }>(
    'POST',
    `/api/v1/challenge-staff-invitations/${token}/accept`,
    { cookies: judge.cookie },
  )

  const assignment = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judge-assignments`,
    {
      body: { staffAssignmentId: accepted.body.id, submissionId: submission.body.id },
      cookies: owner.cookie,
    },
  )
  await app.request('POST', `/api/v1/judging/assignments/${assignment.body.id}/scorecard/submit`, {
    body: { criterionScores: [{ criterionKey: 'quality', score: 9 }] },
    cookies: judge.cookie,
  })
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judging/finalize`,
    { cookies: owner.cookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/results/finalize`,
    {
      body: {
        selections: [
          {
            submissionId: submission.body.id,
            selectionType: 'WINNER',
            rank: 1,
            rankLabel: 'Winner',
          },
        ],
      },
      cookies: owner.cookie,
    },
  )

  const beforePublish = await app.request<unknown[]>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}/results`,
  )
  expect(beforePublish.status).toBe(200)
  expect(beforePublish.body).toHaveLength(0)

  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/results/publish`,
    {
      body: {},
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )

  const afterPublish = await app.request<{ submissionId: string; rank: number | null }[]>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}/results`,
  )
  expect(afterPublish.status).toBe(200)
  expect(afterPublish.body).toHaveLength(1)
  expect(afterPublish.body[0]?.submissionId).toBe(submission.body.id)
  expect(afterPublish.body[0]?.rank).toBe(1)

  const retracted = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/results/retract`,
    { body: { reason: 'A publication review found a material mistake.' }, cookies: owner.cookie },
  )
  expect(retracted.status).toBe(204)
  const afterRetraction = await app.request<unknown[]>(
    'GET',
    `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}/results`,
  )
  expect(afterRetraction.body).toHaveLength(0)

  const snapshot = await app.infrastructure.transactions.withTenant(organizationId, (tx) =>
    tx.resultSnapshot.findFirstOrThrow({ where: { organizationId, challengeId } }),
  )
  expect(snapshot).toMatchObject({
    status: 'RETRACTED',
    retractionReason: 'A publication review found a material mistake.',
  })
})

test("an organization's project showcase only lists finalized submissions with explicit publication consent", async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId, slug } = await approvedOrganization(owner.cookie)
  const { challengeId } = await createPublishedChallenge(owner.cookie, organizationId)

  const consenting = await createVerifiedUser(app)
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: consenting.cookie },
  )
  const consentingSubmission = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
    { cookies: consenting.cookie },
  )
  await app.request(
    'PATCH',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${consentingSubmission.body.id}/draft`,
    {
      body: {
        title: 'Showcased Project',
        problemStatement: 'x',
        solutionDescription: 'y',
        publicationConsent: true,
      },
      cookies: consenting.cookie,
    },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${consentingSubmission.body.id}/finalize`,
    { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: consenting.cookie },
  )

  const declining = await createVerifiedUser(app)
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: declining.cookie },
  )
  const decliningSubmission = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
    { cookies: declining.cookie },
  )
  await app.request(
    'PATCH',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${decliningSubmission.body.id}/draft`,
    {
      body: { title: 'Private Project', problemStatement: 'x', solutionDescription: 'y' },
      cookies: declining.cookie,
    },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${decliningSubmission.body.id}/finalize`,
    { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: declining.cookie },
  )

  const projects = await app.request<{ items: { id: string; title: string | null }[] }>(
    'GET',
    `/api/v1/public/organizations/${slug}/projects`,
  )
  expect(projects.status).toBe(200)
  expect(projects.body.items.map((p) => p.id)).toEqual([consentingSubmission.body.id])
  expect(projects.body.items[0]?.title).toBe('Showcased Project')
})
