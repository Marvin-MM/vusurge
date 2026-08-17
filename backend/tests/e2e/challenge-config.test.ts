import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 2 challenge sub-resources: tracks, prizes, sponsors, and versioned
 * terms. These live inside the challenges module (not separate top-level
 * modules), matching how tightly they are scoped to a single challenge.
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

async function setup(): Promise<{
  owner: { cookie: string }
  organizationId: string
  challengeId: string
}> {
  const owner = await createVerifiedUser(app)
  const slug = `config-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Config Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A challenge-config fixture organization.',
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
    { body: { title: 'Config Challenge', slug: 'config-challenge' }, cookies: owner.cookie },
  )
  return { owner, organizationId, challengeId: created.body.id }
}

describe('challenge tracks', () => {
  test('create, list, update, and archive a track', async () => {
    const { owner, organizationId, challengeId } = await setup()

    const created = await app.request<{ id: string; name: string; archivedAt: string | null }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/tracks`,
      { body: { name: 'AI Track', description: 'For AI projects.' }, cookies: owner.cookie },
    )
    expect(created.status).toBe(201)
    expect(created.body.archivedAt).toBeNull()

    const list = await app.request<{ id: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/tracks`,
      { cookies: owner.cookie },
    )
    expect(list.status).toBe(200)
    expect(list.body).toHaveLength(1)

    const updated = await app.request<{ name: string }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/tracks/${created.body.id}`,
      { body: { name: 'AI & ML Track' }, cookies: owner.cookie },
    )
    expect(updated.status).toBe(200)
    expect(updated.body.name).toBe('AI & ML Track')

    const fetched = await app.request<{ id: string; name: string }>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/tracks/${created.body.id}`,
      { cookies: owner.cookie },
    )
    expect(fetched.status).toBe(200)
    expect(fetched.body.name).toBe('AI & ML Track')

    const archived = await app.request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/tracks/${created.body.id}`,
      { cookies: owner.cookie },
    )
    expect(archived.status).toBe(204)

    const listAfter = await app.request<{ id: string; archivedAt: string | null }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/tracks`,
      { cookies: owner.cookie },
    )
    expect(listAfter.body[0]?.archivedAt).not.toBeNull()
  })
})

describe('challenge prizes', () => {
  test('create, list, update, and delete a prize', async () => {
    const { owner, organizationId, challengeId } = await setup()

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/prizes`,
      { body: { title: 'Grand Prize', valueLabel: '$1000' }, cookies: owner.cookie },
    )
    expect(created.status).toBe(201)

    const updated = await app.request<{ valueLabel: string | null }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/prizes/${created.body.id}`,
      { body: { valueLabel: '$2000' }, cookies: owner.cookie },
    )
    expect(updated.status).toBe(200)
    expect(updated.body.valueLabel).toBe('$2000')

    const deleted = await app.request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/prizes/${created.body.id}`,
      { cookies: owner.cookie },
    )
    expect(deleted.status).toBe(204)

    const list = await app.request<unknown[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/prizes`,
      { cookies: owner.cookie },
    )
    expect(list.body).toHaveLength(0)
  })
})

describe('challenge sponsors', () => {
  test('create, list, update, and delete a sponsor', async () => {
    const { owner, organizationId, challengeId } = await setup()

    const created = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/sponsors`,
      {
        body: { name: 'Acme Corp', websiteUrl: 'https://acme.example.com' },
        cookies: owner.cookie,
      },
    )
    expect(created.status).toBe(201)

    const logoAuthorization = await app.request<{ assetId: string }>(
      'POST',
      '/api/v1/media/images/upload-authorization',
      {
        body: {
          purpose: 'SPONSOR_LOGO',
          organizationId,
          challengeId,
          resourceId: created.body.id,
          mimeType: 'image/png',
        },
        cookies: owner.cookie,
      },
    )
    expect(logoAuthorization.status).toBe(200)
    await app.request('POST', '/api/v1/media/images/confirm', {
      body: { assetId: logoAuthorization.body.assetId },
      cookies: owner.cookie,
    })

    const updated = await app.request<{ tier: string | null; logoAssetId: string | null }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/sponsors/${created.body.id}`,
      {
        body: { tier: 'gold', logoAssetId: logoAuthorization.body.assetId },
        cookies: owner.cookie,
      },
    )
    expect(updated.status).toBe(200)
    expect(updated.body.tier).toBe('gold')
    expect(updated.body.logoAssetId).toBe(logoAuthorization.body.assetId)

    const deleted = await app.request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/sponsors/${created.body.id}`,
      { cookies: owner.cookie },
    )
    expect(deleted.status).toBe(204)
  })
})

