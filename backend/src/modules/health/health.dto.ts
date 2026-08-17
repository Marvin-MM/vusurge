import { t } from 'elysia'

/**
 * Health and readiness response contracts.
 *
 * Deliberately minimal. These endpoints are reachable without authentication so
 * that load balancers and orchestrators can call them, which means they must
 * not disclose connection strings, host names, credentials, versions of
 * downstream software, or error details (master prompt section 34.1).
 */

export const LivenessResponse = t.Object(
  {
    status: t.Literal('ok'),
    service: t.String(),
    version: t.String(),
    uptimeSeconds: t.Number(),
  },
  { description: 'The process is running and able to serve traffic.' },
)

const DependencyStatus = t.Object({
  name: t.String(),
  status: t.Union([t.Literal('ok'), t.Literal('degraded'), t.Literal('unavailable')]),
  /** Whether the process can serve its role without this dependency. */
  required: t.Boolean(),
  latencyMs: t.Optional(t.Number()),
})

export const ReadinessResponse = t.Object(
  {
    status: t.Union([t.Literal('ready'), t.Literal('not_ready')]),
    service: t.String(),
    version: t.String(),
    dependencies: t.Array(DependencyStatus),
  },
  {
    description:
      'Readiness of the dependencies this process role requires. Reports names and states ' +
      'only; never connection details.',
  },
)

export type DependencyReport = {
  name: string
  status: 'ok' | 'degraded' | 'unavailable'
  required: boolean
  latencyMs?: number
}
