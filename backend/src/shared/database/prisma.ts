import { PrismaPg } from '@prisma/adapter-pg'
import { type Prisma, PrismaClient } from '../../generated/prisma/client'
import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'

/**
 * PostgreSQL access.
 *
 * PostgreSQL is a hard dependency: there is no degraded write mode and no
 * circuit breaker in front of it. If the database is unavailable, authoritative
 * business operations fail clearly rather than pretending to succeed from cache
 * (master prompt section 4.3). Resilience comes from a bounded pool, explicit
 * timeouts, readiness checks, and retrying only genuinely retryable failures.
 *
 * Prisma 7 requires a driver adapter, which is what lets the pool be sized and
 * instrumented here rather than hidden inside an engine binary.
 */

export type { PrismaClient }

/**
 * The subset of the client available inside a transaction.
 *
 * Repositories accept this type so the same code runs inside or outside an
 * explicit transaction, and so a repository can never start or commit one:
 * transaction boundaries belong to services (master prompt section 2.2).
 */
export type PrismaTransactionClient = Prisma.TransactionClient

export interface Database {
  readonly client: PrismaClient
  /** Liveness/readiness probe. Cheap, and never cached. */
  ping(): Promise<boolean>
  /** Pool utilisation for readiness reporting and metrics. */
  poolStats(): { total: number; idle: number; waiting: number }
  disconnect(): Promise<void>
}

export function createDatabase(config: AppConfig, logger: Logger): Database {
  const adapter = new PrismaPg({
    connectionString: config.database.url,
    max: config.database.poolMax,
    connectionTimeoutMillis: config.database.connectionTimeoutMs,
    idleTimeoutMillis: config.database.idleTimeoutMs,
    // Belt and braces: the runtime role also carries a statement_timeout, but
    // stating it on the pool keeps the guarantee visible in application code.
    statement_timeout: config.database.statementTimeoutMs,
    application_name: `${config.app.serviceName}-${config.app.processRole}`,
  })

  const client = new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  })

  const metrics = appMetrics()

  const readPoolStats = () => {
    const pool = (
      adapter as unknown as {
        pool?: { totalCount: number; idleCount: number; waitingCount: number }
      }
    ).pool
    return {
      total: pool?.totalCount ?? 0,
      idle: pool?.idleCount ?? 0,
      waiting: pool?.waitingCount ?? 0,
    }
  }
  metrics.dbPoolInUse.addCallback((result) => {
    const stats = readPoolStats()
    result.observe(Math.max(0, stats.total - stats.idle))
  })
  metrics.dbPoolWaiting.addCallback((result) => result.observe(readPoolStats().waiting))

  client.$on('query', (event) => {
    metrics.dbQueryDuration.record(event.duration)
    if (event.duration >= config.database.slowQueryThresholdMs) {
      metrics.dbSlowQueries.add(1)
      // The query template is logged; parameters are not, because they can
      // contain personal data and tenant content.
      logger.warn({ durationMs: event.duration, query: event.query }, 'Slow database query')
    }
  })

  client.$on('warn', (event) => {
    logger.warn({ target: event.target }, event.message)
  })

  client.$on('error', (event) => {
    if (event.message.includes('Code: `40001`') || event.message.includes('Code: `40P01`')) {
      logger.warn(
        { target: event.target, retryable: true },
        'Retryable database transaction conflict',
      )
      return
    }
    logger.error({ target: event.target }, event.message)
  })

  return {
    client,

    async ping(): Promise<boolean> {
      try {
        await client.$queryRaw`select 1`
        return true
      } catch (error) {
        logger.error({ err: describeError(error) }, 'Database ping failed')
        return false
      }
    },

    poolStats() {
      // The adapter exposes the underlying pg Pool counters.
      return readPoolStats()
    },

    async disconnect(): Promise<void> {
      await client.$disconnect()
    },
  }
}
