import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { executeEligibleAccountDeletions } from '../../src/shared/account-deletion'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Account deletion: a grace-period request/cancel workflow (master prompt
 * section 13). Covers the outbox event this triggers end-to-end, including
 * that a confirmation email is actually delivered — the handler for
 * `account.deletion_requested` previously had no registered job handler, so
 * the outbox event was silently dead-lettered.
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
  app.infrastructure.fakeEmail.clear()
})

async function makeDue(requestId: string): Promise<void> {
  await migration.query(
    `update account_deletion_request set eligible_at = now() - interval '1 second' where id = $1`,
    [requestId],
  )
}

describe('account deletion request', () => {
  test('request, confirmation email delivery, and cancel', async () => {
    const user = await createVerifiedUser(app)
    const requestKey = crypto.randomUUID()

    const requested = await app.request<{
      id: string
      status: string
      requestedAt: string
      eligibleAt: string
    }>('POST', '/api/v1/me/account-deletion-request', {
      body: { reason: 'No longer need this account.' },
      headers: { 'idempotency-key': requestKey },
      cookies: user.cookie,
    })
    expect(requested.status).toBe(200)
    expect(requested.body.status).toBe('PENDING')
    expect(new Date(requested.body.eligibleAt).getTime()).toBeGreaterThan(
      new Date(requested.body.requestedAt).getTime(),
    )

    const replay = await app.request<{ id: string }>(
      'POST',
      '/api/v1/me/account-deletion-request',
      {
        body: { reason: 'No longer need this account.' },
        headers: { 'idempotency-key': requestKey },
        cookies: user.cookie,
      },
    )
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(requested.body.id)

    // A different request while one is already pending is a conflict.
    const duplicate = await app.request('POST', '/api/v1/me/account-deletion-request', {
      body: {},
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: user.cookie,
    })
    expect(duplicate.status).toBe(409)

    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(user.email)
    expect(sent).toBeDefined()
    expect(sent?.subject).toBe('Your account deletion request')
    expect(sent?.text).toContain('permanently deleted')

    const cancelled = await app.request('DELETE', '/api/v1/me/account-deletion-request', {
      cookies: user.cookie,
    })
    expect(cancelled.status).toBe(204)

    // Cancelling again with nothing pending is a 404.
    const cancelAgain = await app.request('DELETE', '/api/v1/me/account-deletion-request', {
      cookies: user.cookie,
    })
    expect(cancelAgain.status).toBe(404)

    // After cancellation, a fresh request is accepted again.
    const requestedAgain = await app.request<{ status: string }>(
      'POST',
      '/api/v1/me/account-deletion-request',
      {
        body: {},
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: user.cookie,
      },
    )
    expect(requestedAgain.status).toBe(200)
    expect(requestedAgain.body.status).toBe('PENDING')
  })

  test('due execution revokes credentials and retains a pseudonymous subject', async () => {
    const user = await createVerifiedUser(app)
    await app.request('PATCH', '/api/v1/me/profile', {
      body: {
        displayName: 'Personally Identifying Name',
        bio: 'Private biography to erase.',
        discordHandle: 'private-handle',
        visibility: 'PUBLIC',
      },
      cookies: user.cookie,
    })
    const requested = await app.request<{ id: string }>(
      'POST',
      '/api/v1/me/account-deletion-request',
      {
        body: { reason: 'Exercise the complete workflow.' },
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: user.cookie,
      },
    )
    await flushOutbox(app.infrastructure)
    await makeDue(requested.body.id)

    const report = await executeEligibleAccountDeletions(app.infrastructure)
    expect(report).toMatchObject({ examined: 1, completed: 1, held: 0, blocked: 0 })

    const retained = await app.infrastructure.database.client.user.findUniqueOrThrow({
      where: { id: user.userId },
      include: { profile: true },
    })
    expect(retained.email).toBe(`deleted+${user.userId.replaceAll('-', '')}@invalid.example`)
    expect(retained.name).toBe('Deleted user')
    expect(retained.deletedAt).not.toBeNull()
    expect(retained.emailVerified).toBe(false)
    expect(retained.profile).toMatchObject({
      displayName: 'Deleted user',
      bio: null,
      discordHandle: null,
      visibility: 'PRIVATE',
    })
    expect(
      await app.infrastructure.database.client.session.count({ where: { userId: user.userId } }),
    ).toBe(0)
    expect(
      await app.infrastructure.database.client.account.count({ where: { userId: user.userId } }),
    ).toBe(0)

    const request =
      await app.infrastructure.database.client.accountDeletionRequest.findUniqueOrThrow({
        where: { id: requested.body.id },
      })
    expect(request.status).toBe('COMPLETED')
    expect(request.completedAt).not.toBeNull()

    const delivery = await app.infrastructure.transactions.withPlatformAccess(
      (tx) => tx.emailDelivery.findFirstOrThrow({ where: { recipientUserId: user.userId } }),
      { purpose: 'Verify account-deletion email pseudonymization.' },
    )
    expect(delivery.recipientEmail).toBe(retained.email)
    expect(delivery.bodyCiphertext).not.toContain(user.email)

    const oldSession = await app.request('GET', '/api/v1/me', { cookies: user.cookie })
    expect(oldSession.status).toBe(401)
    const appliedAudit = await app.infrastructure.transactions.withPlatformAccess(
      (tx) =>
        tx.auditEvent.findFirst({
          where: { action: 'account.deletion_applied', resourceId: user.userId },
        }),
      { purpose: 'Verify retained account-deletion audit evidence.' },
    )
    expect(appliedAudit).not.toBeNull()

    await flushOutbox(app.infrastructure)
  })

  test('a legal hold prevents execution without partially changing the account', async () => {
    const user = await createVerifiedUser(app)
    const requested = await app.request<{ id: string }>(
      'POST',
      '/api/v1/me/account-deletion-request',
      {
        body: {},
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: user.cookie,
      },
    )
    await makeDue(requested.body.id)
    await migration.query(
      `update account_deletion_request
       set legal_hold_at = now(), legal_hold_reason = 'Active legal preservation duty'
       where id = $1`,
      [requested.body.id],
    )
    const sessionsBefore = await app.infrastructure.database.client.session.count({
      where: { userId: user.userId },
    })

    const report = await executeEligibleAccountDeletions(app.infrastructure)
    expect(report).toMatchObject({ examined: 1, completed: 0, held: 1, blocked: 0 })
    const retained = await app.infrastructure.database.client.user.findUniqueOrThrow({
      where: { id: user.userId },
    })
    expect(retained.email).toBe(user.email)
    expect(retained.deletedAt).toBeNull()
    expect(
      await app.infrastructure.database.client.session.count({ where: { userId: user.userId } }),
    ).toBe(sessionsBefore)
  })

  test("execution is blocked while the requester is an organization's final owner", async () => {
    const owner = await createVerifiedUser(app)
    const application = await app.request<{ id: string }>(
      'POST',
      '/api/v1/organization-applications',
      {
        body: {
          name: `Deletion Owner Org ${crypto.randomUUID()}`,
          requestedSlug: `deletion-owner-${crypto.randomUUID().slice(0, 8)}`,
          organizationType: 'COMPANY',
          description: 'Last-owner deletion invariant fixture.',
          requesterRelationship: 'Founder',
          requestedVisibility: 'PRIVATE',
          acceptedTermsVersion: '1.0',
        },
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: owner.cookie,
      },
    )
    const superadmin = await createPlatformSuperadmin(app)
    const approval = await app.request(
      'POST',
      `/api/v1/platform/organization-applications/${application.body.id}/approve`,
      { body: {}, cookies: superadmin.cookie },
    )
    expect(approval.status).toBe(200)

    const requested = await app.request<{ id: string }>(
      'POST',
      '/api/v1/me/account-deletion-request',
      {
        body: {},
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: owner.cookie,
      },
    )
    await makeDue(requested.body.id)

    const report = await executeEligibleAccountDeletions(app.infrastructure)
    expect(report).toMatchObject({ completed: 0, blocked: 1 })
    const request =
      await app.infrastructure.database.client.accountDeletionRequest.findUniqueOrThrow({
        where: { id: requested.body.id },
      })
    expect(request.status).toBe('PENDING')
    expect(request.executionAttempts).toBe(1)
    expect(request.lastExecutionError).toContain('ownership')
    const retained = await app.infrastructure.database.client.user.findUniqueOrThrow({
      where: { id: owner.userId },
    })
    expect(retained.deletedAt).toBeNull()
  })
})

describe('GET /me: platform role self-identification', () => {
  test('reports null for an ordinary user and the real role for a platform admin', async () => {
    const ordinary = await createVerifiedUser(app)
    const ordinaryMe = await app.request<{ platformRole: string | null }>('GET', '/api/v1/me', {
      cookies: ordinary.cookie,
    })
    expect(ordinaryMe.status).toBe(200)
    expect(ordinaryMe.body.platformRole).toBeNull()

    const superadmin = await createPlatformSuperadmin(app)
    const superadminMe = await app.request<{ platformRole: string | null }>('GET', '/api/v1/me', {
      cookies: superadmin.cookie,
    })
    expect(superadminMe.status).toBe(200)
    expect(superadminMe.body.platformRole).toBe('PLATFORM_SUPERADMIN')
  })
})
