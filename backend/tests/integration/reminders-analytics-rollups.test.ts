import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createAnalyticsRepository } from '../../src/modules/analytics/analytics.repository'
import { newId } from '../../src/shared/ids'
import { syncChallengeReminderSchedules } from '../../src/shared/reminders'
import { repairAnalyticsRollups } from '../../src/workers/analytics-rollups'
import { dispatchDueReminders } from '../../src/workers/reminder-scheduler'
import { flushOutbox } from '../helpers/outbox-flush'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'
import {
  clearRedis,
  createTestInfrastructure,
  type TestInfrastructure,
} from '../helpers/test-infrastructure'

let infrastructure: TestInfrastructure
let migration: Client

beforeAll(async () => {
  infrastructure = await createTestInfrastructure()
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await resetDatabase(migration)
  await clearRedis(infrastructure)
  await infrastructure.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
  infrastructure.fakeEmail.clear()
})

async function createFixture(): Promise<{
  organizationId: string
  challengeId: string
  userId: string
}> {
  const organizationId = newId()
  const challengeId = newId()
  const userId = newId()
  await infrastructure.database.client.user.create({
    data: {
      id: userId,
      name: 'Scheduled Work Recipient',
      email: `${userId}@example.org`,
      emailVerified: true,
    },
  })
  await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.organization.create({
        data: {
          id: organizationId,
          slug: `scheduled-${organizationId.slice(0, 8)}`,
          name: 'Scheduled Work Org',
          organizationType: 'COMPANY',
        },
      }),
    { purpose: 'test fixture: create scheduled-work organization' },
  )
  await infrastructure.transactions.withTenant(organizationId, async (tx) => {
    await tx.organizationMembership.create({
      data: {
        id: newId(),
        organizationId,
        userId,
        role: 'ORG_OWNER',
        status: 'ACTIVE',
        source: 'TEST',
      },
    })
    await tx.challenge.create({
      data: {
        id: challengeId,
        organizationId,
        title: 'Scheduled Challenge',
        slug: `scheduled-${challengeId.slice(0, 8)}`,
        status: 'OPEN',
        publishedAt: new Date(),
        createdByUserId: userId,
        registrationCloseAt: new Date(Date.now() + 30 * 60_000),
        submissionDeadline: new Date(Date.now() + 48 * 60 * 60_000),
        judgingEndAt: new Date(Date.now() + 72 * 60 * 60_000),
      },
    })
  })
  return { organizationId, challengeId, userId }
}

describe('relational reminder schedules', () => {
  test('reschedules by revision and dispatches one durable reminder per revision', async () => {
    const fixture = await createFixture()
    await infrastructure.transactions.withTenant(fixture.organizationId, async (tx) => {
      const challenge = await tx.challenge.findUniqueOrThrow({
        where: { id: fixture.challengeId },
      })
      const now = await infrastructure.transactions.databaseNow(tx)
      await syncChallengeReminderSchedules(tx, challenge, now, 24)
    })

    const initial = await infrastructure.transactions.withTenant(fixture.organizationId, (tx) =>
      tx.reminderSchedule.findMany({
        where: { challengeId: fixture.challengeId },
        orderBy: { kind: 'asc' },
      }),
    )
    expect(initial).toHaveLength(3)
    expect(new Set(initial.map((row) => row.deterministicKey)).size).toBe(3)

    const registration = initial.find((row) => row.kind === 'REGISTRATION_DEADLINE')
    if (registration === undefined) throw new Error('Missing registration reminder fixture.')
    expect(registration.status).toBe('SCHEDULED')
    expect(registration.revision).toBe(1)

    expect(await dispatchDueReminders(infrastructure)).toBe(1)
    expect(await dispatchDueReminders(infrastructure)).toBe(0)
    await flushOutbox(infrastructure)

    expect(infrastructure.fakeEmail.sent).toHaveLength(1)
    const notification = await infrastructure.transactions.withPlatformAccess(
      (tx) =>
        tx.notification.findFirst({
          where: { userId: fixture.userId, category: 'DEADLINE_REMINDER' },
        }),
      { purpose: 'test verification: inspect emitted deadline reminder' },
    )
    expect(notification).not.toBeNull()

    await infrastructure.transactions.withTenant(fixture.organizationId, async (tx) => {
      const newTarget = new Date(Date.now() + 96 * 60 * 60_000)
      await tx.challenge.update({
        where: { id: fixture.challengeId },
        data: { registrationCloseAt: newTarget },
      })
      const challenge = await tx.challenge.findUniqueOrThrow({
        where: { id: fixture.challengeId },
      })
      await syncChallengeReminderSchedules(
        tx,
        challenge,
        await infrastructure.transactions.databaseNow(tx),
        24,
      )
    })
    const rescheduled = await infrastructure.transactions.withTenant(fixture.organizationId, (tx) =>
      tx.reminderSchedule.findUniqueOrThrow({
        where: { deterministicKey: registration.deterministicKey },
      }),
    )
    expect(rescheduled.id).toBe(registration.id)
    expect(rescheduled.revision).toBe(2)
    expect(rescheduled.status).toBe('SCHEDULED')
  })
})

describe('authoritative analytics rollup repair', () => {
  test('is idempotent, tenant-scoped, and serves a fresh rollup', async () => {
    const fixture = await createFixture()
    expect(await repairAnalyticsRollups(infrastructure)).toBe(1)
    expect(await repairAnalyticsRollups(infrastructure)).toBe(1)

    const rollups = await infrastructure.transactions.withTenant(fixture.organizationId, (tx) =>
      tx.analyticsDailyRollup.findMany({
        where: { organizationId: fixture.organizationId },
        orderBy: { challengeId: 'asc' },
      }),
    )
    expect(rollups).toHaveLength(2)
    expect(new Set(rollups.map((row) => row.scopeKey)).size).toBe(2)
    expect(rollups.find((row) => row.challengeId === null)?.members).toBe(1)

    const repository = createAnalyticsRepository()
    const overview = await infrastructure.transactions.withTenant(fixture.organizationId, (tx) =>
      repository.getOverview(tx, fixture.organizationId),
    )
    expect(overview.members).toBe(1)
    expect(overview.registrations).toBe(0)
  })
})