describe('challenge terms versions', () => {
  test('create versions and activate exactly one at a time', async () => {
    const { owner, organizationId, challengeId } = await setup()

    const v1 = await app.request<{ id: string; version: number; isActive: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/versions`,
      { body: { content: '# Terms v1\n\nBe nice.' }, cookies: owner.cookie },
    )
    expect(v1.status).toBe(201)
    expect(v1.body.version).toBe(1)
    expect(v1.body.isActive).toBe(false)

    const activateV1 = await app.request<{ isActive: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/versions/${v1.body.id}/activate`,
      { cookies: owner.cookie },
    )
    expect(activateV1.status).toBe(200)
    expect(activateV1.body.isActive).toBe(true)

    const v2 = await app.request<{ id: string; version: number }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/versions`,
      { body: { content: '# Terms v2\n\nBe nicer.' }, cookies: owner.cookie },
    )
    expect(v2.status).toBe(201)
    expect(v2.body.version).toBe(2)

    const activateV2 = await app.request<{ isActive: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/versions/${v2.body.id}/activate`,
      { cookies: owner.cookie },
    )
    expect(activateV2.status).toBe(200)
    expect(activateV2.body.isActive).toBe(true)

    const list = await app.request<{ id: string; isActive: boolean }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms`,
      { cookies: owner.cookie },
    )
    const activeVersions = list.body.filter((version) => version.isActive)
    expect(activeVersions).toHaveLength(1)
    expect(activeVersions[0]?.id).toBe(v2.body.id)

    const current = await app.request<{ id: string; version: number }>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/current`,
      { cookies: owner.cookie },
    )
    expect(current.status).toBe(200)
    expect(current.body.id).toBe(v2.body.id)

    const fetchedV1 = await app.request<{ id: string; content: string }>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/versions/${v1.body.id}`,
      { cookies: owner.cookie },
    )
    expect(fetchedV1.status).toBe(200)
    expect(fetchedV1.body.content).toBe('# Terms v1\n\nBe nice.')

    const participant = await createVerifiedUser(app)
    const accepted = await app.request<{ termsVersionId: string; acceptedAt: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/terms/${v2.body.id}/accept`,
      { cookies: participant.cookie },
    )
    expect(accepted.status).toBe(200)
    expect(accepted.body.termsVersionId).toBe(v2.body.id)
    expect(accepted.body.acceptedAt).toBeTruthy()
  })
})

describe('submission requirement versions', () => {
  test('creates immutable structural snapshots and locks the active version on publish', async () => {
    const { owner, organizationId, challengeId } = await setup()
    const updated = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      {
        body: { submissionRequirements: 'Title, problem, and solution are mandatory.' },
        cookies: owner.cookie,
      },
    )
    expect(updated.status).toBe(200)

    const beforePublish = await app.infrastructure.transactions.withTenant(organizationId, (tx) =>
      tx.challengeSubmissionRequirementVersion.findMany({
        where: { organizationId, challengeId },
        orderBy: { version: 'asc' },
      }),
    )
    expect(beforePublish).toHaveLength(2)
    expect(beforePublish.map((version) => version.isActive)).toEqual([false, true])
    expect(beforePublish[1]?.guidance).toBe('Title, problem, and solution are mandatory.')

    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
      {
        body: {
          submissionDeadline: new Date(Date.now() + 86_400_000).toISOString(),
          reason: 'Configure the submission window.',
        },
        cookies: owner.cookie,
      },
    )
    await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
      { body: {}, cookies: owner.cookie },
    )

    const active = await app.infrastructure.transactions.withTenant(organizationId, (tx) =>
      tx.challengeSubmissionRequirementVersion.findFirstOrThrow({
        where: { organizationId, challengeId, isActive: true },
      }),
    )
    expect(active.lockedAt).not.toBeNull()

    const lateChange = await app.request(
      'PATCH',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}`,
      { body: { submissionRequirements: 'Changed too late.' }, cookies: owner.cookie },
    )
    expect(lateChange.status).toBe(409)

    await expect(
      app.infrastructure.transactions.withTenant(organizationId, (tx) =>
        tx.challengeSubmissionRequirementVersion.update({
          where: { id: active.id },
          data: { requireTitle: false },
        }),
      ),
    ).rejects.toThrow('submission requirement versions are immutable')
  })
})
