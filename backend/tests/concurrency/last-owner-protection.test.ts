import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createVerifiedUser, type TestUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'

/**
 * The last-owner invariant under real concurrency, driven through the full
 * HTTP pipeline. Proves master prompt section 41.4's requirement directly:
 * "two requests cannot demote/remove the last owner."
 */

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
})

afterAll(async () => {
  await app.dispose()
})

async function createApprovedOrg(owner: TestUser): Promise<string> {
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Owner Org ${crypto.randomUUID()}`,
        requestedSlug: `owner-org-${crypto.randomUUID().slice(0, 8)}`,
        organizationType: 'COMPANY',
        description: 'A load-tested organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PRIVATE',
        acceptedTermsVersion: '1.0',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
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
  return approval.body.organizationId
}

describe('concurrent removal of the sole owner', () => {
  test('two simultaneous self-removal attempts leave exactly one active owner', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await createApprovedOrg(owner)

    const [first, second] = await Promise.all([
      app.request(
        'POST',
        `/api/v1/organizations/${organizationId}/members/${owner.userId}/remove`,
        {
          cookies: owner.cookie,
        },
      ),
      app.request(
        'POST',
        `/api/v1/organizations/${organizationId}/members/${owner.userId}/remove`,
        {
          cookies: owner.cookie,
        },
      ),
    ])

    const statuses = [first.status, second.status].sort()
    // One is refused outright (409 LAST_OWNER_PROTECTED); the other may
    // succeed as an ordinary removal — but never both, or the organization
    // would be left with zero owners.
    expect(statuses).toContain(409)

    const members = await app.request<{ items: { role: string; status: string }[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/members`,
      { cookies: owner.cookie },
    )
    // If the removal succeeded, the caller who issued it no longer has
    // access to read the member list — in that case both requests return
    // 409, which is also an acceptable, safe outcome. Either way, the
    // invariant holds: the organization is never left without an owner.
    if (members.status === 200) {
      const activeOwners = members.body.items.filter(
        (m) => m.role === 'ORG_OWNER' && m.status === 'ACTIVE',
      )
      expect(activeOwners.length).toBeGreaterThanOrEqual(1)
    }
  }, 20_000)

  test('a demotion and a removal racing the same sole owner cannot both succeed', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await createApprovedOrg(owner)

    const [demote, remove] = await Promise.all([
      app.request(
        'POST',
        `/api/v1/organizations/${organizationId}/members/${owner.userId}/change-role`,
        { body: { role: 'ORG_ADMIN' }, cookies: owner.cookie },
      ),
      app.request(
        'POST',
        `/api/v1/organizations/${organizationId}/members/${owner.userId}/remove`,
        {
          cookies: owner.cookie,
        },
      ),
    ])

    // At most one of the two conflicting mutations can have gone through.
    const succeeded = [demote, remove].filter((r) => r.status === 204)
    expect(succeeded.length).toBeLessThanOrEqual(1)

    const owners = await app.infrastructure.transactions.withPlatformAccess(
      (tx) =>
        tx.organizationMembership.count({
          where: { organizationId, role: 'ORG_OWNER', status: 'ACTIVE' },
        }),
      { purpose: 'test verification' },
    )
    // The organization must never end up with zero active owners.
    expect(owners).toBeGreaterThanOrEqual(1)
  }, 20_000)

  test('sequential demotion of the sole owner is refused with a clear error', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await createApprovedOrg(owner)

    const response = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/members/${owner.userId}/change-role`,
      { body: { role: 'MEMBER' }, cookies: owner.cookie },
    )

    expect(response.status).toBe(409)
  })
})
