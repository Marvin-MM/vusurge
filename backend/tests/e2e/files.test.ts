import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import {
  handleFileDeletionRequested,
  handleFileScanRequested,
} from '../../src/workers/handlers/file-events.handler'
import { createVerifiedUser } from '../helpers/auth-flow'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

interface UploadAuthorization {
  storedObjectId: string
  uploadUrl: string
  requiredHeaders: Record<string, string>
  expiresAt: string
}

interface ConfirmedFile {
  id: string
  scanStatus: string
}

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp({
    FEATURE_DOCUMENT_UPLOADS: 'true',
    MALWARE_SCANNER_ENABLED: 'true',
    MALWARE_SCANNER_HOST: '127.0.0.1',
    MALWARE_SCANNER_PORT: '53310',
  })
  migration = await connectMigrationSql()
  if (!(await app.infrastructure.fileScanner.healthCheck())) {
    throw new Error('The local ClamAV test service is not ready on 127.0.0.1:53310.')
  }
})

afterAll(async () => {
  await app?.dispose()
  await migration?.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

async function setupDraft() {
  const owner = await createVerifiedUser(app)
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Files Org ${crypto.randomUUID()}`,
        requestedSlug: `files-${crypto.randomUUID().slice(0, 10)}`,
        organizationType: 'COMPANY',
        description: 'Private file workflow fixture.',
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
  const organizationId = approval.body.organizationId
  const challenge = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Private Files Challenge',
        slug: `private-files-${crypto.randomUUID().slice(0, 8)}`,
        participationPolicy: 'OPEN_AUTHENTICATED',
      },
      cookies: owner.cookie,
    },
  )
  const challengeId = challenge.body.id
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
    {
      body: {
        submissionDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Open the private-file test submission window.',
      },
      cookies: owner.cookie,
    },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
    { body: {}, cookies: owner.cookie },
  )
  const participant = await createVerifiedUser(app)
  const registration = await app.request<{ status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: participant.cookie },
  )
  expect(registration.status).toBe(201)
  expect(registration.body.status).toBe('APPROVED')
  const submission = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
    { cookies: participant.cookie },
  )
  const draft = await app.request<{ draftVersion: { id: string } }>(
    'PATCH',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submission.body.id}/draft`,
    {
      body: {
        title: 'Document-backed submission',
        problemStatement: 'Presentations must stay private.',
        solutionDescription: 'Quarantine, scan, then authorize.',
      },
      cookies: participant.cookie,
    },
  )
  const resolvedChallenge = await app.infrastructure.accessContextResolver.resolveChallenge(
    challengeId,
    organizationId,
    participant.userId,
  )
  expect(resolvedChallenge?.isApprovedParticipant).toBe(true)

  return {
    owner,
    participant,
    organizationId,
    challengeId,
    submissionId: submission.body.id,
    versionId: draft.body.draftVersion.id,
  }
}

async function authorizeAndUpload(
  fixture: Awaited<ReturnType<typeof setupDraft>>,
  versionId: string,
  bytes: Uint8Array,
) {
  const authorization = await app.request<UploadAuthorization>(
    'POST',
    '/api/v1/files/upload-authorization',
    {
      body: {
        purpose: 'SUBMISSION_PRESENTATION',
        organizationId: fixture.organizationId,
        challengeId: fixture.challengeId,
        resourceId: versionId,
        fileName: 'presentation.pdf',
        contentType: 'application/pdf',
        bytes: bytes.byteLength,
      },
      cookies: fixture.participant.cookie,
    },
  )
  if (authorization.status !== 200) {
    throw new Error(
      `Upload authorization failed (${authorization.status}): ${JSON.stringify(authorization.body)}`,
    )
  }
  expect(authorization.status).toBe(200)

  const upload = await fetch(authorization.body.uploadUrl, {
    method: 'PUT',
    headers: authorization.body.requiredHeaders,
    body: bytes,
  })
  if (upload.status >= 300) {
    throw new Error(`Direct object upload failed (${upload.status}): ${await upload.text()}`)
  }
  expect(upload.status).toBeLessThan(300)
  return authorization.body
}

function jobContext(
  eventType: 'file.scan_requested' | 'file.deletion_requested',
  organizationId: string,
  payload: Record<string, unknown>,
) {
  return {
    infrastructure: app.infrastructure,
    outboxEventId: crypto.randomUUID(),
    eventType,
    organizationId,
    requestId: crypto.randomUUID(),
    payload,
    attempt: 1,
  }
}

describe('private files', () => {
  test('private presentation stays quarantined, becomes downloadable after a clean scan, and deletes durably', async () => {
    const fixture = await setupDraft()
    const capabilities = await app.request<{ documentUploads: boolean }>(
      'GET',
      '/api/v1/meta/capabilities',
    )
    expect(capabilities.body.documentUploads).toBe(true)
    const pdf = new TextEncoder().encode('%PDF-1.7\nclean test document\n%%EOF')
    const authorization = await authorizeAndUpload(fixture, fixture.versionId, pdf)

    const confirmations = await Promise.all([
      app.request<ConfirmedFile>('POST', '/api/v1/files/confirm', {
        body: {
          organizationId: fixture.organizationId,
          storedObjectId: authorization.storedObjectId,
        },
        cookies: fixture.participant.cookie,
      }),
      app.request<ConfirmedFile>('POST', '/api/v1/files/confirm', {
        body: {
          organizationId: fixture.organizationId,
          storedObjectId: authorization.storedObjectId,
        },
        cookies: fixture.participant.cookie,
      }),
    ])
    expect(confirmations.map((response) => response.status)).toEqual([202, 202])
    expect(confirmations[0]?.body.id).toBe(confirmations[1]?.body.id)
    const fileId = confirmations[0]?.body.id as string

    const beforeScan = await app.request('GET', `/api/v1/files/${fileId}/download`, {
      cookies: fixture.participant.cookie,
    })
    expect(beforeScan.status).toBe(409)

    await handleFileScanRequested(
      jobContext('file.scan_requested', fixture.organizationId, {
        organizationId: fixture.organizationId,
        fileId,
      }),
    )

    const download = await app.request<{ downloadUrl: string }>(
      'GET',
      `/api/v1/files/${fileId}/download`,
      { cookies: fixture.participant.cookie },
    )
    expect(download.status).toBe(200)
    const storedBytes = new Uint8Array(await (await fetch(download.body.downloadUrl)).arrayBuffer())
    expect(storedBytes).toEqual(pdf)

    const outsider = await createVerifiedUser(app)
    await app.request(
      'POST',
      `/api/v1/organizations/${fixture.organizationId}/challenges/${fixture.challengeId}/participation/register`,
      { body: {}, cookies: outsider.cookie },
    )
    const outsiderDownload = await app.request('GET', `/api/v1/files/${fileId}/download`, {
      cookies: outsider.cookie,
    })
    expect(outsiderDownload.status).toBe(404)

    const deletion = await app.request('DELETE', `/api/v1/files/${fileId}`, {
      cookies: fixture.participant.cookie,
    })
    expect(deletion.status).toBe(204)
    await handleFileDeletionRequested(
      jobContext('file.deletion_requested', fixture.organizationId, {
        organizationId: fixture.organizationId,
        storedObjectId: authorization.storedObjectId,
        fileId,
      }),
    )
    const afterDeletion = await app.request('GET', `/api/v1/files/${fileId}/download`, {
      cookies: fixture.participant.cookie,
    })
    expect(afterDeletion.status).toBe(404)

    const rows = await migration.query<{ active_file_count: number; stored_bytes: string }>(
      'select active_file_count, stored_bytes::text from organization_limit where organization_id = $1',
      [fixture.organizationId],
    )
    expect(rows.rows[0]).toEqual({ active_file_count: 0, stored_bytes: '0' })
  }, 30_000)

  test('infected documents remain unavailable and cross-tenant confirmation is hidden', async () => {
    const fixture = await setupDraft()
    const nextDraft = await app.request<{ draftVersion: { id: string } }>(
      'PATCH',
      `/api/v1/organizations/${fixture.organizationId}/challenges/${fixture.challengeId}/submissions/${fixture.submissionId}/draft`,
      { body: { tagline: 'Second immutable version' }, cookies: fixture.participant.cookie },
    )
    const eicar = new TextEncoder().encode(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    )
    const authorization = await authorizeAndUpload(fixture, nextDraft.body.draftVersion.id, eicar)

    const hidden = await app.request('POST', '/api/v1/files/confirm', {
      body: { organizationId: crypto.randomUUID(), storedObjectId: authorization.storedObjectId },
      cookies: fixture.participant.cookie,
    })
    expect(hidden.status).toBe(404)

    const confirmed = await app.request<ConfirmedFile>('POST', '/api/v1/files/confirm', {
      body: {
        organizationId: fixture.organizationId,
        storedObjectId: authorization.storedObjectId,
      },
      cookies: fixture.participant.cookie,
    })
    expect(confirmed.status).toBe(202)
    await handleFileScanRequested(
      jobContext('file.scan_requested', fixture.organizationId, {
        organizationId: fixture.organizationId,
        fileId: confirmed.body.id,
      }),
    )

    const download = await app.request('GET', `/api/v1/files/${confirmed.body.id}/download`, {
      cookies: fixture.participant.cookie,
    })
    expect(download.status).toBe(409)
    expect(download.body).toMatchObject({ code: 'FILE_QUARANTINED' })
  }, 30_000)
})
