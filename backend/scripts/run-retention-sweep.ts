/**
 * Applies configured data retention (master prompt sections 42, 49).
 *
 * Not run automatically by the API or worker process — there is no
 * in-process scheduler in this codebase (see `shared/retention`'s own
 * docstring for why). Run this on whatever schedule the deployment's own
 * infrastructure provides: a Kubernetes CronJob, a systemd timer, or a
 * manual operator invocation.
 *
 * Usage:
 *   bun run retention:sweep
 *
 * Required environment: the same as the API/worker processes (DATABASE_URL
 * and every other startup-required variable), since this builds the full
 * infrastructure graph — retention needs the tenant transaction runner,
 * object storage, and the idempotency store, not just a bare database
 * connection.
 */
import { buildInfrastructure, shutdownInfrastructure, startInfrastructure } from '../src/container'
import { describeError } from '../src/shared/logging'
import { runRetentionSweep } from '../src/shared/retention'

async function main(): Promise<void> {
  const infrastructure = buildInfrastructure()
  await startInfrastructure(infrastructure)

  try {
    const report = await runRetentionSweep(infrastructure)
    infrastructure.logger.info({ report }, 'Retention sweep completed')

    if (report.errors.length > 0) {
      console.error(`Retention sweep completed with ${report.errors.length} failing task(s):`)
      for (const failure of report.errors) {
        console.error(`  - ${failure.task}: ${failure.message}`)
      }
      process.exitCode = 1
    }
  } finally {
    await shutdownInfrastructure(infrastructure)
  }
}

main().catch((error: unknown) => {
  console.error('Retention sweep failed to run:', describeError(error))
  process.exit(1)
})
