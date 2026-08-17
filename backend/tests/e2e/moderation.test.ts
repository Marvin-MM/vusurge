import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser, type TestUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Moderation and abuse (master prompt section 28): reporting an organization
 * or a public challenge, platform review (dismiss/hide/restore/suspend), and
 * that a report against something the reporter cannot see resolves to a 404
 * rather than confirming it exists.
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

/** Grants PLATFORM_SUPPORT_AGENT only — moderate/support permissions, no organization management. */
async function createSupportAgent(): Promise<TestUser> {
  const user = await createVerifiedUser(app)
  await app.infrastructure.database.client.platformRoleAssignment.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.userId,
      role: 'PLATFORM_SUPPORT_AGENT',
      reason: 'test fixture',
    },
  })
  return user
}

async function approvedOrganization(
  ownerCookie: string,
  visibility: 'PRIVATE' | 'PUBLIC' = 'PRIVATE',
): Promise<{ organizationId: string; slug: string }> {
  const slug = `mod-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Moderation Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A moderation-module fixture organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: visibility,
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

async function publishedPublicChallenge(
  ownerCookie: string,
  organizationId: string,
): Promise<{ challengeId: string; challengeSlug: string }> {
  const challengeSlug = `mod-challenge-${crypto.randomUUID().slice(0, 8)}`
  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Reportable Challenge',
        slug: challengeSlug,
        participationPolicy: 'OPEN_AUTHENTICATED',
        visibility: 'PUBLIC',
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

describe('reporting', () => {
  test('a stranger can report a public organization', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie, 'PUBLIC')
    const stranger = await createVerifiedUser(app)

    const report = await app.request<{ id: string; status: string; targetOrganizationId: string }>(
      'POST',
      '/api/v1/reports',
      {
        body: {
          targetType: 'ORGANIZATION',
          targetId: organizationId,
          category: 'SPAM',
          description: 'This organization is posting spam challenges.',
        },
        cookies: stranger.cookie,
      },
    )
    expect(report.status).toBe(200)
    expect(report.body.status).toBe('OPEN')
    expect(report.body.targetOrganizationId).toBe(organizationId)

    const mine = await app.request<{ items: { id: string }[] }>('GET', '/api/v1/reports/mine', {
      cookies: stranger.cookie,
    })
    expect(mine.body.items.some((item) => item.id === report.body.id)).toBe(true)
  })

  test('a stranger cannot report a private organization they are not a member of', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie, 'PRIVATE')
    const stranger = await createVerifiedUser(app)

    const report = await app.request('POST', '/api/v1/reports', {
      body: {
        targetType: 'ORGANIZATION',
        targetId: organizationId,
        category: 'ABUSE',
        description: 'Trying to report something I should not be able to see.',
      },
      cookies: stranger.cookie,
    })
    expect(report.status).toBe(404)
  })

  test('a member can report their own private organization', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie, 'PRIVATE')

    const report = await app.request<{ status: string }>('POST', '/api/v1/reports', {
      body: {
        targetType: 'ORGANIZATION',
        targetId: organizationId,
        category: 'SAFETY_CONCERN',
        description: 'Reporting a safety concern from inside my own organization.',
      },
      cookies: owner.cookie,
    })
    expect(report.status).toBe(200)
  })

  test('a public challenge can be reported by anyone; a non-public one cannot', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const { challengeId } = await publishedPublicChallenge(owner.cookie, organizationId)
    const stranger = await createVerifiedUser(app)

    const report = await app.request<{ status: string }>('POST', '/api/v1/reports', {
      body: {
        targetType: 'CHALLENGE',
        targetId: challengeId,
        category: 'INAPPROPRIATE_CONTENT',
        description: 'This challenge contains inappropriate content.',
      },
      cookies: stranger.cookie,
    })
    expect(report.status).toBe(200)

    const unlistedSlug = `unlisted-${crypto.randomUUID().slice(0, 6)}`
    const unlisted = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges`,
      {
        body: {
          title: 'Unlisted challenge',
          slug: unlistedSlug,
          participationPolicy: 'OPEN_AUTHENTICATED',
          visibility: 'UNLISTED',
        },
        cookies: owner.cookie,
      },
    )
    const notFoundReport = await app.request('POST', '/api/v1/reports', {
      body: {
        targetType: 'CHALLENGE',
        targetId: unlisted.body.id,
        category: 'OTHER',
        description: 'Should not resolve — this challenge is not PUBLIC.',
      },
      cookies: stranger.cookie,
    })
    expect(notFoundReport.status).toBe(404)
  })
})

