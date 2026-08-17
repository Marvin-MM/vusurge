import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 5 notifications module (master prompt section 25): in-app fan-out
 * from outbox event handlers, listing/unread-count/mark-read, and
 * preferences — including that security/legal categories cannot be
 * disabled while ordinary categories can.
 */

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp({
    FEATURE_SSE_NOTIFICATIONS: 'true',
    SSE_NOTIFICATION_POLL_MS: '500',
    SSE_NOTIFICATION_MAX_CONNECTIONS_PER_USER: '1',
  })
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await app.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

interface NotificationRow {
  id: string
  category: string
  title: string
  readAt: string | null
}

async function approvedOrganization(ownerCookie: string): Promise<{ organizationId: string }> {
  const slug = `notify-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Notify Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A notifications-module fixture organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PRIVATE',
        acceptedTermsVersion: '1.0',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: ownerCookie,
    },
  )
  expect(application.status).toBe(201)

  const superadmin = await createPlatformSuperadmin(app)
  const approval = await app.request<{ organizationId: string }>(
    'POST',
    `/api/v1/platform/organization-applications/${application.body.id}/approve`,
    { body: {}, cookies: superadmin.cookie },
  )
  expect(approval.status).toBe(200)

  return { organizationId: approval.body.organizationId }
}

test('an organization invitation fans out an in-app notification to an existing account', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const invitee = await createVerifiedUser(app)

  const invitation = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/invitations`,
    {
      body: { email: invitee.email, role: 'MEMBER' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  expect(invitation.status).toBe(201)

  await flushOutbox(app.infrastructure)

  const list = await app.request<{ items: NotificationRow[] }>('GET', '/api/v1/me/notifications', {
    cookies: invitee.cookie,
  })
  expect(list.status).toBe(200)
  expect(list.body.items).toHaveLength(1)
  expect(list.body.items[0]?.category).toBe('ORGANIZATION_INVITE')
  expect(list.body.items[0]?.readAt).toBeNull()

  const unread = await app.request<{ count: number }>(
    'GET',
    '/api/v1/me/notifications/unread-count',
    { cookies: invitee.cookie },
  )
  expect(unread.body.count).toBe(1)

  const notificationId = list.body.items[0]?.id as string
  const markRead = await app.request('POST', `/api/v1/me/notifications/${notificationId}/read`, {
    cookies: invitee.cookie,
  })
  expect(markRead.status).toBe(204)

  const unreadAfter = await app.request<{ count: number }>(
    'GET',
    '/api/v1/me/notifications/unread-count',
    { cookies: invitee.cookie },
  )
  expect(unreadAfter.body.count).toBe(0)
})

test('mark-all-read clears every unread notification for the caller', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const invitee = await createVerifiedUser(app)

  await app.request('POST', `/api/v1/organizations/${organizationId}/invitations`, {
    body: { email: invitee.email, role: 'MEMBER' },
    headers: { 'idempotency-key': crypto.randomUUID() },
    cookies: owner.cookie,
  })
  await app.request('POST', `/api/v1/organizations/${organizationId}/invitations`, {
    body: { email: invitee.email, role: 'MEMBER' },
    headers: { 'idempotency-key': crypto.randomUUID() },
    cookies: owner.cookie,
  })
  await flushOutbox(app.infrastructure)

  const before = await app.request<{ count: number }>(
    'GET',
    '/api/v1/me/notifications/unread-count',
    { cookies: invitee.cookie },
  )
  expect(before.body.count).toBeGreaterThanOrEqual(1)

  const markAll = await app.request('POST', '/api/v1/me/notifications/read-all', {
    cookies: invitee.cookie,
  })
  expect(markAll.status).toBe(204)

  const after = await app.request<{ count: number }>(
    'GET',
    '/api/v1/me/notifications/unread-count',
    { cookies: invitee.cookie },
  )
  expect(after.body.count).toBe(0)
})

