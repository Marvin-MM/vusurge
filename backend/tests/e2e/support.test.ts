import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Support tickets and feature requests (master prompt section 25): the user
 * create/comment/reopen/close surface, the platform staff triage surface,
 * and that internal notes never leak into a user-facing response.
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

async function openTicket(cookie: string) {
  return app.request<{ id: string; status: string; priority: string }>(
    'POST',
    '/api/v1/support/tickets',
    {
      body: {
        category: 'BUG',
        subject: 'Cannot upload a screenshot',
        description: 'The upload button does nothing when I click it.',
      },
      cookies: cookie,
    },
  )
}

test('a user can open, comment on, and close their own ticket', async () => {
  const user = await createVerifiedUser(app)

  const created = await openTicket(user.cookie)
  expect(created.status).toBe(200)
  expect(created.body.status).toBe('OPEN')
  expect(created.body.priority).toBe('NORMAL')

  const listed = await app.request<{ items: { id: string }[] }>('GET', '/api/v1/support/tickets', {
    cookies: user.cookie,
  })
  expect(listed.body.items.map((item) => item.id)).toContain(created.body.id)

  const comment = await app.request('POST', `/api/v1/support/tickets/${created.body.id}/comments`, {
    body: { body: 'Any update?' },
    cookies: user.cookie,
  })
  expect(comment.status).toBe(200)

  const detail = await app.request<{ comments: { body: string }[] }>(
    'GET',
    `/api/v1/support/tickets/${created.body.id}`,
    { cookies: user.cookie },
  )
  expect(detail.body.comments.some((c) => c.body === 'Any update?')).toBe(true)

  const closed = await app.request<{ status: string }>(
    'POST',
    `/api/v1/support/tickets/${created.body.id}/close`,
    { cookies: user.cookie },
  )
  expect(closed.status).toBe(200)
  expect(closed.body.status).toBe('CLOSED')

  // Cannot comment on a closed ticket.
  const commentAfterClose = await app.request(
    'POST',
    `/api/v1/support/tickets/${created.body.id}/comments`,
    { body: { body: 'still there?' }, cookies: user.cookie },
  )
  expect(commentAfterClose.status).toBe(409)
})

test("a stranger cannot see or act on another user's ticket", async () => {
  const owner = await createVerifiedUser(app)
  const stranger = await createVerifiedUser(app)

  const created = await openTicket(owner.cookie)

  const strangerGet = await app.request('GET', `/api/v1/support/tickets/${created.body.id}`, {
    cookies: stranger.cookie,
  })
  expect(strangerGet.status).toBe(404)

  const strangerClose = await app.request(
    'POST',
    `/api/v1/support/tickets/${created.body.id}/close`,
    { cookies: stranger.cookie },
  )
  expect(strangerClose.status).toBe(404)
})

test('ticket screenshots are creator-bound and reviewable only by platform support', async () => {
  const owner = await createVerifiedUser(app)
  const stranger = await createVerifiedUser(app)
  const staff = await createPlatformSuperadmin(app)
  const ticket = await openTicket(owner.cookie)

  const strangerAuthorization = await app.request(
    'POST',
    '/api/v1/media/images/upload-authorization',
    {
      body: {
        purpose: 'SUPPORT_TICKET_SCREENSHOT',
        resourceId: ticket.body.id,
        mimeType: 'image/png',
      },
      cookies: stranger.cookie,
    },
  )
  expect(strangerAuthorization.status).toBe(404)

  const authorization = await app.request<{ assetId: string }>(
    'POST',
    '/api/v1/media/images/upload-authorization',
    {
      body: {
        purpose: 'SUPPORT_TICKET_SCREENSHOT',
        resourceId: ticket.body.id,
        mimeType: 'image/png',
      },
      cookies: owner.cookie,
    },
  )
  expect(authorization.status).toBe(200)

  const confirmed = await app.request('POST', '/api/v1/media/images/confirm', {
    body: { assetId: authorization.body.assetId },
    cookies: owner.cookie,
  })
  expect(confirmed.status).toBe(200)

  const ownerDelivery = await app.request<{ expiresAt: string | null }>(
    'GET',
    `/api/v1/media/images/${authorization.body.assetId}/delivery`,
    { cookies: owner.cookie },
  )
  expect(ownerDelivery.status).toBe(200)
  expect(ownerDelivery.body.expiresAt).not.toBeNull()

  const strangerDelivery = await app.request(
    'GET',
    `/api/v1/media/images/${authorization.body.assetId}/delivery`,
    { cookies: stranger.cookie },
  )
  expect(strangerDelivery.status).toBe(404)

  const staffDelivery = await app.request(
    'GET',
    `/api/v1/media/images/${authorization.body.assetId}/delivery`,
    { cookies: staff.cookie },
  )
  expect(staffDelivery.status).toBe(200)

  const staffDelete = await app.request(
    'DELETE',
    `/api/v1/media/images/${authorization.body.assetId}`,
    { cookies: staff.cookie },
  )
  expect(staffDelete.status).toBe(404)

  const ownerDelete = await app.request(
    'DELETE',
    `/api/v1/media/images/${authorization.body.assetId}`,
    { cookies: owner.cookie },
  )
  expect(ownerDelete.status).toBe(204)
})

