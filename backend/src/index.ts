import { createApp } from './app'
import { bootstrapSuperadmin } from './bootstrap'
import { buildInfrastructure, shutdownInfrastructure, startInfrastructure } from './container'
import { ConfigurationError } from './shared/config'
import { withRequestScope } from './shared/http'
import { describeError } from './shared/logging'

/**
 * API process entrypoint.
 *
 * Startup order is deliberate: configuration is validated before anything is
 * constructed, dependencies are connected and verified before the socket is
 * opened, and the socket is opened last so a process that cannot serve
 * correctly never appears healthy to a load balancer.
 *
 * The API is horizontally stateless. All durable state lives in PostgreSQL;
 * Redis holds only caches and queues, neither of which is authoritative.
 */

async function main(): Promise<void> {
  const infrastructure = buildInfrastructure()
  const { config, logger } = infrastructure

  await startInfrastructure(infrastructure)

  // Ensure initial superadmin is seeded if configured
  await bootstrapSuperadmin(infrastructure)

  const app = createApp({ infrastructure })

  // The server is created directly rather than via app.listen() so that every
  // request passes through withRequestScope, which establishes the logging
  // context for the whole request. The test harness calls the same wrapper, so
  // tests and production share one request pipeline.
  const handle = withRequestScope((request) => app.handle(request))

  const server = Bun.serve({
    hostname: config.app.host,
    port: config.app.port,
    // Bound so a single oversized body cannot exhaust process memory.
    maxRequestBodySize: config.app.maxRequestBodyBytes,
    fetch: handle,
  })

  // Elysia's own `.listen()` assigns `app.server` so route handlers can read
  // `context.server` (which falls back to `app.server` — see the Bun adapter's
  // compose step) and call `server.requestIP(request)` for the caller's IP.
  // Bypassing `.listen()` to route every request through withRequestScope
  // (see comment above) means that assignment never happens on its own, so
  // it is replicated here. Without it, `server` is always null in every
  // derive/handler, `ipAddress` resolves to undefined everywhere, and every
  // IP-scoped rate-limit policy with `riskLevel: 'high'` (invitation
  // acceptance, staff-invitation acceptance, password reset) fails closed
  // on every single request — not a slowdown, a hard block.
  app.server = server

  logger.info(
    {
      host: config.app.host,
      port: config.app.port,
      environment: config.app.environment,
      version: config.app.version,
      openApiUi: config.features.openApiUi,
    },
    'API process listening',
  )

  let shuttingDown = false

  /**
   * Graceful shutdown.
   *
   * Stop accepting new connections first, let in-flight requests finish within
   * a bounded window, then release resources. A request that has already
   * committed a transaction must be allowed to write its outbox row and return
   * its response; killing it mid-flight would leave the client unsure whether
   * the operation happened.
   */
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true

    logger.info({ signal }, 'Shutdown signal received; draining the API process')

    const deadline = setTimeout(() => {
      logger.error(
        { timeoutMs: config.app.shutdownTimeoutMs },
        'Graceful shutdown exceeded its budget; exiting',
      )
      process.exit(1)
    }, config.app.shutdownTimeoutMs)
    // Do not let the shutdown timer itself keep the process alive.
    deadline.unref?.()

    try {
      // Stop accepting new connections, then let in-flight requests finish.
      await server.stop()
      await shutdownInfrastructure(infrastructure)
      clearTimeout(deadline)
      logger.info('API process stopped cleanly')
      process.exit(0)
    } catch (error) {
      logger.error({ err: describeError(error) }, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  process.on('unhandledRejection', (reason: unknown) => {
    // Logged, not swallowed: an unhandled rejection means a code path lost
    // track of an error, which is a defect worth surfacing loudly.
    logger.error({ err: describeError(reason) }, 'Unhandled promise rejection')
  })

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: describeError(error) }, 'Uncaught exception; terminating')
    void shutdown('uncaughtException')
  })
}

main().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    // Configuration failures are operator errors, not bugs: print them plainly
    // rather than as a stack trace, and never echo the offending values.
    console.error(error.message)
    process.exit(78) // EX_CONFIG
  }
  console.error('API process failed to start:', error)
  process.exit(1)
})