test('the authenticated SSE stream emits new notifications and releases its connection slot', async () => {
  const user = await createVerifiedUser(app)
  const streamUrl = `${app.infrastructure.config.app.publicBaseUrl}/api/v1/me/notifications/stream`
  const first = await app.handle(new Request(streamUrl, { headers: { cookie: user.cookie } }))
  expect(first.status).toBe(200)
  expect(first.headers.get('content-type')).toContain('text/event-stream')
  const reader = first.body?.getReader()
  expect(reader).toBeDefined()
  const decoder = new TextDecoder()
  const ready = await reader?.read()
  expect(decoder.decode(ready?.value)).toContain('event: ready')

  const overLimit = await app.handle(new Request(streamUrl, { headers: { cookie: user.cookie } }))
  expect(overLimit.status).toBe(429)

  await Bun.sleep(100)
  await app.infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.userId,
          sourceKey: `sse-test:${crypto.randomUUID()}`,
          category: 'ANNOUNCEMENT',
          title: 'Streamed update',
          body: 'This notification arrived after the stream opened.',
        },
      }),
    { purpose: 'notification-delivery-test' },
  )
  const event = await reader?.read()
  const eventText = decoder.decode(event?.value)
  expect(eventText).toContain('event: notification')
  expect(eventText).toContain('Streamed update')
  await reader?.cancel()

  const reopened = await app.handle(new Request(streamUrl, { headers: { cookie: user.cookie } }))
  expect(reopened.status).toBe(200)
  await reopened.body?.cancel()
})

describe('notification preferences', () => {
  test('disabling a category suppresses fan-out for it', async () => {
    const owner = await createVerifiedUser(app)
    const { organizationId } = await approvedOrganization(owner.cookie)
    const invitee = await createVerifiedUser(app)

    const update = await app.request<{ disabledCategories: string[] }>(
      'PATCH',
      '/api/v1/me/notification-preferences',
      { body: { disabledCategories: ['ORGANIZATION_INVITE'] }, cookies: invitee.cookie },
    )
    expect(update.status).toBe(200)
    expect(update.body.disabledCategories).toEqual(['ORGANIZATION_INVITE'])

    await app.request('POST', `/api/v1/organizations/${organizationId}/invitations`, {
      body: { email: invitee.email, role: 'MEMBER' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    })
    await flushOutbox(app.infrastructure)

    const list = await app.request<{ items: NotificationRow[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: invitee.cookie },
    )
    expect(list.body.items).toHaveLength(0)
  })

  test('a non-disableable category cannot be disabled and still delivers', async () => {
    const applicant = await createVerifiedUser(app)

    const attempt = await app.request<{ disabledCategories: string[] }>(
      'PATCH',
      '/api/v1/me/notification-preferences',
      {
        body: { disabledCategories: ['ORGANIZATION_APPLICATION_DECISION', 'TEAM_INVITATION'] },
        cookies: applicant.cookie,
      },
    )
    expect(attempt.status).toBe(200)
    // The security/legal category is silently dropped; the ordinary one is kept.
    expect(attempt.body.disabledCategories).toEqual(['TEAM_INVITATION'])

    const slug = `notify-decision-org-${crypto.randomUUID().slice(0, 8)}`
    const application = await app.request<{ id: string }>(
      'POST',
      '/api/v1/organization-applications',
      {
        body: {
          name: `Notify Decision Org ${crypto.randomUUID()}`,
          requestedSlug: slug,
          organizationType: 'COMPANY',
          description: 'A non-disableable-category fixture organization.',
          requesterRelationship: 'Founder',
          requestedVisibility: 'PRIVATE',
          acceptedTermsVersion: '1.0',
        },
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: applicant.cookie,
      },
    )
    expect(application.status).toBe(201)

    const superadmin = await createPlatformSuperadmin(app)
    const approval = await app.request(
      'POST',
      `/api/v1/platform/organization-applications/${application.body.id}/approve`,
      { body: {}, cookies: superadmin.cookie },
    )
    expect(approval.status).toBe(200)

    await flushOutbox(app.infrastructure)

    const list = await app.request<{ items: NotificationRow[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: applicant.cookie },
    )
    expect(
      list.body.items.some((item) => item.category === 'ORGANIZATION_APPLICATION_DECISION'),
    ).toBe(true)
  })
})
