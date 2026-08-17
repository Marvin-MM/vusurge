import { Elysia } from 'elysia'
import type { HealthController } from './health.controller'
import { LivenessResponse, ReadinessResponse } from './health.dto'

/**
 * Health endpoints.
 *
 * Mounted outside /api/v1: they are infrastructure contracts for load
 * balancers and orchestrators, not part of the product API, and their shape
 * must stay stable independently of API versioning.
 */
export function healthRoutes(controller: HealthController) {
  return new Elysia({ name: 'health-routes' })
    .get('/health/live', () => controller.live(), {
      response: { 200: LivenessResponse },
      detail: {
        tags: ['Health'],
        summary: 'Process liveness',
        description:
          'Returns 200 while the process is running. Performs no dependency checks, so a ' +
          'transient database or Redis failure cannot trigger a restart loop.',
      },
    })
    .get(
      '/health/ready',
      async ({ set }) => {
        const result = await controller.ready()
        set.status = result.status
        // Readiness must never be cached by an intermediary.
        set.headers['cache-control'] = 'no-store'
        return result.body
      },
      {
        response: { 200: ReadinessResponse, 503: ReadinessResponse },
        detail: {
          tags: ['Health'],
          summary: 'Dependency readiness',
          description:
            'Reports whether the dependencies required by this process role are usable. ' +
            'PostgreSQL is required by every role; the cache is never required; the queue is ' +
            'required only by the worker. Returns 503 when a required dependency is down.',
        },
      },
    )
}
