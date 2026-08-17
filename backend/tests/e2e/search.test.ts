import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Public search (master prompt section 27): fuzzy name/title search over
 * organizations and challenges, restricted to the same public-safe
 * projections direct listing uses — a private organization or an
 * unpublished/non-public challenge must never surface here.
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

test('search finds a public organization and a public challenge by fuzzy name match', async () => {
  const owner = await createVerifiedUser(app)
  const uniqueWord = `Zephyrion${crypto.randomUUID().slice(0, 6)}`
  const slug = `search-org-${crypto.randomUUID().slice(0, 8)}`

  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `${uniqueWord} Labs`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A search-module fixture organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PUBLIC',
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

  const challengeSlug = `search-challenge-${crypto.randomUUID().slice(0, 8)}`
  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: `${uniqueWord} Hackathon`,
        slug: challengeSlug,
        participationPolicy: 'OPEN_AUTHENTICATED',
        visibility: 'PUBLIC',
      },
      cookies: owner.cookie,
    },
  )
  const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${created.body.id}/reschedule`,
    { body: { submissionDeadline, reason: 'Set the initial deadline.' }, cookies: owner.cookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${created.body.id}/publish`,
    { body: {}, cookies: owner.cookie },
  )

  const result = await app.request<{
    organizations: { name: string }[]
    challenges: { title: string }[]
  }>('GET', `/api/v1/public/search?q=${encodeURIComponent(uniqueWord)}`)
  expect(result.status).toBe(200)
  expect(result.body.organizations.some((o) => o.name === `${uniqueWord} Labs`)).toBe(true)
  expect(result.body.challenges.some((c) => c.title === `${uniqueWord} Hackathon`)).toBe(true)
})

test('search never surfaces a private organization', async () => {
  const owner = await createVerifiedUser(app)
  const uniqueWord = `Confidential${crypto.randomUUID().slice(0, 6)}`
  const slug = `search-private-${crypto.randomUUID().slice(0, 8)}`

  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `${uniqueWord} Corp`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A private search fixture organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PRIVATE',
        acceptedTermsVersion: '1.0',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  const superadmin = await createPlatformSuperadmin(app)
  await app.request(
    'POST',
    `/api/v1/platform/organization-applications/${application.body.id}/approve`,
    { body: {}, cookies: superadmin.cookie },
  )

  const result = await app.request<{ organizations: { name: string }[] }>(
    'GET',
    `/api/v1/public/search?q=${encodeURIComponent(uniqueWord)}`,
  )
  expect(result.body.organizations).toHaveLength(0)
})

test('a blank query returns empty results rather than an error', async () => {
  const result = await app.request<{ organizations: unknown[]; challenges: unknown[] }>(
    'GET',
    '/api/v1/public/search?q=%20',
  )
  expect(result.status).toBe(200)
  expect(result.body.organizations).toHaveLength(0)
  expect(result.body.challenges).toHaveLength(0)
})
