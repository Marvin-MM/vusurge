import { type AuditWriter, createAuditWriter } from './shared/audit'
import { type BetterAuthInstance, createBetterAuth } from './shared/auth'
import { type AccessContextResolver, createAccessContextResolver } from './shared/authorization'
import {
  assertQueueRedisEvictionPolicy,
  type Cache,
  createCache,
  createCacheRedis,
  createQueueRedis,
  type RedisConnection,
} from './shared/cache'
import { loadConfig } from './shared/config'
import type { AppConfig } from './shared/config/config.schema'
import {
  createDatabase,
  createTenantTransactionRunner,
  type Database,
  type TenantTransactionRunner,
} from './shared/database'
import {
  createEmailDeliveryManager,
  createEmailProvider,
  type EmailDeliveryManager,
  type EmailProvider,
  SuppressionCheckingEmailProvider,
} from './shared/email'
import { createEncryptionService, type EncryptionService } from './shared/encryption'
import { createFileScanner, type FileScanner } from './shared/file-scanning'
import { createIdempotencyStore, type IdempotencyStore } from './shared/idempotency'
import { createImageProvider, type ImageProvider } from './shared/images'
import {
  createIntegrationWebhookTransport,
  type IntegrationWebhookTransport,
} from './shared/integrations'
import { createLogger, describeError, type Logger } from './shared/logging'
import { initializeTelemetry, type Telemetry } from './shared/observability'
import { createOutboxWriter, type OutboxWriter } from './shared/outbox'
import { createQueueRegistry, type QueueRegistry } from './shared/queue'
import { createRateLimiter, type RateLimiter } from './shared/rate-limit'
import { createObjectStorage, type ObjectStorage } from './shared/storage'

/**
 * The composition root.
 *
 * Every dependency is constructed here, once, and passed explicitly to whatever
 * needs it. There is no DI container, no decorator metadata, and no service
 * locator: the dependency graph is a value you can read top to bottom, and
 * a test can build the same graph with a substitute at any single edge.
 *
 * Construction order follows the dependency order — configuration first,
 * because nothing else may be built until it is known to be valid.
 */

export interface Infrastructure {
  readonly config: AppConfig
  readonly logger: Logger
  readonly telemetry: Telemetry
  readonly database: Database
  readonly transactions: TenantTransactionRunner
  readonly cacheRedis: RedisConnection
  readonly cache: Cache
  readonly queueRedis: RedisConnection
  readonly queues: QueueRegistry
  readonly outbox: OutboxWriter
  readonly audit: AuditWriter
  readonly idempotency: IdempotencyStore
  readonly rateLimiter: RateLimiter
  readonly encryption: EncryptionService
  readonly emailProvider: EmailProvider
  readonly emailDeliveries: EmailDeliveryManager
  readonly imageProvider: ImageProvider
  readonly integrationWebhookTransport: IntegrationWebhookTransport
  readonly objectStorage: ObjectStorage
  readonly fileScanner: FileScanner
  readonly auth: BetterAuthInstance
  readonly accessContextResolver: AccessContextResolver
}

export interface InfrastructureOptions {
  /** Injected by tests; defaults to the process environment. */
  readonly config?: AppConfig
  readonly logger?: Logger
  /**
   * Injected by tests that need to observe outbound email (for example, to
   * extract a verification or invitation link) without depending on a real
   * Resend account. Defaults to the configured provider, which is
   * `NullEmailProvider` whenever `EMAIL_ENABLED` is false.
   */
  readonly emailProvider?: EmailProvider
  /** Injected by tests that need to observe image-provider calls without a real Cloudinary account. */
  readonly imageProvider?: ImageProvider
  readonly integrationWebhookTransport?: IntegrationWebhookTransport
}

// Object storage has no injectable test override: exports are tested against
// the real local MinIO instance, the same "real infrastructure" approach
// already used for PostgreSQL and Redis, not a faked provider boundary.

