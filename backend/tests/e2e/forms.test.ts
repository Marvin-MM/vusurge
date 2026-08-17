import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 2 dynamic forms: versioned form definitions built exclusively from
 * the fixed field-type catalogue (master prompt section 11), AJV-validated
 * on both definition and response submission.
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
  const slug = `forms-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Forms Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A forms-module fixture organization.',
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

describe('dynamic forms', () => {
  test('create a definition, publish a version, and validate a matching response', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const definition = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      {
        body: { purpose: 'CHALLENGE_PARTICIPATION', name: 'Screening Application' },
        cookies: owner.cookie,
      },
    )
    expect(definition.status).toBe(201)

    const schema = {
      fields: [
        { key: 'motivation', type: 'LONG_TEXT', label: 'Why do you want to join?', required: true },
        {
          key: 'yearsExperience',
          type: 'NUMBER',
          label: 'Years of experience',
          required: true,
          min: 0,
        },
        {
          key: 'track',
          type: 'SINGLE_SELECT',
          label: 'Preferred track',
          required: true,
          options: ['AI', 'Web', 'Hardware'],
        },
        { key: 'agreesToTerms', type: 'CONSENT', label: 'I agree to the rules', required: true },
      ],
    }

    const version = await app.request<{ id: string; version: number; isPublished: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions`,
      { body: { schema }, cookies: owner.cookie },
    )
    expect(version.status).toBe(201)
    expect(version.body.version).toBe(1)
    expect(version.body.isPublished).toBe(false)

    // Responding before publication is rejected: no published version yet.
    const tooEarly = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      {
        body: {
          responseData: {
            motivation: 'I love building things.',
            yearsExperience: 3,
            track: 'AI',
            agreesToTerms: true,
          },
        },
        cookies: owner.cookie,
      },
    )
    expect(tooEarly.status).toBe(409)

    const published = await app.request<{ isPublished: boolean }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions/${version.body.id}/publish`,
      { cookies: owner.cookie },
    )
    expect(published.status).toBe(200)
    expect(published.body.isPublished).toBe(true)

    const validResponse = await app.request<{ id: string; responseData: unknown }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      {
        body: {
          responseData: {
            motivation: 'I love building things.',
            yearsExperience: 3,
            track: 'AI',
            agreesToTerms: true,
          },
        },
        cookies: owner.cookie,
      },
    )
    expect(validResponse.status).toBe(201)

    // Missing a required field is rejected.
    const missingField = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      {
        body: { responseData: { motivation: 'x', yearsExperience: 1, track: 'AI' } },
        cookies: owner.cookie,
      },
    )
    expect(missingField.status).toBe(400)

    // An option outside the declared enum is rejected.
    const invalidOption = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      {
        body: {
          responseData: {
            motivation: 'x',
            yearsExperience: 1,
            track: 'Underwater Basket Weaving',
            agreesToTerms: true,
          },
        },
        cookies: owner.cookie,
      },
    )
    expect(invalidOption.status).toBe(400)

    // A required consent that is false is rejected (const: true).
    const declinedConsent = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      {
        body: {
          responseData: { motivation: 'x', yearsExperience: 1, track: 'AI', agreesToTerms: false },
        },
        cookies: owner.cookie,
      },
    )
    expect(declinedConsent.status).toBe(400)

    const responses = await app.request<{ items: { id: string }[] }>(
      'GET',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/responses`,
      { cookies: owner.cookie },
    )
    expect(responses.status).toBe(200)
    expect(responses.body.items).toHaveLength(1)
    expect(responses.body.items[0]?.id).toBe(validResponse.body.id)
  })

  test('a form schema using a disallowed field type is rejected', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const definition = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      { body: { purpose: 'POST_EVENT_SURVEY', name: 'Survey' }, cookies: owner.cookie },
    )

    const badSchema = {
      fields: [{ key: 'script', type: 'SCRIPT', label: 'Run this', required: false }],
    }

    const rejected = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions`,
      { body: { schema: badSchema }, cookies: owner.cookie },
    )
    expect(rejected.status).toBe(400)
  })

  test('a select field without options is rejected', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const definition = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      { body: { purpose: 'POST_EVENT_SURVEY', name: 'Survey' }, cookies: owner.cookie },
    )

    const badSchema = {
      fields: [{ key: 'choice', type: 'SINGLE_SELECT', label: 'Pick one', required: true }],
    }

    const rejected = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions`,
      { body: { schema: badSchema }, cookies: owner.cookie },
    )
    expect(rejected.status).toBe(400)
  })

  test('rename a form definition and fetch a single version by ID', async () => {
    const owner = await createVerifiedUser(app)
    const organizationId = await approvedOrganization(owner.cookie)

    const definition = await app.request<{ id: string; name: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      { body: { purpose: 'POST_EVENT_SURVEY', name: 'Survey' }, cookies: owner.cookie },
    )
    expect(definition.status).toBe(201)

    const renamed = await app.request<{ id: string; name: string }>(
      'PATCH',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}`,
      { body: { name: 'Post-Event Survey (Updated)' }, cookies: owner.cookie },
    )
    expect(renamed.status).toBe(200)
    expect(renamed.body.name).toBe('Post-Event Survey (Updated)')

    const refetched = await app.request<{ name: string }>(
      'GET',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}`,
      { cookies: owner.cookie },
    )
    expect(refetched.body.name).toBe('Post-Event Survey (Updated)')

    const version = await app.request<{ id: string; version: number }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions`,
      {
        body: {
          schema: { fields: [{ key: 'q', type: 'SHORT_TEXT', label: 'Q', required: false }] },
        },
        cookies: owner.cookie,
      },
    )
    expect(version.status).toBe(201)

    const fetchedVersion = await app.request<{ id: string; version: number }>(
      'GET',
      `/api/v1/organizations/${organizationId}/forms/${definition.body.id}/versions/${version.body.id}`,
      { cookies: owner.cookie },
    )
    expect(fetchedVersion.status).toBe(200)
    expect(fetchedVersion.body.id).toBe(version.body.id)
    expect(fetchedVersion.body.version).toBe(1)

    // A version belonging to a different form definition is not found.
    const otherDefinition = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/forms`,
      { body: { purpose: 'POST_EVENT_SURVEY', name: 'Another Survey' }, cookies: owner.cookie },
    )
    const crossDefinitionLookup = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/forms/${otherDefinition.body.id}/versions/${version.body.id}`,
      { cookies: owner.cookie },
    )
    expect(crossDefinitionLookup.status).toBe(404)
  })
})
