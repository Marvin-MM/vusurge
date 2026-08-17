import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { EmailCategory } from '../../src/shared/email'
import { signUp } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

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
  app.infrastructure.fakeEmail.clear()
})

async function readDeliveries<T>(
  work: Parameters<typeof app.infrastructure.transactions.withPlatformAccess<T>>[0],
): Promise<T> {
  return app.infrastructure.transactions.withPlatformAccess(work, {
    purpose: 'Verify durable email delivery state in an integration test.',
  })
}

describe('durable email delivery', () => {
  test('signup persists an encrypted obligation before any provider call', async () => {
    const email = `durable-${crypto.randomUUID()}@example.org`
    const { userId } = await signUp(app, {
      email,
      password: 'correct horse battery staple 1',
      name: 'Durable Delivery',
    })

    expect(app.infrastructure.fakeEmail.latestTo(email)).toBeUndefined()
    const pending = await readDeliveries((tx) =>
      tx.emailDelivery.findFirstOrThrow({
        where: { recipientUserId: userId },
        include: { attemptLog: true },
      }),
    )
    expect(pending.status).toBe('PENDING')
    expect(pending.attemptLog).toHaveLength(0)
    expect(pending.bodyCiphertext).not.toContain('http')
    expect(pending.bodyCiphertext).not.toContain(email)

    expect(await flushOutbox(app.infrastructure)).toBe(1)
    expect(app.infrastructure.fakeEmail.latestTo(email)).toBeDefined()

    const sent = await readDeliveries((tx) =>
      tx.emailDelivery.findUniqueOrThrow({
        where: { id: pending.id },
        include: { attemptLog: true },
      }),
    )
    expect(sent.status).toBe('SENT')
    expect(sent.providerMessageId).toMatch(/^fake-[0-9a-f]{64}$/)
    expect(sent.attemptLog.map((attempt) => attempt.outcome)).toEqual(['SENT'])

    expect(await flushOutbox(app.infrastructure)).toBe(0)
    expect(app.infrastructure.fakeEmail.sent).toHaveLength(1)
  })

  test('a provider failure remains retryable and records both attempts', async () => {
    const email = `retry-${crypto.randomUUID()}@example.org`
    await signUp(app, {
      email,
      password: 'correct horse battery staple 1',
      name: 'Retry Delivery',
    })
    app.infrastructure.fakeEmail.failNext()

    await expect(flushOutbox(app.infrastructure)).rejects.toThrow('Injected email provider failure')
    const failedAttempt = await readDeliveries((tx) =>
      tx.emailDelivery.findFirstOrThrow({
        where: { recipientEmail: email },
        include: { attemptLog: { orderBy: { attemptNumber: 'asc' } } },
      }),
    )
    expect(failedAttempt.status).toBe('PENDING')
    expect(failedAttempt.attemptLog[0]?.outcome).toBe('RETRYABLE_FAILURE')

    expect(await flushOutbox(app.infrastructure)).toBe(1)
    const recovered = await readDeliveries((tx) =>
      tx.emailDelivery.findUniqueOrThrow({
        where: { id: failedAttempt.id },
        include: { attemptLog: { orderBy: { attemptNumber: 'asc' } } },
      }),
    )
    expect(recovered.status).toBe('SENT')
    expect(recovered.attempts).toBe(2)
    expect(recovered.attemptLog.map((attempt) => attempt.outcome)).toEqual([
      'RETRYABLE_FAILURE',
      'SENT',
    ])
  })

  test('reusing a local source key for different content is rejected', async () => {
    const email = `collision-${crypto.randomUUID()}@example.org`
    const { userId } = await signUp(app, {
      email,
      password: 'correct horse battery staple 1',
      name: 'Collision Delivery',
    })
    await flushOutbox(app.infrastructure)
    const original = app.infrastructure.fakeEmail.latestTo(email)
    if (original === undefined) throw new Error('Expected the verification email fixture.')

    await expect(
      app.infrastructure.transactions.withoutTenant(
        (tx) =>
          app.infrastructure.emailDeliveries.enqueue(tx, {
            ...original,
            subject: `${original.subject} changed`,
            recipientUserId: userId,
            sourceType: 'auth.verification',
            sourceKey: original.idempotencyKey,
          }),
        { actorUserId: userId },
      ),
    ).rejects.toThrow('was reused for different content')

    const count = await readDeliveries((tx) => tx.emailDelivery.count())
    expect(count).toBe(1)
    expect(original.category).toBe(EmailCategory.Verification)
  })
})