test('reopen only works from RESOLVED', async () => {
  const user = await createVerifiedUser(app)
  const created = await openTicket(user.cookie)

  const reopenTooEarly = await app.request(
    'POST',
    `/api/v1/support/tickets/${created.body.id}/reopen`,
    { cookies: user.cookie },
  )
  expect(reopenTooEarly.status).toBe(409)
})

describe('platform staff triage', () => {
  test('staff can assign, prioritize, comment, add internal notes, and resolve', async () => {
    const user = await createVerifiedUser(app)
    const staff = await createPlatformSuperadmin(app)
    const created = await openTicket(user.cookie)
    const ticketId = created.body.id

    const assign = await app.request<{ assignedToUserId: string }>(
      'POST',
      `/api/v1/platform/support/tickets/${ticketId}/assign`,
      { body: { assignedToUserId: staff.userId }, cookies: staff.cookie },
    )
    expect(assign.status).toBe(200)
    expect(assign.body.assignedToUserId).toBe(staff.userId)

    const priority = await app.request<{ priority: string }>(
      'POST',
      `/api/v1/platform/support/tickets/${ticketId}/set-priority`,
      { body: { priority: 'HIGH' }, cookies: staff.cookie },
    )
    expect(priority.body.priority).toBe('HIGH')

    const status = await app.request<{ status: string }>(
      'POST',
      `/api/v1/platform/support/tickets/${ticketId}/change-status`,
      { body: { status: 'IN_PROGRESS' }, cookies: staff.cookie },
    )
    expect(status.body.status).toBe('IN_PROGRESS')

    const staffComment = await app.request(
      'POST',
      `/api/v1/platform/support/tickets/${ticketId}/comments`,
      { body: { body: 'Looking into this now.' }, cookies: staff.cookie },
    )
    expect(staffComment.status).toBe(200)

    const internalNote = await app.request(
      'POST',
      `/api/v1/platform/support/tickets/${ticketId}/internal-notes`,
      { body: { body: 'Looks like a known upload-widget regression.' }, cookies: staff.cookie },
    )
    expect(internalNote.status).toBe(200)

    const resolve = await app.request<{ status: string; resolutionSummary: string }>(
      'POST',
      `/api/v1/platform/support/tickets/${ticketId}/resolve`,
      { body: { resolutionSummary: 'Fixed in the latest deploy.' }, cookies: staff.cookie },
    )
    expect(resolve.status).toBe(200)
    expect(resolve.body.status).toBe('RESOLVED')
    expect(resolve.body.resolutionSummary).toBe('Fixed in the latest deploy.')

    // Platform view includes the internal note; the user-facing view never does.
    const platformDetail = await app.request<{
      internalNotes: { body: string }[]
      comments: { body: string }[]
    }>('GET', `/api/v1/platform/support/tickets/${ticketId}`, { cookies: staff.cookie })
    expect(platformDetail.body.internalNotes.some((n) => n.body.includes('regression'))).toBe(true)
    expect(platformDetail.body.comments.some((c) => c.body === 'Looking into this now.')).toBe(true)

    const userDetail = await app.request<{ comments: { body: string }[] }>(
      'GET',
      `/api/v1/support/tickets/${ticketId}`,
      { cookies: user.cookie },
    )
    expect(JSON.stringify(userDetail.body)).not.toContain('regression')
    expect(userDetail.body.comments.some((c) => c.body === 'Looking into this now.')).toBe(true)

    // The resolution notified the user by email and in-app.
    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(user.email)
    expect(sent).toBeDefined()

    const userNotifications = await app.request<{ items: { category: string }[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: user.cookie },
    )
    expect(
      userNotifications.body.items.some((item) => item.category === 'SUPPORT_TICKET_UPDATE'),
    ).toBe(true)

    // User can now reopen the resolved ticket.
    const reopened = await app.request<{ status: string }>(
      'POST',
      `/api/v1/support/tickets/${ticketId}/reopen`,
      { cookies: user.cookie },
    )
    expect(reopened.status).toBe(200)
    expect(reopened.body.status).toBe('IN_PROGRESS')
  })

  test('a non-support-capable user cannot be assigned a ticket', async () => {
    const user = await createVerifiedUser(app)
    const staff = await createPlatformSuperadmin(app)
    const bystander = await createVerifiedUser(app)
    const created = await openTicket(user.cookie)

    const assign = await app.request(
      'POST',
      `/api/v1/platform/support/tickets/${created.body.id}/assign`,
      { body: { assignedToUserId: bystander.userId }, cookies: staff.cookie },
    )
    expect(assign.status).toBe(422)
  })

  test('an ordinary user cannot reach the platform triage surface', async () => {
    const user = await createVerifiedUser(app)
    const created = await openTicket(user.cookie)

    const listForPlatform = await app.request('GET', '/api/v1/platform/support/tickets', {
      cookies: user.cookie,
    })
    expect(listForPlatform.status).toBe(403)

    const resolve = await app.request(
      'POST',
      `/api/v1/platform/support/tickets/${created.body.id}/resolve`,
      { body: { resolutionSummary: 'nope' }, cookies: user.cookie },
    )
    expect(resolve.status).toBe(403)
  })
})
