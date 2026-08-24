import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

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

describe('platform production administration', () => {
  test('lists users and safely grants and revokes platform roles', async () => {
    const admin = await createPlatformSuperadmin(app)
    const target = await createVerifiedUser(app)

    const users = await app.request<{
      items: { id: string; email: string; platformRoles: { role: string }[] }[]
    }>('GET', `/api/v1/platform/users?search=${encodeURIComponent(target.email)}`, {
      cookies: admin.cookie,
    })
    expect(users.status).toBe(200)
    expect(users.body.items).toHaveLength(1)
    expect(users.body.items[0]?.id).toBe(target.userId)

    const granted = await app.request<{ platformRoles: { role: string }[] }>(
      'POST',
      `/api/v1/platform/users/${target.userId}/roles/grant`,
      {
        body: {
          role: 'PLATFORM_SUPPORT_AGENT',
          reason: 'Assigned to the platform support rotation.',
        },
        cookies: admin.cookie,
      },
    )
    expect(granted.status).toBe(200)
    expect(granted.body.platformRoles.map((item) => item.role)).toContain('PLATFORM_SUPPORT_AGENT')

    const duplicate = await app.request(
      'POST',
      `/api/v1/platform/users/${target.userId}/roles/grant`,
      {
        body: { role: 'PLATFORM_SUPPORT_AGENT', reason: 'Duplicate grant must be rejected.' },
        cookies: admin.cookie,
      },
    )
    expect(duplicate.status).toBe(409)

    const revoked = await app.request<{ platformRoles: { role: string }[] }>(
      'POST',
      `/api/v1/platform/users/${target.userId}/roles/revoke`,
      {
        body: { role: 'PLATFORM_SUPPORT_AGENT', reason: 'Support rotation has now ended.' },
        cookies: admin.cookie,
      },
    )
    expect(revoked.status).toBe(200)
    expect(revoked.body.platformRoles).toHaveLength(0)

    const finalAdmin = await app.request(
      'POST',
      `/api/v1/platform/users/${admin.userId}/roles/revoke`,
      {
        body: {
          role: 'PLATFORM_SUPERADMIN',
          reason: 'Attempting to remove the final superadmin.',
        },
        cookies: admin.cookie,
      },
    )
    expect(finalAdmin.status).toBe(409)
  })

  test('lists private challenges and exposes safe analytics and deployment policy', async () => {
    const owner = await createVerifiedUser(app)
    const admin = await createPlatformSuperadmin(app)
    const slug = `platform-org-${crypto.randomUUID().slice(0, 8)}`
    const application = await app.request<{ id: string }>(
      'POST',
      '/api/v1/organization-applications',
      {
        body: {
          name: 'Platform Oversight Organization',
          requestedSlug: slug,
          organizationType: 'COMPANY',
          description: 'Fixture for platform-wide challenge oversight.',
          requesterRelationship: 'Founder',
          requestedVisibility: 'PRIVATE',
          acceptedTermsVersion: '1.0',
        },
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: owner.cookie,
      },
    )
    const approval = await app.request<{ organizationId: string }>(
      'POST',
      `/api/v1/platform/organization-applications/${application.body.id}/approve`,
      { body: {}, cookies: admin.cookie },
    )
    const challenge = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${approval.body.organizationId}/challenges`,
      {
        body: { title: 'Private Oversight Challenge', slug: 'private-oversight' },
        cookies: owner.cookie,
      },
    )

    const challenges = await app.request<{
      items: { id: string; visibility: string; organizationName: string }[]
    }>('GET', '/api/v1/platform/challenges?search=Oversight', { cookies: admin.cookie })
    expect(challenges.status).toBe(200)
    expect(challenges.body.items).toContainEqual(
      expect.objectContaining({
        id: challenge.body.id,
        visibility: 'ORG_MEMBERS',
        organizationName: 'Platform Oversight Organization',
      }),
    )

    const analytics = await app.request<{ users: number; challenges: number; generatedAt: string }>(
      'GET',
      '/api/v1/platform/analytics/summary',
      { cookies: admin.cookie },
    )
    expect(analytics.status).toBe(200)
    expect(analytics.body.users).toBeGreaterThanOrEqual(2)
    expect(analytics.body.challenges).toBe(1)
    expect(new Date(analytics.body.generatedAt).toString()).not.toBe('Invalid Date')

    const settings = await app.request<{
      environment: string
      featureFlags: Record<string, boolean>
      security: { accountDeletionGraceDays: number }
    }>('GET', '/api/v1/platform/settings', { cookies: admin.cookie })
    expect(settings.status).toBe(200)
    expect(settings.body.environment).toBe('test')
    expect(settings.body.featureFlags).not.toHaveProperty('auth.secret')
    expect(settings.body.security.accountDeletionGraceDays).toBeGreaterThan(0)
  })
})
