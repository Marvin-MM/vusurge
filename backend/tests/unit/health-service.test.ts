import { describe, expect, test } from 'bun:test'
import type { HealthRepository } from '../../src/modules/health/health.repository'
import { createHealthService } from '../../src/modules/health/health.service'
import type { Cache } from '../../src/shared/cache'
import type { AppConfig } from '../../src/shared/config/config.schema'

/**
 * Readiness caching semantics, with every dependency stubbed.
 *
 * The e2e suite proves the HTTP contract; what only a stub proves is that
 * repeated probes stop paying a PostgreSQL/Redis round trip each, without
 * stampeding when the cache expires under concurrent probes.
 */

interface Counters {
  dbChecks: number
  cachePings: number
  queuePings: number
}

function stubService(options: {
  dbHealthy?: boolean
  ttlMs: number
  slowDb?: () => Promise<void>
}): { service: ReturnType<typeof createHealthService>; counters: Counters } {
  const counters: Counters = { dbChecks: 0, cachePings: 0, queuePings: 0 }

  const repository = {
    async checkDatabase(): Promise<boolean> {
      counters.dbChecks += 1
      if (options.slowDb !== undefined) await options.slowDb()
      return options.dbHealthy ?? true
    },
    async pendingOutboxCount(): Promise<number> {
      return 0
    },
  } satisfies HealthRepository

  const cache = {
    async healthy(): Promise<boolean> {
      counters.cachePings += 1
      return true
    },
  } as unknown as Cache

  const config = {
    app: { serviceName: 'test', version: '0.1.0', processRole: 'api' },
  } as unknown as AppConfig

  const service = createHealthService({
    repository,
    cache,
    config,
    queueHealthy: async () => {
      counters.queuePings += 1
      return true
    },
    readinessCacheTtlMs: options.ttlMs,
  })

  return { service, counters }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20))

describe('readiness caching', () => {
  test('probes within the TTL reuse one dependency sweep', async () => {
    const { service, counters } = stubService({ ttlMs: 60_000 })

    const first = await service.readiness()
    const second = await service.readiness()
    const third = await service.readiness()

    expect(counters.dbChecks).toBe(1)
    expect(counters.cachePings).toBe(1)
    expect(counters.queuePings).toBe(1)
    expect(first.status).toBe('ready')
    expect(second.status).toBe('ready')
    expect(third.status).toBe('ready')
  })

  test('concurrent callers share one refresh (single-flight)', async () => {
    const { service, counters } = stubService({ ttlMs: 60_000, slowDb: settle })

    const [first, second, third] = await Promise.all([
      service.readiness(),
      service.readiness(),
      service.readiness(),
    ])

    expect(counters.dbChecks).toBe(1)
    expect(first.status).toBe('ready')
    expect(second.status).toBe('ready')
    expect(third.status).toBe('ready')
  })

  test('the cache expires and the next probe re-checks the dependencies', async () => {
    const { service, counters } = stubService({ ttlMs: 20 })

    await service.readiness()
    expect(counters.dbChecks).toBe(1)

    await new Promise((resolve) => setTimeout(resolve, 40))
    await service.readiness()

    expect(counters.dbChecks).toBe(2)
  })

  test('an unhealthy dependency is reported and cached like a healthy one', async () => {
    const { service, counters } = stubService({ dbHealthy: false, ttlMs: 60_000 })

    const first = await service.readiness()
    const second = await service.readiness()

    expect(first.status).toBe('not_ready')
    expect(first.dependencies.find((entry) => entry.name === 'postgresql')?.status).toBe(
      'unavailable',
    )
    // The not-ready verdict is cached for the same TTL: a dependency that is
    // down does not get re-probed on every request either.
    expect(counters.dbChecks).toBe(1)
    expect(second.status).toBe('not_ready')
  })
})
