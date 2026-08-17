import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ALL_QUEUE_NAMES } from '../../src/shared/queue'
import {
  ALL_SCHEDULED_JOB_NAMES,
  installScheduledJobs,
  SCHEDULED_JOB_CATALOG,
} from '../../src/workers/scheduled-jobs'
import {
  clearRedis,
  createTestInfrastructure,
  type TestInfrastructure,
} from '../helpers/test-infrastructure'

let infrastructure: TestInfrastructure

beforeAll(async () => {
  infrastructure = await createTestInfrastructure({ WORKER_SCHEDULERS_ENABLED: 'true' })
  await clearRedis(infrastructure)
})

afterAll(async () => {
  await clearRedis(infrastructure)
  await infrastructure.dispose()
})

describe('BullMQ Job Scheduler catalogue', () => {
  test('every declared scheduler targets a registered queue', () => {
    expect([...ALL_SCHEDULED_JOB_NAMES] as string[]).toEqual(
      Object.keys(SCHEDULED_JOB_CATALOG).sort(),
    )
    for (const definition of Object.values(SCHEDULED_JOB_CATALOG)) {
      expect(ALL_QUEUE_NAMES).toContain(definition.queue)
      expect(definition.everyMs(infrastructure.config)).toBeGreaterThanOrEqual(10_000)
    }
  })

  test('installation is idempotent and persists every scheduler', async () => {
    await installScheduledJobs(infrastructure)
    await installScheduledJobs(infrastructure)

    for (const jobName of ALL_SCHEDULED_JOB_NAMES) {
      const definition = SCHEDULED_JOB_CATALOG[jobName]
      const persisted = (await infrastructure.queues.get(definition.queue).getJobSchedulers()).find(
        (scheduler) => scheduler.key === jobName,
      )
      expect(persisted?.key).toBe(jobName)
      expect(persisted?.every).toBe(definition.everyMs(infrastructure.config))
    }
  })
})
