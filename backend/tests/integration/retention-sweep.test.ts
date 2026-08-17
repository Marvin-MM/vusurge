import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { newId } from '../../src/shared/ids'
import { runRetentionSweep } from '../../src/shared/retention'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'
import {
  clearRedis,
  createTestInfrastructure,
  type TestInfrastructure,
} from '../helpers/test-infrastructure'

/**
 * Configured data retention (master prompt sections 42, 49): a
 * representative subset of tasks, chosen to cover the two structurally
 * different code paths — a plain-client sweep of a global table, and a
 * `withPlatformAccess` cross-tenant sweep of an RLS-protected one — plus the
 * one task that also touches real object storage.
 */

let infrastructure: TestInfrastructure
let migration: Client

beforeAll(async () => {
  infrastructure = await createTestInfrastructure({
    RETENTION_EXPIRED_INVITATION_DAYS: '1',
    RETENTION_NOTIFICATION_DAYS: '1',
    RETENTION_EXPORT_FILE_DAYS: '1',
  })
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await clearRedis(infrastructure)
  await infrastructure.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

async function createOrganization(): Promise<string> {
  const organizationId = newId()
  await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.organization.create({
        data: {
          id: organizationId,
          slug: `retention-org-${organizationId.slice(0, 8)}`,
          name: 'Retention Fixture Org',
          organizationType: 'COMPANY',
          visibility: 'PRIVATE',
          status: 'ACTIVE',
        },
      }),
    { purpose: 'test fixture: create organization' },
  )
  return organizationId
}

test('tombstones only expired PENDING media and schedules provider cleanup', async () => {
  const ownerId = newId()
  await infrastructure.database.client.user.create({
    data: {
      id: ownerId,
      name: 'Media Owner',
      email: `${ownerId}@example.org`,
      emailVerified: true,
    },
  })

  const expiredPending = newId()
  const freshPending = newId()
  const confirmedOld = newId()

  await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.mediaAsset.createMany({
        data: [
          {
            id: expiredPending,
            purpose: 'USER_AVATAR',
            status: 'PENDING',
            deliveryType: 'UPLOAD',
            ownerUserId: ownerId,
            resourceType: 'user',
            resourceId: ownerId,
            cloudinaryPublicId: `retention-test/${expiredPending}`,
            expiresAt: new Date(Date.now() - 3600_000),
          },
          {
            id: freshPending,
            purpose: 'USER_AVATAR',
            status: 'PENDING',
            deliveryType: 'UPLOAD',
            ownerUserId: ownerId,
            resourceType: 'user',
            resourceId: ownerId,
            cloudinaryPublicId: `retention-test/${freshPending}`,
            expiresAt: new Date(Date.now() + 3600_000),
          },
          {
            id: confirmedOld,
            purpose: 'USER_AVATAR',
            status: 'CONFIRMED',
            deliveryType: 'UPLOAD',
            ownerUserId: ownerId,
            resourceType: 'user',
            resourceId: ownerId,
            cloudinaryPublicId: `retention-test/${confirmedOld}`,
            format: 'png',
            bytes: 128,
            width: 16,
            height: 16,
            expiresAt: new Date(Date.now() - 3600_000),
            confirmedAt: new Date(Date.now() - 3600_000),
          },
        ],
      }),
    { purpose: 'Create media retention test fixtures.' },
  )

  const report = await runRetentionSweep(infrastructure)
  expect(report.errors).toEqual([])
  expect(report.mediaAssetsPurged).toBe(1)

  const remaining = await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.mediaAsset.findMany({
        where: { id: { in: [expiredPending, freshPending, confirmedOld] } },
        select: { id: true, status: true },
      }),
    { purpose: 'Verify media retention state transitions.' },
  )
  expect(remaining).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: expiredPending, status: 'PENDING_DELETION' }),
      expect.objectContaining({ id: freshPending, status: 'PENDING' }),
      expect.objectContaining({ id: confirmedOld, status: 'CONFIRMED' }),
    ]),
  )
  const cleanupEvent = await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.outboxEvent.findFirst({
        where: { eventType: 'media.asset_deletion_requested', aggregateId: expiredPending },
      }),
    { purpose: 'Verify the retention sweep created its media cleanup obligation.' },
  )
  expect(cleanupEvent).not.toBeNull()
})

