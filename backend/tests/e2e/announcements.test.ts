import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/** Phase 2 announcements and FAQs (master prompt section 18). */

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
  member: { cookie: string; email: string }
  organizationId: string
}> {
  const owner = await createVerifiedUser(app)
  const slug = `ann-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Announcements Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'An announcements-module fixture organization.',
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

  const member = await createVerifiedUser(app)
  const joinCode = await app.request<{ plaintextCode: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/join-codes`,
    { body: {}, cookies: owner.cookie },
  )
  await app.request('POST', '/api/v1/join-codes/redeem', {
    body: { code: joinCode.body.plaintextCode },
    cookies: member.cookie,
  })

  return { owner, member, organizationId }
}

describe('announcements', () => {
  test('create, publish, and visibility: members see only published', async () => {
    const { owner, member, organizationId } = await setup()

    const created = await app.request<{ id: string; isPublished: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/announcements`,
      {
        body: { title: 'Welcome', body: 'Hello everyone.', deliverEmail: true },
        cookies: owner.cookie,
      },
    )
    expect(created.status).toBe(201)
    expect(created.body.isPublished).toBe(false)

    // A plain member cannot create.
    const forbiddenCreate = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/announcements`,
      { body: { title: 'Nope', body: 'x' }, cookies: member.cookie },
    )
    expect(forbiddenCreate.status).toBe(403)

    // Unpublished: hidden from a plain member (get and list).
    const hiddenGet = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/announcements/${created.body.id}`,
      { cookies: member.cookie },
    )
    expect(hiddenGet.status).toBe(404)

    const hiddenList = await app.request<{ items: unknown[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/announcements`,
      { cookies: member.cookie },
    )
    expect(hiddenList.body.items).toHaveLength(0)

    // Visible to the organizer even unpublished.
    const ownerList = await app.request<{ items: unknown[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/announcements`,
      { cookies: owner.cookie },
    )
    expect(ownerList.body.items).toHaveLength(1)

    const published = await app.request<{ isPublished: boolean; publishedAt: string | null }>(
      'POST',
      `/api/v1/organizations/${organizationId}/announcements/${created.body.id}/publish`,
      { cookies: owner.cookie },
    )
    expect(published.status).toBe(200)
    expect(published.body.isPublished).toBe(true)
    expect(published.body.publishedAt).not.toBeNull()
    await flushOutbox(app.infrastructure)
    expect(app.infrastructure.fakeEmail.latestTo(member.email)?.subject).toBe('Welcome')
    const memberNotifications = await app.request<{
      items: { category: string; title: string }[]
    }>('GET', '/api/v1/me/notifications', { cookies: member.cookie })
    expect(
      memberNotifications.body.items.some(
        (notification) =>
          notification.category === 'ANNOUNCEMENT' && notification.title === 'Welcome',
      ),
    ).toBe(true)

    // Publishing again is rejected.
    const republish = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/announcements/${created.body.id}/publish`,
      { cookies: owner.cookie },
    )
    expect(republish.status).toBe(409)

    // Now visible to the member.
    const visibleGet = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/announcements/${created.body.id}`,
      { cookies: member.cookie },
    )
    expect(visibleGet.status).toBe(200)

    const unpublished = await app.request<{ isPublished: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/announcements/${created.body.id}/unpublish`,
      { cookies: owner.cookie },
    )
    expect(unpublished.status).toBe(200)
    expect(unpublished.body.isPublished).toBe(false)
  })
})

describe('faqs', () => {
  test('create, update, reorder, and delete', async () => {
    const { owner, member, organizationId } = await setup()

    const first = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/faqs`,
      {
        body: { question: 'What is this?', answer: 'A challenge platform.' },
        cookies: owner.cookie,
      },
    )
    const second = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/faqs`,
      {
        body: { question: 'How do I join?', answer: 'Use a join code.' },
        cookies: owner.cookie,
      },
    )
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)

    // Unpublished by default, invisible to a plain member.
    const memberList = await app.request<unknown[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/faqs`,
      {
        cookies: member.cookie,
      },
    )
    expect(memberList.body).toHaveLength(0)

    await app.request('PATCH', `/api/v1/organizations/${organizationId}/faqs/${first.body.id}`, {
      body: { isPublished: true },
      cookies: owner.cookie,
    })
    await app.request('PATCH', `/api/v1/organizations/${organizationId}/faqs/${second.body.id}`, {
      body: { isPublished: true },
      cookies: owner.cookie,
    })

    const reordered = await app.request<{ id: string; displayOrder: number }[]>(
      'POST',
      `/api/v1/organizations/${organizationId}/faqs/reorder`,
      { body: { orderedIds: [second.body.id, first.body.id] }, cookies: owner.cookie },
    )
    expect(reordered.status).toBe(200)

    const memberListAfter = await app.request<{ id: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/faqs`,
      { cookies: member.cookie },
    )
    expect(memberListAfter.body).toHaveLength(2)
    expect(memberListAfter.body[0]?.id).toBe(second.body.id)

    const deleted = await app.request(
      'DELETE',
      `/api/v1/organizations/${organizationId}/faqs/${first.body.id}`,
      { cookies: owner.cookie },
    )
    expect(deleted.status).toBe(204)

    const finalList = await app.request<unknown[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/faqs`,
      {
        cookies: owner.cookie,
      },
    )
    expect(finalList.body).toHaveLength(1)
  })
})
