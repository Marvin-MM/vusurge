import { buildInfrastructure, shutdownInfrastructure, startInfrastructure } from './container'
import { ConfigurationError } from './shared/config'
import { describeError } from './shared/logging'
import { registerJobHandlers } from './workers/register-handlers'
import { createWorkerRuntime } from './workers/worker-runtime'

/**
 * Worker process entrypoint.
 *
 * The same codebase as the API, run with PROCESS_ROLE=worker. It owns the
 * outbox dispatch loop and the BullMQ consumers; it serves no HTTP traffic.
 *
 * Running workers separately is what lets heavy work (exports, analytics) be
 * scaled and restarted without touching request-serving capacity.
 */

async function main(): Promise<void> {
  const infrastructure = buildInfrastructure()
  const { config, logger } = infrastructure

  if (config.app.processRole !== 'worker') {
    logger.warn(
      { processRole: config.app.processRole },
      'Worker entrypoint started with PROCESS_ROLE set to something other than "worker"; ' +
        "set it correctly so logs, metrics, and readiness reflect this process's role",
    )
  }

  await startInfrastructure(infrastructure)

  const router = registerJobHandlers(infrastructure)
  const runtime = createWorkerRuntime(infrastructure, router)

  await runtime.start()

  let shuttingDown = false

  /**
   * Graceful shutdown.
   *
   * Stops accepting new jobs, lets active jobs finish inside a bounded window,
   * then releases resources. A job killed mid-flight would leave its outbox row
   * ENQUEUED; the reconciler recovers that, but finishing cleanly avoids the
   * duplicate side effect a redelivery could cause.
   */
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true

    logger.info({ signal }, 'Shutdown signal received; draining the worker process')

    const deadline = setTimeout(() => {
      logger.error(
        { timeoutMs: config.app.shutdownTimeoutMs },
        'Graceful shutdown exceeded its budget; exiting',
      )
      process.exit(1)
    }, config.app.shutdownTimeoutMs)
    deadline.unref?.()

    try {
      await runtime.stop()
      await shutdownInfrastructure(infrastructure)
      clearTimeout(deadline)
      logger.info('Worker process stopped cleanly')
      process.exit(0)
    } catch (error) {
      logger.error({ err: describeError(error) }, 'Error during worker shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error({ err: describeError(reason) }, 'Unhandled promise rejection in worker')
  })

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: describeError(error) }, 'Uncaught exception in worker; terminating')
    void shutdown('uncaughtException')
  })
}

main().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    console.error(error.message)
    process.exit(78) // EX_CONFIG
  }
  console.error('Worker process failed to start:', error)
  process.exit(1)
})
