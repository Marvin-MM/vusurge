import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Read-only audit trail access: organization-scoped (ORG_ADMIN+) and
 * platform-wide (PLATFORM_SUPERADMIN only, itself audited).
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
  const slug = `audit-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Audit Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'An audit-module fixture organization.',
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

describe('organization audit access', () => {
  test('an owner can list and fetch audit events; a plain member cannot', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const list = await app.request<{ items: { id: string; action: string }[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/audit`,
      { cookies: owner.cookie },
    )
    expect(list.status).toBe(200)
    expect(list.body.items.some((event) => event.action === 'organization.created')).toBe(true)

    const eventId = list.body.items[0]?.id
    expect(eventId).toBeTruthy()
    if (eventId === undefined) throw new Error('unreachable')

    const single = await app.request<{ id: string }>(
      'GET',
      `/api/v1/organizations/${organizationId}/audit/${eventId}`,
      { cookies: owner.cookie },
    )
    expect(single.status).toBe(200)
    expect(single.body.id).toBe(eventId)

    const joinCode = await app.request<{ plaintextCode: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/join-codes`,
      { body: {}, cookies: owner.cookie },
    )
    const member = await createVerifiedUser(app)
    await app.request('POST', '/api/v1/join-codes/redeem', {
      body: { code: joinCode.body.plaintextCode },
      cookies: member.cookie,
    })

    const forbidden = await app.request('GET', `/api/v1/organizations/${organizationId}/audit`, {
      cookies: member.cookie,
    })
    expect(forbidden.status).toBe(403)
  })

  test('an unrelated organization returns 404 for an audit event fetched by ID', async () => {
    const ownerA = await createVerifiedUser(app)
    const organizationA = await approvedOrganization(ownerA.cookie)
    const ownerB = await createVerifiedUser(app)
    const organizationB = await approvedOrganization(ownerB.cookie)

    const listA = await app.request<{ items: { id: string }[] }>(
      'GET',
      `/api/v1/organizations/${organizationA}/audit`,
      { cookies: ownerA.cookie },
    )
    const eventId = listA.body.items[0]?.id
    expect(eventId).toBeTruthy()

    const crossTenant = await app.request(
      'GET',
      `/api/v1/organizations/${organizationB}/audit/${eventId}`,
      { cookies: ownerB.cookie },
    )
    expect(crossTenant.status).toBe(404)
  })
})

describe('platform audit access', () => {
  test('a superadmin can list and fetch platform-wide audit events; an ordinary user cannot', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const superadmin = await createPlatformSuperadmin(app)

    const list = await app.request<{ items: { id: string; organizationId: string | null }[] }>(
      'GET',
      '/api/v1/platform/audit',
      { cookies: superadmin.cookie },
    )
    expect(list.status).toBe(200)
    expect(list.body.items.length).toBeGreaterThan(0)

    const scoped = await app.request<{ items: { id: string; organizationId: string | null }[] }>(
      'GET',
      `/api/v1/platform/audit?organizationId=${organizationId}`,
      { cookies: superadmin.cookie },
    )
    expect(scoped.status).toBe(200)
    for (const event of scoped.body.items) {
      expect(event.organizationId).toBe(organizationId)
    }

    const eventId = scoped.body.items[0]?.id
    expect(eventId).toBeTruthy()
    if (eventId === undefined) throw new Error('unreachable')
    const single = await app.request<{ id: string }>('GET', `/api/v1/platform/audit/${eventId}`, {
      cookies: superadmin.cookie,
    })
    expect(single.status).toBe(200)
    expect(single.body.id).toBe(eventId)

    const forbidden = await app.request('GET', '/api/v1/platform/audit', {
      cookies: owner.cookie,
    })
    expect(forbidden.status).toBe(403)
  })

  test("a superadmin can view an organization's audit summary; an ordinary user cannot", async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)
    const superadmin = await createPlatformSuperadmin(app)

    const summary = await app.request<{
      totalEvents: number
      firstEventAt: string | null
      lastEventAt: string | null
      topActions: { action: string; count: number }[]
    }>('GET', `/api/v1/platform/organizations/${organizationId}/audit-summary`, {
      cookies: superadmin.cookie,
    })
    expect(summary.status).toBe(200)
    expect(summary.body.totalEvents).toBeGreaterThan(0)
    expect(summary.body.firstEventAt).not.toBeNull()
    expect(summary.body.lastEventAt).not.toBeNull()
    expect(summary.body.topActions.some((entry) => entry.action === 'organization.created')).toBe(
      true,
    )

    const forbidden = await app.request(
      'GET',
      `/api/v1/platform/organizations/${organizationId}/audit-summary`,
      { cookies: owner.cookie },
    )
    expect(forbidden.status).toBe(403)

    const missingOrg = await app.request(
      'GET',
      `/api/v1/platform/organizations/${crypto.randomUUID()}/audit-summary`,
      { cookies: superadmin.cookie },
    )
    expect(missingOrg.status).toBe(404)
  })
})
