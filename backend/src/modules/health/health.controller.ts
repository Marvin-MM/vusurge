import type { HealthService } from './health.service'

/**
 * Translates health service results into HTTP outcomes.
 *
 * Controllers hold no business rules and never touch Prisma; this one only
 * decides the status code that an orchestrator will act on.
 */
export interface HealthController {
  live(): ReturnType<HealthService['liveness']>
  ready(): Promise<{ status: number; body: Awaited<ReturnType<HealthService['readiness']>> }>
}

export function createHealthController(service: HealthService): HealthController {
  return {
    live() {
      return service.liveness()
    },

    async ready() {
      const report = await service.readiness()
      return {
        // 503 rather than 200-with-a-flag: load balancers act on the status
        // code, not the body.
        status: report.status === 'ready' ? 200 : 503,
        body: report,
      }
    },
  }
}
