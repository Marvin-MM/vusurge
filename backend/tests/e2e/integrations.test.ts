import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Outbound-only Slack/Discord integrations (master prompt section 18):
 * connect/list/update/delete, encrypted-at-rest storage (never returned
 * decrypted), SSRF-blocked destinations, durable asynchronous delivery, and
 * permission boundaries. Provider traffic is replaced at the transport
 * boundary so this suite proves commit-before-send without relying on the
 * public internet.
 */

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp({
    FEATURE_SLACK_INTEGRATION: 'true',
    FEATURE_DISCORD_INTEGRATION: 'true',
  })
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await app.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
  app.infrastructure.fakeIntegrationWebhook.clear()
})

async function approvedOrganization(ownerCookie: string): Promise<{ organizationId: string }> {
  const slug = `integrations-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Integrations Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'An integrations-module fixture organization.',
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

test('connecting a Slack webhook never returns the secret, and a second connect replaces it', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const connected = await app.request<{ id: string; provider: string; status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/slack`,
    {
      body: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxxxxxxxxxxxxxxxxxxxxxxx' },
      cookies: owner.cookie,
    },
  )
  expect(connected.status).toBe(201)
  expect(connected.body.provider).toBe('SLACK')
  expect(connected.body.status).toBe('ACTIVE')
  expect(JSON.stringify(connected.body)).not.toContain('xxxxxxxxxxxxxxxxxxxxxxxx')

  const reconnected = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/slack`,
    {
      body: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/yyyyyyyyyyyyyyyyyyyyyyyy' },
      cookies: owner.cookie,
    },
  )
  // Same (organization, provider) row is replaced, not duplicated.
  expect(reconnected.body.id).toBe(connected.body.id)

  const list = await app.request<{ id: string; provider: string }[]>(
    'GET',
    `/api/v1/organizations/${organizationId}/integrations`,
    { cookies: owner.cookie },
  )
  expect(list.status).toBe(200)
  expect(list.body).toHaveLength(1)

  const queued = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/${connected.body.id}/test`,
    { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: owner.cookie },
  )
  expect(queued.status).toBe(202)
  await flushOutbox(app.infrastructure)
  expect(app.infrastructure.fakeIntegrationWebhook.sent[0]?.webhookUrl).toContain(
    'yyyyyyyyyyyyyyyyyyyyyyyy',
  )
})

test('a webhook URL pointing at a private address is rejected', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const attempt = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/discord`,
    { body: { webhookUrl: 'https://127.0.0.1/api/webhooks/x/y' }, cookies: owner.cookie },
  )
  expect(attempt.status).toBe(422)
})

test('an integration can be disabled, re-enabled, and deleted', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const connected = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/discord`,
    {
      body: { webhookUrl: 'https://discord.com/api/webhooks/123456789/fake-token-value' },
      cookies: owner.cookie,
    },
  )

  const disabled = await app.request<{ status: string }>(
    'PATCH',
    `/api/v1/organizations/${organizationId}/integrations/${connected.body.id}`,
    { body: { status: 'DISABLED' }, cookies: owner.cookie },
  )
  expect(disabled.status).toBe(200)
  expect(disabled.body.status).toBe('DISABLED')

  const deleted = await app.request(
    'DELETE',
    `/api/v1/organizations/${organizationId}/integrations/${connected.body.id}`,
    { cookies: owner.cookie },
  )
  expect(deleted.status).toBe(204)

  const list = await app.request<unknown[]>(
    'GET',
    `/api/v1/organizations/${organizationId}/integrations`,
    { cookies: owner.cookie },
  )
  expect(list.body).toHaveLength(0)
})

