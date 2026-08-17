import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'
import { elapsedMs, startTimer } from '../time'
import { CircuitBreaker } from './circuit-breaker'
import type { RedisConnection } from './redis-client'

/**
 * Cache-aside caching over the volatile Redis deployment.
 *
 * The cache is never authoritative. It must not be consulted for deadline
 * acceptance, final submission, score submission, ownership, security role
 * changes, legal consent, or session durability (master prompt section 23).
 * Every read falls back to PostgreSQL, and a cache outage is a latency event,
 * not a correctness event.
 *
 * Tenant keys are namespaced by organization so a cached value can never be
 * served to the wrong tenant, even if two tenants happen to use the same
 * resource identifier.
 */

export interface CacheKey {
  /** Logical namespace, e.g. 'org-dashboard'. */
  readonly namespace: string
  /** Tenant scope. Omitted only for genuinely global, non-tenant data. */
  readonly organizationId?: string
  /** Remaining discriminators. */
  readonly parts: readonly (string | number)[]
}

export interface CacheOptions {
  readonly ttlSeconds: number
}

export interface Cache {
  get<T>(key: CacheKey): Promise<T | undefined>
  set<T>(key: CacheKey, value: T, options: CacheOptions): Promise<void>
  delete(key: CacheKey): Promise<void>
  /** Remove every entry in a namespace for one tenant. */
  invalidateNamespace(namespace: string, organizationId?: string): Promise<void>
  /**
   * Cache-aside read-through. On any cache failure the loader still runs, so a
   * degraded cache never turns into a failed request.
   */
  getOrLoad<T>(key: CacheKey, options: CacheOptions, load: () => Promise<T>): Promise<T>
  /** True when the breaker is open and reads are bypassing Redis. */
  isDegraded(): boolean
  healthy(): Promise<boolean>
}

export function formatCacheKey(key: CacheKey): string {
  const tenant = key.organizationId ?? 'global'
  const suffix = key.parts.map((part) => String(part)).join(':')
  return suffix === '' ? `${key.namespace}:${tenant}` : `${key.namespace}:${tenant}:${suffix}`
}

export function createCache(connection: RedisConnection, config: AppConfig, logger: Logger): Cache {
  const metrics = appMetrics()

  const breaker = new CircuitBreaker({
    name: 'cache-redis',
    failureThreshold: config.cacheRedis.circuitBreakerThreshold,
    resetTimeoutMs: config.cacheRedis.circuitBreakerResetMs,
    onStateChange(state) {
      logger.warn({ circuit: 'cache-redis', state }, 'Cache circuit breaker state changed')
    },
  })

  /** Run a cache operation, absorbing every failure into `fallback`. */
  async function guarded<T>(operation: string, action: () => Promise<T>, fallback: T): Promise<T> {
    if (!breaker.canAttempt()) {
      metrics.cacheOperations.add(1, { operation, result: 'skipped' })
      metrics.cacheDegradedMode.add(1, { operation })
      return fallback
    }

    const started = startTimer()
    try {
      const result = await action()
      breaker.recordSuccess()
      metrics.cacheOperationDuration.record(elapsedMs(started), { operation })
      return result
    } catch (error) {
      breaker.recordFailure()
      metrics.cacheOperations.add(1, { operation, result: 'error' })
      logger.warn(
        { err: describeError(error), operation },
        'Cache operation failed; continuing without cache',
      )
      return fallback
    }
  }

  return {
    async get<T>(key: CacheKey): Promise<T | undefined> {
      const formatted = formatCacheKey(key)
      const raw = await guarded('get', () => connection.get(formatted), null)
      if (raw === null) {
        metrics.cacheOperations.add(1, { operation: 'get', result: 'miss' })
        return undefined
      }
      try {
        metrics.cacheOperations.add(1, { operation: 'get', result: 'hit' })
        return JSON.parse(raw) as T
      } catch {
        // A corrupt entry is treated as a miss and evicted.
        await guarded('delete', () => connection.del(formatted), 0)
        return undefined
      }
    },

    async set<T>(key: CacheKey, value: T, options: CacheOptions): Promise<void> {
      const formatted = formatCacheKey(key)
      await guarded(
        'set',
        () => connection.set(formatted, JSON.stringify(value), 'EX', options.ttlSeconds),
        null,
      )
    },

    async delete(key: CacheKey): Promise<void> {
      await guarded('delete', () => connection.del(formatCacheKey(key)), 0)
    },

    async invalidateNamespace(namespace: string, organizationId?: string): Promise<void> {
      const tenant = organizationId ?? 'global'
      const pattern = `${connection.options.keyPrefix ?? ''}${namespace}:${tenant}:*`
      await guarded(
        'invalidate-namespace',
        async () => {
          // SCAN rather than KEYS: KEYS blocks the server for the whole keyspace.
          let cursor = '0'
          do {
            const [next, found] = await connection.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
            cursor = next
            if (found.length > 0) {
              // ioredis prepends keyPrefix, so strip it before deleting.
              const prefix = connection.options.keyPrefix ?? ''
              await connection.del(
                ...found.map((entry) => (prefix ? entry.slice(prefix.length) : entry)),
              )
            }
          } while (cursor !== '0')
          return null
        },
        null,
      )
    },

    async getOrLoad<T>(key: CacheKey, options: CacheOptions, load: () => Promise<T>): Promise<T> {
      const cached = await this.get<T>(key)
      if (cached !== undefined) return cached

      const value = await load()
      // Do not cache absent values: a null cached against a resource that is
      // about to be created would serve a stale 404 for the whole TTL.
      if (value !== undefined && value !== null) {
        await this.set(key, value, options)
      }
      return value
    },

    isDegraded(): boolean {
      return breaker.currentState() === 'open'
    },

    async healthy(): Promise<boolean> {
      try {
        const reply = await connection.ping()
        return reply === 'PONG'
      } catch {
        return false
      }
    },
  }
}
