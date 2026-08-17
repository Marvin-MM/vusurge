import { Redis, type RedisOptions } from 'ioredis'
import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'

/**
 * Redis connections.
 *
 * Two physically separate deployments are used, and they are not
 * interchangeable (master prompt section 4.5):
 *
 *   cache  — volatile. TTL-friendly eviction. Losing it degrades latency only.
 *   queue  — BullMQ. MUST run with maxmemory-policy=noeviction, because evicting
 *            a job hash silently destroys work that the outbox believes is in
 *            flight.
 *
 * Separate logical database numbers on one server would NOT achieve this:
 * eviction policy and memory limits are per-server, not per-database.
 */

export type RedisConnection = Redis

interface CreateRedisOptions {
  readonly url: string
  readonly keyPrefix?: string
  readonly commandTimeoutMs?: number
  /**
   * BullMQ requires unlimited per-request retries: it blocks on connections for
   * long periods and a capped retry turns a brief blip into a job failure.
   */
  readonly forBullMq?: boolean
  readonly connectionName: string
}

export function createRedisConnection(
  options: CreateRedisOptions,
  logger: Logger,
): RedisConnection {
  const redisOptions: RedisOptions = {
    connectionName: options.connectionName,
    lazyConnect: true,
    enableAutoPipelining: true,
    // BullMQ mandates null here; the cache client keeps a small bound so a
    // failing command fails fast rather than stalling a request.
    maxRetriesPerRequest: options.forBullMq ? null : 1,
    ...(options.keyPrefix ? { keyPrefix: options.keyPrefix } : {}),
    ...(options.commandTimeoutMs ? { commandTimeout: options.commandTimeoutMs } : {}),
    retryStrategy(times: number) {
      // Exponential backoff with a ceiling, so a long outage does not turn into
      // a reconnect storm when the server returns.
      return Math.min(times * 200, 5_000)
    },
  }

  const connection = new Redis(options.url, redisOptions)

  connection.on('error', (error: unknown) => {
    // Logged at warn: cache errors are expected to be survivable, and the
    // circuit breaker decides when they become significant.
    logger.warn(
      { err: describeError(error), connection: options.connectionName },
      'Redis connection error',
    )
  })

  connection.on('end', () => {
    logger.info({ connection: options.connectionName }, 'Redis connection closed')
  })

  return connection
}

export function createCacheRedis(config: AppConfig, logger: Logger): RedisConnection {
  return createRedisConnection(
    {
      url: config.cacheRedis.url,
      keyPrefix: config.cacheRedis.keyPrefix,
      commandTimeoutMs: config.cacheRedis.commandTimeoutMs,
      connectionName: `${config.app.serviceName}-cache`,
    },
    logger,
  )
}

export function createQueueRedis(config: AppConfig, logger: Logger): RedisConnection {
  return createRedisConnection(
    {
      url: config.queueRedis.url,
      forBullMq: true,
      connectionName: `${config.app.serviceName}-queue`,
    },
    logger,
  )
}

/**
 * Verify the queue Redis is configured with a non-evicting memory policy.
 *
 * A cache-style eviction policy on the queue server will silently delete BullMQ
 * keys under memory pressure. Detected at startup and reported loudly, because
 * it is invisible until jobs start disappearing.
 */
export async function assertQueueRedisEvictionPolicy(
  connection: RedisConnection,
  logger: Logger,
  environment: string,
): Promise<void> {
  try {
    const result = await connection.config('GET', 'maxmemory-policy')
    const policy = Array.isArray(result) ? result[1] : undefined
    if (policy === undefined) return

    if (policy !== 'noeviction') {
      const message =
        `Queue Redis is running with maxmemory-policy="${policy}". BullMQ requires ` +
        '"noeviction": any other policy can silently evict queued jobs.'
      if (environment === 'production') {
        throw new Error(message)
      }
      logger.warn({ policy }, message)
    }
  } catch (error) {
    // CONFIG GET is disabled on some managed providers. That is not fatal; the
    // operator remains responsible for the policy (documented in the README).
    if (error instanceof Error && error.message.includes('noeviction')) throw error
    logger.warn(
      { err: describeError(error) },
      'Could not verify queue Redis eviction policy; confirm maxmemory-policy=noeviction manually',
    )
  }
}
