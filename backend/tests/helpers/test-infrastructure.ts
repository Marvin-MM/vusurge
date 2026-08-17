import {
  buildInfrastructure,
  type Infrastructure,
  shutdownInfrastructure,
} from '../../src/container'
import { createLogger } from '../../src/shared/logging'
import { createFakeEmailProvider, type FakeEmailProvider } from './fake-email-provider'
import {
  createFakeIntegrationWebhookTransport,
  type FakeIntegrationWebhookTransport,
} from './fake-integration-transport'
import { loadTestConfig } from './test-config'

/**
 * A real infrastructure graph for integration tests.
 *
 * Builds the same object the production entrypoints build, against the same
 * PostgreSQL and Redis instances. Only configuration differs — providers that
 * would require third-party credentials are disabled, and tests that need them
 * substitute a fake at the provider interface.
 */

export interface TestInfrastructure extends Infrastructure {
  dispose(): Promise<void>
  /** Same object as `emailProvider`, narrowed so tests can inspect sent mail. */
  readonly fakeEmail: FakeEmailProvider
  readonly fakeIntegrationWebhook: FakeIntegrationWebhookTransport
}

interface TestInfrastructureOptions {
  /** False only for catalogue/route graph tests that perform no I/O. */
  connectDependencies?: boolean
}

export async function createTestInfrastructure(
  overrides: Partial<Record<string, string>> = {},
  options: TestInfrastructureOptions = {},
): Promise<TestInfrastructure> {
  const config = loadTestConfig(overrides)
  const logger = createLogger(config)
  const fakeEmail = createFakeEmailProvider()
  const fakeIntegrationWebhook = createFakeIntegrationWebhookTransport()
  const infrastructure = buildInfrastructure({
    config,
    logger,
    emailProvider: fakeEmail,
    integrationWebhookTransport: fakeIntegrationWebhook,
  })

  if (options.connectDependencies !== false) {
    // Connect eagerly so a Redis outage surfaces as a setup failure rather
    // than an unrelated assertion failure deep inside a test. Package-level
    // database suites run the consolidated preflight before reaching here.
    await infrastructure.cacheRedis.connect().catch(() => undefined)
    await infrastructure.queueRedis.connect().catch(() => undefined)
  }

  return {
    ...infrastructure,
    fakeEmail,
    fakeIntegrationWebhook,
    async dispose(): Promise<void> {
      if (options.connectDependencies === false) {
        await infrastructure.queues.close()
        infrastructure.queueRedis.disconnect(false)
        infrastructure.cacheRedis.disconnect(false)
        await infrastructure.database.disconnect()
        await infrastructure.telemetry.shutdown()
        return
      }
      await shutdownInfrastructure(infrastructure)
    },
  }
}

/**
 * Remove every key this test run created from the queue and cache Redis.
 *
 * Scoped to the configured prefixes so a stray pattern cannot wipe another
 * database on a shared local Redis.
 */
export async function clearRedis(infrastructure: Infrastructure | undefined): Promise<void> {
  if (infrastructure === undefined) return
  const { cacheRedis, queueRedis, config } = infrastructure

  const scan = async (connection: typeof cacheRedis, pattern: string): Promise<void> => {
    let cursor = '0'
    do {
      const [next, keys] = await connection.scan(cursor, 'MATCH', pattern, 'COUNT', 500)
      cursor = next
      if (keys.length > 0) await connection.del(...keys)
    } while (cursor !== '0')
  }

  // The cache client carries a keyPrefix, so its own commands are already
  // namespaced; SCAN is not, hence the explicit prefix here.
  await scan(cacheRedis, `${config.cacheRedis.keyPrefix}*`)
  await scan(queueRedis, `${config.queueRedis.keyPrefix}*`)
}
