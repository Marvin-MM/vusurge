import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import type { Client } from 'pg'
import { createVerifiedUser, signUp } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Resend inbound webhook (master prompt section 34.37): signature
 * verification, idempotent receipt persistence, and the asynchronous
 * suppression-list consequence for bounce/complaint events.
 */

const WEBHOOK_SECRET = 'whsec_dGVzdC13ZWJob29rLXNpZ25pbmctc2VjcmV0'

function sign(svixId: string, svixTimestamp: string, rawBody: string): string {
  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const signature = createHmac('sha256', secretBytes).update(signedContent, 'utf8').digest('base64')
  return `v1,${signature}`
}

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp({ RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET })
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await app.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

describe('Resend webhook', () => {
  test('a validly signed bounce event suppresses the recipient', async () => {
    const email = `bounced-${crypto.randomUUID().slice(0, 8)}@example.com`
    const event = {
      type: 'email.bounced',
      created_at: new Date().toISOString(),
      data: { email_id: crypto.randomUUID(), to: [email], from: 'notify@example.com' },
    }
    const rawBody = JSON.stringify(event)
    const svixId = `msg_${crypto.randomUUID()}`
    const svixTimestamp = Math.floor(Date.now() / 1000).toString()

    const response = await app.request('POST', '/webhooks/resend', {
      body: event,
      headers: {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': sign(svixId, svixTimestamp, rawBody),
      },
    })
    expect(response.status).toBe(200)

    await flushOutbox(app.infrastructure)

    const suppression = await app.infrastructure.database.client.emailSuppression.findUnique({
      where: { email },
    })
    expect(suppression?.reason).toBe('BOUNCE')

    const receipt = await app.infrastructure.database.client.webhookEvent.findFirst({
      where: { provider: 'resend', providerEventId: svixId },
    })
    expect(receipt?.processedAt).not.toBeNull()
  })

  test('a request with an invalid signature is rejected', async () => {
    const event = { type: 'email.bounced', data: { to: ['nobody@example.com'] } }
    const svixId = `msg_${crypto.randomUUID()}`
    const svixTimestamp = Math.floor(Date.now() / 1000).toString()

    const response = await app.request('POST', '/webhooks/resend', {
      body: event,
      headers: {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': 'v1,not-a-real-signature',
      },
    })
    expect(response.status).toBe(401)
  })

  test('a replayed event id is a no-op the second time', async () => {
    const email = `replay-${crypto.randomUUID().slice(0, 8)}@example.com`
    const event = {
      type: 'email.complained',
      data: { to: [email] },
    }
    const rawBody = JSON.stringify(event)
    const svixId = `msg_${crypto.randomUUID()}`
    const svixTimestamp = Math.floor(Date.now() / 1000).toString()
    const headers = {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': sign(svixId, svixTimestamp, rawBody),
    }

    const first = await app.request('POST', '/webhooks/resend', { body: event, headers })
    expect(first.status).toBe(200)
    const second = await app.request('POST', '/webhooks/resend', { body: event, headers })
    expect(second.status).toBe(200)

    const receipts = await app.infrastructure.database.client.webhookEvent.findMany({
      where: { provider: 'resend', providerEventId: svixId },
    })
    expect(receipts).toHaveLength(1)
  })

  test('an older provider event cannot overwrite a newer terminal delivery state', async () => {
    const email = `ordered-${crypto.randomUUID()}@example.org`
    await signUp(app, {
      email,
      password: 'correct horse battery staple 1',
      name: 'Ordered Webhook',
    })
    await flushOutbox(app.infrastructure)
    const delivery = await app.infrastructure.transactions.withPlatformAccess(
      (tx) => tx.emailDelivery.findFirstOrThrow({ where: { recipientEmail: email } }),
      { purpose: 'Read a delivery fixture for webhook ordering verification.' },
    )
    expect(delivery.status).toBe('SENT')
    expect(delivery.providerMessageId).not.toBeNull()

    async function receive(event: object): Promise<void> {
      const rawBody = JSON.stringify(event)
      const svixId = `msg_${crypto.randomUUID()}`
      const svixTimestamp = Math.floor(Date.now() / 1000).toString()
      const response = await app.request('POST', '/webhooks/resend', {
        body: event,
        headers: {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': sign(svixId, svixTimestamp, rawBody),
        },
      })
      expect(response.status).toBe(200)
      await flushOutbox(app.infrastructure)
    }

    const newer = new Date()
    await receive({
      type: 'email.bounced',
      created_at: newer.toISOString(),
      data: { email_id: delivery.providerMessageId, to: [email] },
    })
    await receive({
      type: 'email.delivered',
      created_at: new Date(newer.getTime() - 60_000).toISOString(),
      data: { email_id: delivery.providerMessageId, to: [email] },
    })

    const ordered = await app.infrastructure.transactions.withPlatformAccess(
      (tx) => tx.emailDelivery.findUniqueOrThrow({ where: { id: delivery.id } }),
      { purpose: 'Assert webhook delivery event ordering.' },
    )
    expect(ordered.status).toBe('BOUNCED')
    expect(ordered.lastProviderEventAt?.toISOString()).toBe(newer.toISOString())
  })

  test('a suppressed address is skipped by a later, unrelated send', async () => {
    const email = `suppressed-${crypto.randomUUID().slice(0, 8)}@example.com`
    const event = { type: 'email.bounced', data: { to: [email] } }
    const rawBody = JSON.stringify(event)
    const svixId = `msg_${crypto.randomUUID()}`
    const svixTimestamp = Math.floor(Date.now() / 1000).toString()

    const webhook = await app.request('POST', '/webhooks/resend', {
      body: event,
      headers: {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': sign(svixId, svixTimestamp, rawBody),
      },
    })
    expect(webhook.status).toBe(200)
    await flushOutbox(app.infrastructure)

    const owner = await createVerifiedUser(app)
    const slug = `webhook-org-${crypto.randomUUID().slice(0, 8)}`
    const application = await app.request<{ id: string }>(
      'POST',
      '/api/v1/organization-applications',
      {
        body: {
          name: `Webhook Org ${crypto.randomUUID()}`,
          requestedSlug: slug,
          organizationType: 'COMPANY',
          description: 'A webhook-suppression fixture organization.',
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

    await app.request('POST', `/api/v1/organizations/${approval.body.organizationId}/invitations`, {
      body: { email, role: 'MEMBER' },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    })

    expect(app.infrastructure.fakeEmail.latestTo(email)).toBeUndefined()
  })
})