export function buildInfrastructure(options: InfrastructureOptions = {}): Infrastructure {
  const config = options.config ?? loadConfig()
  const logger = options.logger ?? createLogger(config)

  // Telemetry is installed before anything that emits metrics, so instruments
  // resolve against the real meter provider rather than a no-op.
  const telemetry = initializeTelemetry(config, logger)

  const database = createDatabase(config, logger)
  const transactions = createTenantTransactionRunner(database, config, logger)

  const cacheRedis = createCacheRedis(config, logger)
  const cache = createCache(cacheRedis, config, logger)

  const queueRedis = createQueueRedis(config, logger)
  const queues = createQueueRegistry(queueRedis, config, logger)

  const outbox = createOutboxWriter()
  const encryption = createEncryptionService(config)

  const emailProvider = new SuppressionCheckingEmailProvider(
    options.emailProvider ?? createEmailProvider(config, logger),
    database,
    logger,
  )
  const emailDeliveries = createEmailDeliveryManager({
    transactions,
    outbox,
    encryption,
    provider: emailProvider,
    config,
    logger,
  })
  const imageProvider = options.imageProvider ?? createImageProvider(config, logger)
  const integrationWebhookTransport =
    options.integrationWebhookTransport ?? createIntegrationWebhookTransport()
  const objectStorage = createObjectStorage(config, logger)
  const fileScanner = createFileScanner(config)
  const auth = createBetterAuth(config, database, transactions, emailDeliveries, logger)

  return {
    config,
    logger,
    telemetry,
    database,
    transactions,
    cacheRedis,
    cache,
    queueRedis,
    queues,
    outbox,
    audit: createAuditWriter(),
    idempotency: createIdempotencyStore(transactions, config),
    rateLimiter: createRateLimiter(cacheRedis, config, logger),
    encryption,
    emailProvider,
    emailDeliveries,
    imageProvider,
    integrationWebhookTransport,
    objectStorage,
    fileScanner,
    auth,
    accessContextResolver: createAccessContextResolver(database.client, transactions),
  }
}

/**
 * Connect the lazily-created clients and verify operational preconditions.
 *
 * Called once at startup so a misconfigured deployment fails immediately rather
 * than on the first request that happens to need Redis.
 */
export async function startInfrastructure(infrastructure: Infrastructure): Promise<void> {
  const { cacheRedis, queueRedis, config, logger } = infrastructure

  await Promise.all([
    cacheRedis.status === 'ready' || cacheRedis.status === 'connecting'
      ? Promise.resolve()
      : cacheRedis.connect().catch((error: unknown) => {
          // The cache is optional: a failure here degrades performance, not
          // correctness, so startup continues.
          logger.warn(
            { err: describeError(error) },
            'Cache Redis unavailable at startup; continuing in degraded mode',
          )
        }),
    queueRedis.status === 'ready' || queueRedis.status === 'connecting'
      ? Promise.resolve()
      : queueRedis.connect().catch((error: unknown) => {
          // The queue is also non-fatal for the API: business transactions
          // still commit, and the outbox retains the pending side effects.
          logger.warn(
            { err: describeError(error) },
            'Queue Redis unavailable at startup; outbox dispatch will be delayed',
          )
        }),
  ])

  await assertQueueRedisEvictionPolicy(queueRedis, logger, config.app.environment)
}

/**
 * Release every long-lived resource.
 *
 * Ordering matters: queues close before their Redis connection, and the
 * database closes last so in-flight shutdown work can still record state.
 */
export async function shutdownInfrastructure(infrastructure: Infrastructure): Promise<void> {
  const { logger } = infrastructure

  const steps: [string, () => Promise<unknown>][] = [
    ['queues', () => infrastructure.queues.close()],
    ['queue-redis', () => infrastructure.queueRedis.quit()],
    ['cache-redis', () => infrastructure.cacheRedis.quit()],
    ['database', () => infrastructure.database.disconnect()],
    ['telemetry', () => infrastructure.telemetry.shutdown()],
  ]

  for (const [name, step] of steps) {
    try {
      await step()
    } catch (error) {
      logger.warn({ err: describeError(error), resource: name }, 'Failed to release a resource')
    }
  }
}
