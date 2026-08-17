import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ALL_DOMAIN_EVENT_TYPES, DOMAIN_EVENT_CATALOG } from '../../src/shared/outbox'
import { ALL_QUEUE_NAMES } from '../../src/shared/queue'
import { registerJobHandlers } from '../../src/workers/register-handlers'
import { createTestInfrastructure, type TestInfrastructure } from '../helpers/test-infrastructure'

let infrastructure: TestInfrastructure

beforeAll(async () => {
  infrastructure = await createTestInfrastructure({}, { connectDependencies: false })
})

afterAll(async () => {
  await infrastructure?.dispose()
})

describe('domain event catalogue', () => {
  test('has exactly one registered handler for every declared event', () => {
    const router = registerJobHandlers(infrastructure)
    expect(router.registeredEventTypes()).toEqual(ALL_DOMAIN_EVENT_TYPES)
  })

  test('routes every event to a declared queue', () => {
    for (const [eventType, queue] of Object.entries(DOMAIN_EVENT_CATALOG)) {
      expect(eventType).toMatch(/^[a-z][a-z0-9_.]+$/)
      expect(ALL_QUEUE_NAMES).toContain(queue)
    }
  })
})
