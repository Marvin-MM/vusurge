import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Regression coverage: `RateLimitPolicies.StaffInvitationAcceptance` (a
 * 'judge or mentor accepting a challenge staff invitation' policy, `scope:
 * 'ip'`, `riskLevel: 'high'` — see `shared/rate-limit/policies.ts`) was
 * declared but never enforced anywhere. `acceptStaffInvitation` in
 * `judging.service.ts` looked up the invitation straight from its token hash
 * with no rate limiting at all, unlike the equivalent organization-invitation
 * flow (`invitations.service.ts`'s `accept()`, which does enforce
 * `InvitationAcceptance`). A judge/mentor invitation token is exactly as
 * brute-forceable a secret as an organization invitation token, so this was
 * an unprotected guessing surface.
 *
 * `bun test` runs with `RATE_LIMIT_ENABLED=false` by default (see
 * `tests/helpers/test-config.ts`), so this suite spins up its own app with
 * rate limiting turned on. This harness calls `app.handle()` in-process
 * (never a real socket), so `access.ipAddress` is always undefined here and
 * the high-risk `'ip'`-scoped policy fails closed unconditionally — which is
 * exactly what distinguishes "enforced" from "not enforced" for this test:
 * it only needs to observe whether the policy check runs at all, not tune
 * its count.
 */

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp({ RATE_LIMIT_ENABLED: 'true' })
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await app.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

async function approvedOrganizationWithChallenge(): Promise<{
  owner: { cookie: string }
  organizationId: string
  challengeId: string
}> {
  const owner = await createVerifiedUser(app)
  const slug = `staff-rl-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Staff RL Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'Rate-limit regression fixture.',
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
  const organizationId = approval.body.organizationId

  const challenge = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Staff RL Challenge',
        slug: `staff-rl-challenge-${crypto.randomUUID().slice(0, 8)}`,
        summary: 'Rate-limit regression fixture.',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  expect(challenge.status).toBe(201)

  return { owner, organizationId, challengeId: challenge.body.id }
}

describe('staff invitation acceptance is rate-limited', () => {
  test('a MENTOR staff-invitation accept is enforced against RateLimitPolicies.StaffInvitationAcceptance', async () => {
    const { owner, organizationId, challengeId } = await approvedOrganizationWithChallenge()

    const mentor = await createVerifiedUser(app)
    const invitation = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/staff-invitations`,
      { body: { role: 'MENTOR', email: mentor.email }, cookies: owner.cookie },
    )
    expect(invitation.status).toBe(201)

    await flushOutbox(app.infrastructure)
    const sent = app.infrastructure.fakeEmail.latestTo(mentor.email)
    expect(sent).toBeDefined()
    const acceptUrl = app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>)
    const token = new URL(acceptUrl).pathname.split('/').at(-2)

    const accepted = await app.request<{ code?: string }>(
      'POST',
      `/api/v1/challenge-staff-invitations/${token}/accept`,
      { cookies: mentor.cookie },
    )

    // In-process test harness, so `access.ipAddress` is always undefined;
    // a wired-up high-risk 'ip'-scoped policy therefore fails closed. Before
    // this fix, `acceptStaffInvitation` never called `rateLimiter.enforce`
    // at all, so this same request returned 200 regardless of
    // RATE_LIMIT_ENABLED.
    expect(accepted.status).toBe(429)
    expect(accepted.body.code).toBe('RATE_LIMITED')
  })
})
