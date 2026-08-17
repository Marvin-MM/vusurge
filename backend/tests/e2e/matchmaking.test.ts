import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/** Phase 3 matchmaking board (master prompt section 14.1). */

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

async function setupOpenChallenge(): Promise<{ organizationId: string; challengeId: string }> {
  const owner = await createVerifiedUser(app)
  const slug = `mm-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Matchmaking Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A matchmaking-module fixture organization.',
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
        title: 'Matchmaking Challenge',
        slug: `mm-challenge-${crypto.randomUUID().slice(0, 6)}`,
        participationPolicy: 'OPEN_AUTHENTICATED',
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
  return { organizationId, challengeId }
}

async function approvedParticipant(organizationId: string, challengeId: string) {
  const user = await createVerifiedUser(app)
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: user.cookie },
  )
  return user
}

describe('matchmaking', () => {
  test('create, list, express interest, close, and delete', async () => {
    const { organizationId, challengeId } = await setupOpenChallenge()
    const poster = await approvedParticipant(organizationId, challengeId)
    const interested = await approvedParticipant(organizationId, challengeId)

    const post = await app.request<{ id: string; isOpen: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking`,
      {
        body: {
          skillsOffered: ['TypeScript', 'PostgreSQL'],
          rolesSought: ['Designer'],
          message: 'Looking for a designer to join our team.',
        },
        cookies: poster.cookie,
      },
    )
    expect(post.status).toBe(201)
    expect(post.body.isOpen).toBe(true)

    // A non-participant cannot post.
    const stranger = await createVerifiedUser(app)
    const forbidden = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking`,
      {
        body: { skillsOffered: [], rolesSought: [], message: 'Let me in please' },
        cookies: stranger.cookie,
      },
    )
    expect(forbidden.status).toBe(403)

    const listed = await app.request<{ id: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking`,
      { cookies: interested.cookie },
    )
    expect(listed.status).toBe(200)
    expect(listed.body).toHaveLength(1)

    const interest = await app.request<{ interestedUserId: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${post.body.id}/interest`,
      { body: { message: "I'd love to help!" }, cookies: interested.cookie },
    )
    expect(interest.status).toBe(201)
    expect(interest.body.interestedUserId).toBe(interested.userId)

    // The poster is notified in-app, never by email — never disclosing the
    // interested user's private contact details (master prompt 14.1).
    await flushOutbox(app.infrastructure)
    const posterNotifications = await app.request<{ items: { category: string }[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: poster.cookie },
    )
    expect(
      posterNotifications.body.items.some((item) => item.category === 'MATCHMAKING_INTEREST'),
    ).toBe(true)

    // Duplicate interest is rejected.
    const duplicateInterest = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${post.body.id}/interest`,
      { body: {}, cookies: interested.cookie },
    )
    expect(duplicateInterest.status).toBe(409)

    // The poster cannot express interest in their own post.
    const selfInterest = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${post.body.id}/interest`,
      { body: {}, cookies: poster.cookie },
    )
    expect(selfInterest.status).toBe(409)

    // Only the poster (or an organizer) can close the post.
    const forbiddenClose = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${post.body.id}/close`,
      { cookies: interested.cookie },
    )
    expect(forbiddenClose.status).toBe(403)

    const closed = await app.request<{ isOpen: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${post.body.id}/close`,
      { cookies: poster.cookie },
    )
    expect(closed.status).toBe(200)
    expect(closed.body.isOpen).toBe(false)

    // Interest is no longer accepted once closed.
    const anotherParticipant = await approvedParticipant(organizationId, challengeId)
    const interestAfterClose = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${post.body.id}/interest`,
      { body: {}, cookies: anotherParticipant.cookie },
    )
    expect(interestAfterClose.status).toBe(409)

    const deleted = await app.request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${post.body.id}`,
      { cookies: poster.cookie },
    )
    expect(deleted.status).toBe(204)
  })
})
