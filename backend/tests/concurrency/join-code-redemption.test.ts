import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'

/**
 * Join-code redemption under real concurrency, driven through the full HTTP
 * pipeline (Elysia routes → service → the atomic guarded UPDATE in
 * join-codes.repository.redeem). Proves master prompt section 41.4's
 * requirement directly: "join-code usage limit cannot be exceeded."
 */

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
})

afterAll(async () => {
  await app.dispose()
})

async function createOrgWithJoinCode(
  maxUses: number,
): Promise<{ organizationId: string; code: string; ownerCookie: string }> {
  const owner = await createVerifiedUser(app)

  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Concurrency Org ${crypto.randomUUID()}`,
        requestedSlug: `concurrency-${crypto.randomUUID().slice(0, 8)}`,
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

  // A session created moments ago in this same test is already "fresh"
  // (well under the 900-second window authorize() requires), so no extra
  // sign-in round trip is needed to satisfy the fresh-session check.
  const superadmin = await createPlatformSuperadmin(app)

  const approval = await app.request<{ organizationId: string }>(
    'POST',
    `/api/v1/platform/organization-applications/${application.body.id}/approve`,
    { body: {}, cookies: superadmin.cookie },
  )
  expect(approval.status).toBe(200)
  const organizationId = approval.body.organizationId

  const joinCode = await app.request<{ plaintextCode: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/join-codes`,
    { body: { maxUses, expiresInDays: 7 }, cookies: owner.cookie },
  )
  expect(joinCode.status).toBe(200)

  return { organizationId, code: joinCode.body.plaintextCode, ownerCookie: owner.cookie }
}

describe('concurrent join-code redemption', () => {
  test('usage cannot exceed max_uses under concurrent redemption', async () => {
    const maxUses = 3
    const { organizationId, code } = await createOrgWithJoinCode(maxUses)

    // More concurrent redeemers than the code allows.
    const redeemers = await Promise.all(
      Array.from({ length: maxUses + 5 }, () => createVerifiedUser(app)),
    )

    const results = await Promise.all(
      redeemers.map((redeemer) =>
        app.request('POST', '/api/v1/join-codes/redeem', {
          body: { code },
          cookies: redeemer.cookie,
        }),
      ),
    )

    const succeeded = results.filter((result) => result.status === 200)
    const rejected = results.filter((result) => result.status !== 200)

    // Exactly max_uses redemptions succeed, no matter how many raced for it.
    expect(succeeded).toHaveLength(maxUses)
    expect(rejected).toHaveLength(redeemers.length - maxUses)

    // Verification reads go through withPlatformAccess like any other
    // cross-tenant read must: the runtime role is RLS-protected, and a bare
    // Prisma call from the test would see nothing, same as it would in
    // production (this is precisely the property the RLS tests assert).
    const activeMembers = await app.infrastructure.transactions.withPlatformAccess(
      (tx) =>
        tx.organizationMembership.count({
          where: { organizationId, status: 'ACTIVE', source: 'JOIN_CODE' },
        }),
      { purpose: 'test verification' },
    )
    expect(activeMembers).toBe(maxUses)

    const finalCode = await app.infrastructure.transactions.withPlatformAccess(
      (tx) => tx.organizationJoinCode.findFirst({ where: { organizationId } }),
      { purpose: 'test verification' },
    )
    expect(finalCode?.useCount).toBe(maxUses)
  }, 30_000)

  test('a single-use code is redeemed by exactly one of two simultaneous requests', async () => {
    const { code } = await createOrgWithJoinCode(1)
    const [first, second] = await Promise.all([createVerifiedUser(app), createVerifiedUser(app)])

    const [resultA, resultB] = await Promise.all([
      app.request('POST', '/api/v1/join-codes/redeem', { body: { code }, cookies: first.cookie }),
      app.request('POST', '/api/v1/join-codes/redeem', { body: { code }, cookies: second.cookie }),
    ])

    const statuses = [resultA.status, resultB.status].sort()
    // One succeeds (200), one is rejected (404 — exhausted) — never both.
    expect(statuses).toEqual([200, 404])
  }, 15_000)
})