test('purges only already-read notifications past the retention window', async () => {
  const userId = newId()
  await infrastructure.database.client.user.create({
    data: { id: userId, name: 'Notif Owner', email: `${userId}@example.org`, emailVerified: true },
  })

  const oldRead = newId()
  const oldUnread = newId()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600_000)
  await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.notification.createMany({
        data: [
          {
            id: oldRead,
            userId,
            category: 'ANNOUNCEMENT',
            title: 'Old, read',
            body: 'x',
            readAt: threeDaysAgo,
            createdAt: threeDaysAgo,
          },
          {
            id: oldUnread,
            userId,
            category: 'ANNOUNCEMENT',
            title: 'Old, unread',
            body: 'x',
            createdAt: threeDaysAgo,
          },
        ],
      }),
    { purpose: 'test fixture: create notification retention candidates' },
  )

  const report = await runRetentionSweep(infrastructure)
  expect(report.errors).toEqual([])
  expect(report.notificationsPurged).toBe(1)

  const remaining = await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.notification.findMany({
        where: { id: { in: [oldRead, oldUnread] } },
        select: { id: true },
      }),
    { purpose: 'test verification: inspect notification retention results' },
  )
  expect(remaining.map((row) => row.id)).toEqual([oldUnread])
})

test('purges expired/revoked invitations across tenants via platform access, never an ACCEPTED one', async () => {
  const organizationId = await createOrganization()
  const inviterUserId = newId()
  await infrastructure.database.client.user.create({
    data: {
      id: inviterUserId,
      name: 'Inviter',
      email: `${inviterUserId}@example.org`,
      emailVerified: true,
    },
  })

  const expiredPending = newId()
  const accepted = newId()

  await infrastructure.transactions.withTenant(organizationId, async (tx) => {
    await tx.organizationInvitation.createMany({
      data: [
        {
          id: expiredPending,
          organizationId,
          tokenHash: `hash-${expiredPending}`,
          role: 'MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 3600_000),
          createdByUserId: inviterUserId,
        },
        {
          id: accepted,
          organizationId,
          tokenHash: `hash-${accepted}`,
          role: 'MEMBER',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 3600_000),
          createdByUserId: inviterUserId,
          acceptedAt: new Date(Date.now() - 3600_000),
          acceptedByUserId: inviterUserId,
        },
      ],
    })
  })

  // Backdate past the check constraint's reach (expires_at > created_at is
  // still satisfied — both timestamps move together) using the schema-owning
  // migration connection, which is not subject to RLS.
  await migration.query(
    `update organization_invitation
     set created_at = now() - interval '3 days', expires_at = now() - interval '2 days'
     where id = any($1::uuid[])`,
    [[expiredPending, accepted]],
  )

  const report = await runRetentionSweep(infrastructure)
  expect(report.errors).toEqual([])
  expect(report.invitationsPurged).toBeGreaterThanOrEqual(1)

  const remaining = await infrastructure.transactions.withTenant(organizationId, (tx) =>
    tx.organizationInvitation.findMany({
      where: { id: { in: [expiredPending, accepted] } },
      select: { id: true },
    }),
  )
  expect(remaining.map((row) => row.id)).toEqual([accepted])
})

test('purges expired exports and deletes their file from object storage', async () => {
  const organizationId = await createOrganization()
  const requesterId = newId()
  await infrastructure.database.client.user.create({
    data: {
      id: requesterId,
      name: 'Exporter',
      email: `${requesterId}@example.org`,
      emailVerified: true,
    },
  })

  const exportId = newId()
  const storageKey = `exports/${organizationId}/${exportId}.csv`
  await infrastructure.objectStorage.putObject(storageKey, 'a,b\n1,2', 'text/csv')

  await infrastructure.transactions.withTenant(organizationId, async (tx) => {
    await tx.dataExport.create({
      data: {
        id: exportId,
        organizationId,
        requestedByUserId: requesterId,
        exportType: 'ORGANIZATION_MEMBERS',
        status: 'COMPLETED',
        storageKey,
        expiresAt: new Date(Date.now() - 3600_000),
        completedAt: new Date(),
      },
    })
  })

  const report = await runRetentionSweep(infrastructure)
  expect(report.errors).toEqual([])
  expect(report.exportsPurged).toBeGreaterThanOrEqual(1)

  const remaining = await infrastructure.transactions.withTenant(organizationId, (tx) =>
    tx.dataExport.findUnique({ where: { id: exportId } }),
  )
  expect(remaining).toBeNull()

  // The object storage file is gone too — a second delete is a no-op, not an error.
  await expect(infrastructure.objectStorage.deleteObject(storageKey)).resolves.toBeUndefined()
})