test('a test message is committed before dispatch and exact retries replay the obligation', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)

  const connected = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/slack`,
    {
      body: {
        webhookUrl: `https://hooks.slack.com/services/T00/B00/${crypto.randomUUID().replace(/-/g, '')}`,
      },
      cookies: owner.cookie,
    },
  )

  const idempotencyKey = crypto.randomUUID()
  const tested = await app.request<{
    id: string
    status: string
    attempts: number
    succeeded: boolean | null
  }>('POST', `/api/v1/organizations/${organizationId}/integrations/${connected.body.id}/test`, {
    headers: { 'idempotency-key': idempotencyKey },
    cookies: owner.cookie,
  })
  expect(tested.status).toBe(202)
  expect(tested.body).toMatchObject({ status: 'PENDING', attempts: 0, succeeded: null })
  expect(app.infrastructure.fakeIntegrationWebhook.sent).toHaveLength(0)

  const replay = await app.request<typeof tested.body>(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/${connected.body.id}/test`,
    { headers: { 'idempotency-key': idempotencyKey }, cookies: owner.cookie },
  )
  expect(replay.status).toBe(202)
  expect(replay.body).toEqual(tested.body)

  await flushOutbox(app.infrastructure)
  expect(app.infrastructure.fakeIntegrationWebhook.sent).toHaveLength(1)
  expect(app.infrastructure.fakeIntegrationWebhook.sent[0]?.webhookUrl).toContain(
    'hooks.slack.com/services/',
  )

  const deliveries = await app.request<{
    items: { id: string; eventType: string; status: string; attempts: number }[]
  }>(
    'GET',
    `/api/v1/organizations/${organizationId}/integrations/${connected.body.id}/deliveries`,
    { cookies: owner.cookie },
  )
  expect(deliveries.status).toBe(200)
  expect(deliveries.body.items.some((item) => item.id === tested.body.id)).toBe(true)
  expect(deliveries.body.items[0]?.eventType).toBe('integration.test')
  expect(deliveries.body.items[0]).toMatchObject({ status: 'SUCCEEDED', attempts: 1 })
})

test('a retryable provider failure remains pending and records each attempt', async () => {
  const owner = await createVerifiedUser(app)
  const { organizationId } = await approvedOrganization(owner.cookie)
  const connected = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/discord`,
    {
      body: { webhookUrl: 'https://discord.com/api/webhooks/123456789/retry-token-value' },
      cookies: owner.cookie,
    },
  )
  app.infrastructure.fakeIntegrationWebhook.respondNext({
    succeeded: false,
    retryable: true,
    responseStatus: 503,
    errorMessage: 'provider unavailable',
  })
  const tested = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/${connected.body.id}/test`,
    { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: owner.cookie },
  )

  await expect(flushOutbox(app.infrastructure)).rejects.toThrow('provider unavailable')
  const pending = await app.infrastructure.transactions.withTenant(organizationId, (tx) =>
    tx.integrationDelivery.findUniqueOrThrow({
      where: { id: tested.body.id },
      include: { attemptLog: { orderBy: { attemptNumber: 'asc' } } },
    }),
  )
  expect(pending.status).toBe('PENDING')
  expect(pending.attemptLog.map((attempt) => attempt.outcome)).toEqual(['RETRYABLE_FAILURE'])

  await flushOutbox(app.infrastructure)
  const succeeded = await app.infrastructure.transactions.withTenant(organizationId, (tx) =>
    tx.integrationDelivery.findUniqueOrThrow({
      where: { id: tested.body.id },
      include: { attemptLog: { orderBy: { attemptNumber: 'asc' } } },
    }),
  )
  expect(succeeded).toMatchObject({ status: 'SUCCEEDED', attempts: 2 })
  expect(succeeded.attemptLog.map((attempt) => attempt.outcome)).toEqual([
    'RETRYABLE_FAILURE',
    'SUCCEEDED',
  ])
})

test('a plain member without OrganizationManageIntegrations cannot connect an integration', async () => {
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

  const denied = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/integrations/slack`,
    {
      body: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/zzzzzzzzzzzzzzzzzzzzzzzz' },
      cookies: member.cookie,
    },
  )
  expect(denied.status).toBe(403)
})
