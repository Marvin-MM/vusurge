import type { Cache } from '../../shared/cache'
import type { AppConfig } from '../../shared/config'
import { elapsedMs, startTimer } from '../../shared/time'
import type { DependencyReport } from './health.dto'
import type { HealthRepository } from './health.repository'

/**
 * Liveness and readiness logic.
 *
 * The distinction matters operationally:
 *
 *   liveness  is this process healthy enough to keep running? A failing
 *             liveness check gets the process restarted, so it must never
 *             depend on an external system — a database blip would otherwise
 *             restart the entire fleet.
 *
 *   readiness is this process able to serve requests right now? It checks the
 *             dependencies this process role actually requires. PostgreSQL is
 *             required by both roles. The cache is never required: its loss
 *             degrades latency, not correctness (master prompt sections 4.3,
 *             4.4, 39).
 */

export interface HealthService {
  liveness(): { status: 'ok'; service: string; version: string; uptimeSeconds: number }
  readiness(): Promise<{
    status: 'ready' | 'not_ready'
    service: string
    version: string
    dependencies: DependencyReport[]
  }>
}

export interface HealthServiceDependencies {
  readonly repository: HealthRepository
  readonly cache: Cache
  readonly config: AppConfig
  readonly queueHealthy: () => Promise<boolean>
}

export function createHealthService(deps: HealthServiceDependencies): HealthService {
  const startedAt = Date.now()
  const { config } = deps

  return {
    liveness() {
      return {
        status: 'ok',
        service: config.app.serviceName,
        version: config.app.version,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      }
    },

    async readiness() {
      const dependencies: DependencyReport[] = []

      const dbTimer = startTimer()
      const databaseHealthy = await deps.repository.checkDatabase()
      dependencies.push({
        name: 'postgresql',
        status: databaseHealthy ? 'ok' : 'unavailable',
        required: true,
        latencyMs: elapsedMs(dbTimer),
      })

      const cacheTimer = startTimer()
      const cacheHealthy = await deps.cache.healthy()
      dependencies.push({
        name: 'cache-redis',
        // Never 'unavailable': an unavailable cache does not make this process
        // unready, and reporting it as such would remove healthy replicas.
        status: cacheHealthy ? 'ok' : 'degraded',
        required: false,
        latencyMs: elapsedMs(cacheTimer),
      })

      const queueTimer = startTimer()
      const queueHealthy = await deps.queueHealthy()
      dependencies.push({
        name: 'queue-redis',
        // Required for the worker, which cannot do its job without it; only
        // degrading for the API, whose writes still commit with an outbox row.
        status: queueHealthy
          ? 'ok'
          : config.app.processRole === 'worker'
            ? 'unavailable'
            : 'degraded',
        required: config.app.processRole === 'worker',
        latencyMs: elapsedMs(queueTimer),
      })

      const ready = dependencies.every((entry) => !entry.required || entry.status === 'ok')

      return {
        status: ready ? ('ready' as const) : ('not_ready' as const),
        service: config.app.serviceName,
        version: config.app.version,
        dependencies,
      }
    },
  }
}
