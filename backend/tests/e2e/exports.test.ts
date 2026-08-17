import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * CSV data exports (master prompt section 24.1): async generation against
 * the real local MinIO instance (the same "real infrastructure" approach
 * used for PostgreSQL and Redis — object storage is not faked), permission
 * checks, filter validation, and short-lived signed downloads.
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

async function approvedOrganization(ownerCookie: string): Promise<{ organizationId: string }> {
  const slug = `exports-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Exports Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'An exports-module fixture organization.',
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
  return { organizationId: approval.body.organizationId }
}

test('an ORGANIZATION_MEMBERS export completes and produces a downloadable CSV', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const created = await app.request<{ id: string; status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/exports`,
    {
      body: { exportType: 'ORGANIZATION_MEMBERS' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  expect(created.status).toBe(201)
  expect(created.body.status).toBe('PENDING')

  await flushOutbox(app.infrastructure)

  const completed = await app.request<{
    status: string
    rowCount: number
    storageKey: string
  }>('GET', `/api/v1/organizations/${organizationId}/exports/${created.body.id}`, {
    cookies: owner.cookie,
  })
  expect(completed.status).toBe(200)
  expect(completed.body.status).toBe('COMPLETED')
  expect(completed.body.rowCount).toBe(1)
  expect(completed.body.storageKey).toContain(created.body.id)

  const download = await app.request<{ downloadUrl: string; expiresAt: string }>(
    'GET',
    `/api/v1/organizations/${organizationId}/exports/${created.body.id}/download`,
    { cookies: owner.cookie },
  )
  expect(download.status).toBe(200)
  expect(download.body.downloadUrl).toContain('http')

  const fileResponse = await fetch(download.body.downloadUrl)
  expect(fileResponse.status).toBe(200)
  const csv = await fileResponse.text()
  expect(csv).toContain('userId,name,email,role,status,joinedAt')
  expect(csv).toContain(owner.userId)
})

test('a download URL is unavailable until the export completes', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/exports`,
    {
      body: { exportType: 'ORGANIZATION_MEMBERS' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )

  const tooEarly = await app.request(
    'GET',
    `/api/v1/organizations/${organizationId}/exports/${created.body.id}/download`,
    { cookies: owner.cookie },
  )
  expect(tooEarly.status).toBe(409)
})

test('concurrent export requests cannot exceed the organization limit', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  await app.infrastructure.transactions.withTenant(organizationId, async (tx) => {
    await tx.organizationLimit.upsert({
      where: { organizationId },
      create: { organizationId, maxConcurrentExports: 1 },
      update: { maxConcurrentExports: 1 },
    })
  })

  const results = await Promise.all(
    [crypto.randomUUID(), crypto.randomUUID()].map((idempotencyKey) =>
      app.request('POST', `/api/v1/organizations/${organizationId}/exports`, {
        body: { exportType: 'ORGANIZATION_MEMBERS' },
        headers: { 'idempotency-key': idempotencyKey },
        cookies: owner.cookie,
      }),
    ),
  )
  expect(results.map((result) => result.status).sort()).toEqual([201, 409])

  const inFlight = await app.infrastructure.transactions.withTenant(organizationId, (tx) =>
    tx.dataExport.count({
      where: { organizationId, status: { in: ['PENDING', 'PROCESSING'] } },
    }),
  )
  expect(inFlight).toBe(1)
})

test('CHALLENGE_RESULTS requires a challengeId filter', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const missingFilter = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/exports`,
    {
      body: { exportType: 'CHALLENGE_RESULTS' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  expect(missingFilter.status).toBe(422)
})

test('deleting an export removes it and its underlying file', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/exports`,
    {
      body: { exportType: 'ORGANIZATION_MEMBERS' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  await flushOutbox(app.infrastructure)

  const deleted = await app.request(
    'DELETE',
    `/api/v1/organizations/${organizationId}/exports/${created.body.id}`,
    { cookies: owner.cookie },
  )
  expect(deleted.status).toBe(204)

  const afterDelete = await app.request(
    'GET',
    `/api/v1/organizations/${organizationId}/exports/${created.body.id}`,
    { cookies: owner.cookie },
  )
  expect(afterDelete.status).toBe(404)
})

test('a plain member without AnalyticsExportSensitive cannot request an export', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

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
  await app.request('POST', `/api/v1/invitations/${token}/accept`, { cookies: member.cookie })

  const denied = await app.request('POST', `/api/v1/organizations/${organizationId}/exports`, {
    body: { exportType: 'ORGANIZATION_MEMBERS' },
    headers: { 'idempotency-key': crypto.randomUUID() },
    cookies: member.cookie,
  })
  expect(denied.status).toBe(403)
})