describe('platform review', () => {
  test('staff can dismiss a report', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie, 'PUBLIC')
    const reporter = await createVerifiedUser(app)
    const report = await app.request<{ id: string }>('POST', '/api/v1/reports', {
      body: {
        targetType: 'ORGANIZATION',
        targetId: organizationId,
        category: 'OTHER',
        description: 'A report to be dismissed.',
      },
      cookies: reporter.cookie,
    })

    const staff = await createSupportAgent()
    const dismissed = await app.request<{ status: string; resolutionReason: string }>(
      'POST',
      `/api/v1/platform/reports/${report.body.id}/dismiss`,
      { body: { reason: 'Investigated and found no policy violation.' }, cookies: staff.cookie },
    )
    expect(dismissed.status).toBe(200)
    expect(dismissed.body.status).toBe('DISMISSED')
    expect(dismissed.body.resolutionReason).toBe('Investigated and found no policy violation.')

    // Cannot dismiss an already-resolved report.
    const again = await app.request('POST', `/api/v1/platform/reports/${report.body.id}/dismiss`, {
      body: { reason: 'Trying again after resolution.' },
      cookies: staff.cookie,
    })
    expect(again.status).toBe(409)
  })

  test('staff can hide and then restore a reported challenge', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId, slug } = await approvedOrganization(owner.cookie)
    const { challengeId, challengeSlug } = await publishedPublicChallenge(
      owner.cookie,
      organizationId,
    )
    const reporter = await createVerifiedUser(app)
    const report = await app.request<{ id: string }>('POST', '/api/v1/reports', {
      body: {
        targetType: 'CHALLENGE',
        targetId: challengeId,
        category: 'INAPPROPRIATE_CONTENT',
        description: 'This challenge should be hidden.',
      },
      cookies: reporter.cookie,
    })

    const visibleBefore = await app.request(
      'GET',
      `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}`,
    )
    expect(visibleBefore.status).toBe(200)

    const staff = await createSupportAgent()
    const hidden = await app.request<{ status: string }>(
      'POST',
      `/api/v1/platform/reports/${report.body.id}/hide-content`,
      {
        body: { reason: 'Confirmed policy-violating content; hiding pending review.' },
        cookies: staff.cookie,
      },
    )
    expect(hidden.status).toBe(200)
    expect(hidden.body.status).toBe('ACTION_TAKEN')

    const hiddenFromPublic = await app.request(
      'GET',
      `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}`,
    )
    expect(hiddenFromPublic.status).toBe(404)

    // A hidden challenge is still visible to its own organizer.
    const organizerView = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      { cookies: owner.cookie },
    )
    expect(organizerView.status).toBe(200)

    const restored = await app.request<{ status: string }>(
      'POST',
      `/api/v1/platform/reports/${report.body.id}/restore-content`,
      {
        body: { reason: 'On further review, this did not violate policy.' },
        cookies: staff.cookie,
      },
    )
    expect(restored.status).toBe(200)

    const visibleAfterRestore = await app.request(
      'GET',
      `/api/v1/public/organizations/${slug}/challenges/${challengeSlug}`,
    )
    expect(visibleAfterRestore.status).toBe(200)
  })

  test('hide-content is rejected for an organization-target report', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie, 'PUBLIC')
    const reporter = await createVerifiedUser(app)
    const report = await app.request<{ id: string }>('POST', '/api/v1/reports', {
      body: {
        targetType: 'ORGANIZATION',
        targetId: organizationId,
        category: 'OTHER',
        description: 'An organization report, not a challenge report.',
      },
      cookies: reporter.cookie,
    })

    const staff = await createSupportAgent()
    const attempt = await app.request(
      'POST',
      `/api/v1/platform/reports/${report.body.id}/hide-content`,
      {
        body: { reason: 'This should be rejected by target-type validation.' },
        cookies: staff.cookie,
      },
    )
    expect(attempt.status).toBe(422)
  })

  test('a support agent alone cannot suspend an organization; a superadmin can', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie, 'PUBLIC')
    const reporter = await createVerifiedUser(app)
    const report = await app.request<{ id: string }>('POST', '/api/v1/reports', {
      body: {
        targetType: 'ORGANIZATION',
        targetId: organizationId,
        category: 'ABUSE',
        description: 'Serious policy violations warranting suspension.',
      },
      cookies: reporter.cookie,
    })

    const supportAgent = await createSupportAgent()
    const deniedAttempt = await app.request(
      'POST',
      `/api/v1/platform/reports/${report.body.id}/suspend-organization`,
      {
        body: { reason: 'Attempting suspension without org-management permission.' },
        cookies: supportAgent.cookie,
      },
    )
    expect(deniedAttempt.status).toBe(403)

    const superadmin = await createPlatformSuperadmin(app)
    const suspended = await app.request<{ status: string }>(
      'POST',
      `/api/v1/platform/reports/${report.body.id}/suspend-organization`,
      { body: { reason: 'Confirmed severe policy violations.' }, cookies: superadmin.cookie },
    )
    expect(suspended.status).toBe(200)
    expect(suspended.body.status).toBe('ACTION_TAKEN')

    const org = await app.request<{ status: string }>(
      'GET',
      `/api/v1/platform/organizations/${organizationId}`,
      { cookies: superadmin.cookie },
    )
    expect(org.body.status).toBe('SUSPENDED')
  })

  test('an ordinary user cannot reach the platform review surface', async () => {
    const user = await createVerifiedUser(app)
    const list = await app.request('GET', '/api/v1/platform/reports', { cookies: user.cookie })
    expect(list.status).toBe(403)
  })
})
