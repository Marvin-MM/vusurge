import type { Database } from '../../shared/database'

/**
 * Database reachability probe.
 *
 * A trivially cheap round trip: readiness must not run an expensive query, or a
 * loaded database would fail its own health check and take the fleet out of
 * rotation just when it is needed most.
 */
export interface HealthRepository {
  checkDatabase(): Promise<boolean>
  /** Undispatched outbox backlog, surfaced to operators via readiness. */
  pendingOutboxCount(): Promise<number>
}

export function createHealthRepository(database: Database): HealthRepository {
  return {
    async checkDatabase(): Promise<boolean> {
      return database.ping()
    },

    async pendingOutboxCount(): Promise<number> {
      const rows = await database.client.$queryRaw<{ count: bigint }[]>`
        select count(*)::bigint as count
        from outbox_event
        where state in ('PENDING', 'ENQUEUED')
      `
      return Number(rows[0]?.count ?? 0n)
    },
  }
}
