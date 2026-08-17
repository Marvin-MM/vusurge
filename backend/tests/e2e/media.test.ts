import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 2 media (Cloudinary image-only signed uploads, master prompt
 * section 22.1). Tests run with CLOUDINARY_ENABLED=false, so the
 * NullImageProvider stands in — the full upload-authorization → confirm →
 * delivery → delete lifecycle is still exercised end to end through the
 * real HTTP pipeline; only the actual Cloudinary network call is a no-op.
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
  const slug = `media-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Media Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A media-module fixture organization.',
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

describe('media: user avatar', () => {
  test('upload-authorization → confirm → delivery → delete, self-service', async () => {
    const user = await createVerifiedUser(app)

    const authorization = await app.request<{ assetId: string; publicId: string }>(
      'POST',
      '/api/v1/media/images/upload-authorization',
      { body: { purpose: 'USER_AVATAR', mimeType: 'image/png' }, cookies: user.cookie },
    )
    expect(authorization.status).toBe(200)
    expect(authorization.body.publicId).toBe(authorization.body.assetId)

    const confirmed = await app.request<{ status: string; format: string | null }>(
      'POST',
      '/api/v1/media/images/confirm',
      { body: { assetId: authorization.body.assetId }, cookies: user.cookie },
    )
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.status).toBe('CONFIRMED')
    expect(confirmed.body.format).not.toBeNull()

    // Confirming again is idempotent.
    const reconfirmed = await app.request<{ status: string }>(
      'POST',
      '/api/v1/media/images/confirm',
      { body: { assetId: authorization.body.assetId }, cookies: user.cookie },
    )
    expect(reconfirmed.status).toBe(200)
    expect(reconfirmed.body.status).toBe('CONFIRMED')

    const attached = await app.request<{ avatarAssetId: string | null }>(
      'PATCH',
      '/api/v1/me/profile',
      { body: { avatarAssetId: authorization.body.assetId }, cookies: user.cookie },
    )
    expect(attached.status).toBe(200)
    expect(attached.body.avatarAssetId).toBe(authorization.body.assetId)

    const delivery = await app.request<{ url: string; expiresAt: string | null }>(
      'GET',
      `/api/v1/media/images/${authorization.body.assetId}/delivery`,
      { cookies: user.cookie },
    )
    expect(delivery.status).toBe(200)
    expect(delivery.body.url).toContain(authorization.body.publicId)
    expect(delivery.body.expiresAt).not.toBeNull()
    expect(new URL(delivery.body.url).searchParams.get('expires_at')).not.toBeNull()

    // Another user cannot delete someone else's avatar.
    const outsider = await createVerifiedUser(app)
    const forbiddenDelete = await app.request(
      'DELETE',
      `/api/v1/media/images/${authorization.body.assetId}`,
      { cookies: outsider.cookie },
    )
    // Cross-owner access is hidden to prevent asset-ID enumeration.
    expect(forbiddenDelete.status).toBe(404)

    const referencedDelete = await app.request(
      'DELETE',
      `/api/v1/media/images/${authorization.body.assetId}`,
      { cookies: user.cookie },
    )
    expect(referencedDelete.status).toBe(409)

    await app.request('PATCH', '/api/v1/me/profile', {
      body: { avatarAssetId: null },
      cookies: user.cookie,
    })
    const deleted = await app.request(
      'DELETE',
      `/api/v1/media/images/${authorization.body.assetId}`,
      { cookies: user.cookie },
    )
    expect(deleted.status).toBe(204)

    const deliveryAfterDelete = await app.request(
      'GET',
      `/api/v1/media/images/${authorization.body.assetId}/delivery`,
      { cookies: user.cookie },
    )
    expect(deliveryAfterDelete.status).toBe(404)
  })

  test('rejects an unsupported MIME type', async () => {
    const user = await createVerifiedUser(app)
    const rejected = await app.request('POST', '/api/v1/media/images/upload-authorization', {
      body: { purpose: 'USER_AVATAR', mimeType: 'application/pdf' },
      cookies: user.cookie,
    })
    expect(rejected.status).toBe(400)
  })

  test('rejects an organizationId for a user-scoped purpose', async () => {
    const user = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(user.cookie)
    const rejected = await app.request('POST', '/api/v1/media/images/upload-authorization', {
      body: { purpose: 'USER_AVATAR', organizationId, mimeType: 'image/png' },
      cookies: user.cookie,
    })
    expect(rejected.status).toBe(400)
  })
})

describe('media: organization logo', () => {
  test('requires organization profile-management permission', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const authorized = await app.request<{ assetId: string }>(
      'POST',
      '/api/v1/media/images/upload-authorization',
      {
        body: { purpose: 'ORGANIZATION_LOGO', organizationId, mimeType: 'image/png' },
        cookies: owner.cookie,
      },
    )
    expect(authorized.status).toBe(200)

    const confirmed = await app.request<{ status: string }>(
      'POST',
      '/api/v1/media/images/confirm',
      {
        body: { assetId: authorized.body.assetId },
        cookies: owner.cookie,
      },
    )
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.status).toBe('CONFIRMED')

    const publicBeforeAttachment = await app.request(
      'GET',
      `/api/v1/public/media/images/${authorized.body.assetId}/delivery`,
    )
    expect(publicBeforeAttachment.status).toBe(404)

    await app.request('PATCH', `/api/v1/organizations/${organizationId}/settings`, {
      body: { visibility: 'PUBLIC' },
      cookies: owner.cookie,
    })

    const applyToOrg = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/profile`,
      {
        body: { name: 'Renamed Org', logoAssetId: authorized.body.assetId },
        cookies: owner.cookie,
      },
    )
    expect(applyToOrg.status).toBe(200)

    const publicDelivery = await app.request<{ url: string; expiresAt: string | null }>(
      'GET',
      `/api/v1/public/media/images/${authorized.body.assetId}/delivery`,
    )
    expect(publicDelivery.status).toBe(200)
    expect(publicDelivery.body.url).toContain(authorized.body.assetId)
    expect(publicDelivery.body.expiresAt).not.toBeNull()

    // An unrelated user cannot request an upload authorization scoped to this org.
    const outsider = await createVerifiedUser(app)
    const forbidden = await app.request('POST', '/api/v1/media/images/upload-authorization', {
      body: { purpose: 'ORGANIZATION_LOGO', organizationId, mimeType: 'image/png' },
      cookies: outsider.cookie,
    })
    expect(forbidden.status).toBe(404)
  })

  test('a resource-scoped purpose is rejected without its required scope', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const rejected = await app.request('POST', '/api/v1/media/images/upload-authorization', {
      body: { purpose: 'SUBMISSION_SCREENSHOT', organizationId, mimeType: 'image/png' },
      cookies: owner.cookie,
    })
    expect(rejected.status).toBe(400)
  })
})
