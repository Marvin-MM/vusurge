import type { AppConfig } from '../config/config.schema'
import { dependencyUnavailable } from '../errors'
import { describeError, type Logger } from '../logging'
import { appMetrics, withSpan } from '../observability'
import type { Database, PrismaTransactionClient } from './prisma'

/**
 * Tenant-scoped transactions.
 *
 * This is the ONLY sanctioned way to touch tenant-owned data. It opens a
 * transaction, publishes the tenant identity into that transaction as a
 * transaction-local setting, and hands the transaction client to the caller.
 * Row-level security policies read that setting, so every statement executed
 * through the returned client is confined to one organization even if the
 * application query forgot a `where organizationId` clause.
 *
 * Two properties matter and are easy to get wrong:
 *
 *  1. The setting is applied with `set_config(key, value, true)` — the `true`
 *     makes it transaction-local. Prisma hands out pooled connections, so a
 *     session-level setting would survive the transaction and leak the previous
 *     request's tenant to the next one (master prompt section 6.3).
 *
 *  2. The caller must use the supplied transaction client. Using the ambient
 *     client inside the callback would execute on a different connection with
 *     no tenant context, and RLS would (correctly) return nothing.
 *
 * Application-level authorization is still mandatory. RLS is defence in depth,
 * not a substitute for checking that this actor may perform this action.
 */

export interface TransactionOptions {
  /** Isolation level. Use Serializable for check-then-write races. */
  readonly isolationLevel?: 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
  /** Milliseconds the interactive transaction may run before rollback. */
  readonly timeoutMs?: number
  /** Milliseconds to wait for a connection before giving up. */
  readonly maxWaitMs?: number
  /** Recorded on the transaction for database-level diagnostics. */
  readonly actorUserId?: string
}

export interface PlatformTransactionOptions extends TransactionOptions {
  /**
   * Why platform-wide access is being taken. Required: platform access to
   * private tenant data is purpose-based and must be auditable, never a casual
   * "view everything" bypass (master prompt section 5.2).
   */
  readonly purpose: string
}

/** PostgreSQL error codes that a retry can legitimately resolve. */
const RETRYABLE_SQL_STATES = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
])

/** PostgreSQL error codes that mean the database is unreachable. */
const UNAVAILABLE_SQL_STATES = new Set([
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
])

/**
 * Extract the PostgreSQL SQLSTATE from whichever wrapper it arrived in.
 *
 * A raw `pg` error carries `code` directly. Prisma 7 with the pg driver adapter
 * wraps it: the client surfaces its own `P2010`, and the real SQLSTATE is
 * nested at `meta.driverAdapterError.cause.originalCode`. Reading only the top
 * level would silently classify every serialization failure as non-retryable.
 */
function sqlState(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const candidate = error as {
    code?: unknown
    meta?: {
      code?: unknown
      driverAdapterError?: { cause?: { originalCode?: unknown } }
    }
  }

  const adapterCode = candidate.meta?.driverAdapterError?.cause?.originalCode
  if (typeof adapterCode === 'string') return adapterCode

  // A Prisma error code (P2010) is not a SQLSTATE; only accept the 5-character
  // SQLSTATE shape so the two namespaces are never confused.
  if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
    return candidate.code
  }
  if (typeof candidate.meta?.code === 'string') return candidate.meta.code

  return undefined
}

export function isRetryableDatabaseError(error: unknown): boolean {
  const state = sqlState(error)
  return state !== undefined && RETRYABLE_SQL_STATES.has(state)
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  const state = sqlState(error)
  return state !== undefined && UNAVAILABLE_SQL_STATES.has(state)
}

export interface TenantTransactionRunner {
  /**
   * Run `work` inside a transaction scoped to one organization.
   *
   * Everything the operation needs to commit atomically — the business change,
   * its audit record, and its outbox event — must happen inside this callback.
   */
  withTenant<T>(
    organizationId: string,
    work: (tx: PrismaTransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>

  /**
   * Run `work` with platform-administration access across tenants.
   *
   * Sets `app.platform_access` transaction-locally, which the RLS policies
   * honour. Reserved for explicitly authorized platform routes; the caller is
   * responsible for writing the audit record that justifies it.
   */
  withPlatformAccess<T>(
    work: (tx: PrismaTransactionClient) => Promise<T>,
    options: PlatformTransactionOptions,
  ): Promise<T>

  /**
   * Run `work` in a transaction with no tenant context.
   *
   * For genuinely tenant-free data only: global user accounts, the skill
   * catalogue, organization applications before an organization exists, and
   * infrastructure tables. Tenant tables are invisible here, by design.
   */
  withoutTenant<T>(
    work: (tx: PrismaTransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>

  /**
   * Run `work` able to read the curated public projection views.
   *
   * The `public_*_view` views are security-barrier projections that already
   * restrict themselves to public-safe rows (active/public organizations,
   * published/public challenges, consented showcase projects, and so on). They
   * are defined `security_invoker = false`, so they read their base tables as
   * the view owner; under the single-role architecture that owner is the
   * ordinary application role, which is subject to FORCE ROW LEVEL SECURITY.
   * With neither a tenant nor a platform context the tenant-isolation policies
   * return zero rows, so an unauthenticated visitor would see nothing.
   *
   * This enables `app.platform_access` transaction-locally so those policies
   * admit the rows, then relies on the views' own WHERE clauses as the single
   * exposure boundary. It is deliberately NOT audited as a platform-admin
   * action, because serving already-public data is not one: callers must only
   * ever read the `public_*_view` views through it, never base tables directly.
   */
  withPublicProjection<T>(
    work: (tx: PrismaTransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>

  /**
   * Run `work` with access to resolve exactly one row by an unguessable
   * secret, before that row's tenant is known.
   *
   * Distinct from `withPlatformAccess`: it grants no administrative reach and
   * is not audited as a platform bypass. Possession of the secret — an
   * invitation token, a join code — is itself the authorization, the same way
   * a password-reset token is. Used only for the initial lookup; once the
   * row's `organizationId` is known, the operation that acts on it runs
   * inside an ordinary `withTenant` transaction.
   */
  withSecretLookup<T>(
    work: (tx: PrismaTransactionClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>

  /** Read the authoritative current instant from the database. */
  databaseNow(tx: PrismaTransactionClient): Promise<Date>
}

export function createTenantTransactionRunner(
  database: Database,
  config: AppConfig,
  logger: Logger,
): TenantTransactionRunner {
  const metrics = appMetrics()
  const defaultTimeoutMs = 15_000
  const defaultMaxWaitMs = 5_000

  async function run<T>(
    settings: Readonly<Record<string, string>>,
    work: (tx: PrismaTransactionClient) => Promise<T>,
    options: TransactionOptions,
  ): Promise<T> {
    const maxAttempts =
      options.isolationLevel === 'Serializable' ? config.database.maxSerializationRetries + 1 : 1

    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await withSpan(
          'db.transaction',
          {
            'db.system': 'postgresql',
            'db.transaction.isolation_level': options.isolationLevel ?? 'ReadCommitted',
          },
          () =>
            database.client.$transaction(
              async (tx) => {
                // Establish context first: every later statement in this
                // transaction is evaluated against it.
                for (const [key, value] of Object.entries(settings)) {
                  await tx.$executeRaw`select set_config(${key}, ${value}, true)`
                }
                return await work(tx as PrismaTransactionClient)
              },
              {
                ...(options.isolationLevel ? { isolationLevel: options.isolationLevel } : {}),
                timeout: options.timeoutMs ?? defaultTimeoutMs,
                maxWait: options.maxWaitMs ?? defaultMaxWaitMs,
              },
            ),
        )
      } catch (error) {
        lastError = error

        if (isDatabaseUnavailableError(error)) {
          logger.error({ err: describeError(error) }, 'Database unavailable during transaction')
          throw dependencyUnavailable(
            'The service is temporarily unable to reach its database. Retry shortly.',
            { cause: error },
          )
        }

        // Retry only true serialization/deadlock failures, and only when the
        // caller opted into an isolation level where they are expected.
        if (isRetryableDatabaseError(error) && attempt < maxAttempts) {
          metrics.dbTransactionRetries.add(1, { attempt })
          const backoffMs = Math.min(50 * 2 ** (attempt - 1), 400)
          const jitterMs = Math.floor(Math.random() * 25)
          logger.warn(
            { attempt, maxAttempts, sqlState: sqlState(error) },
            'Retrying transaction after a serialization failure',
          )
          await Bun.sleep(backoffMs + jitterMs)
          continue
        }

        throw error
      }
    }

    throw lastError
  }

  return {
    withTenant(organizationId, work, options = {}) {
      const settings: Record<string, string> = { 'app.organization_id': organizationId }
      if (options.actorUserId) settings['app.actor_user_id'] = options.actorUserId
      return run(settings, work, options)
    },

    async withPlatformAccess(work, options) {
      // Async so the rejection is delivered through the returned promise like
      // every other failure, rather than throwing synchronously at the call
      // site and bypassing the caller's error handling.
      if (options.purpose.trim() === '') {
        throw new Error('withPlatformAccess requires a non-empty purpose.')
      }
      const settings: Record<string, string> = { 'app.platform_access': 'on' }
      if (options.actorUserId) settings['app.actor_user_id'] = options.actorUserId
      logger.info(
        { purpose: options.purpose, actorUserId: options.actorUserId },
        'Platform-wide database access taken',
      )
      return run(settings, work, options)
    },

    withoutTenant(work, options = {}) {
      const settings: Record<string, string> = {}
      if (options.actorUserId) settings['app.actor_user_id'] = options.actorUserId
      return run(settings, work, options)
    },

    withPublicProjection(work, options = {}) {
      // Reuses the platform-access RLS escape hatch, but without the audit log
      // withPlatformAccess emits: this is not an administrative bypass, it is
      // how the security-barrier public.*_view projections read their already
      // public-safe rows under FORCE ROW LEVEL SECURITY. The views' own WHERE
      // clauses remain the exposure boundary.
      const settings: Record<string, string> = { 'app.platform_access': 'on' }
      if (options.actorUserId) settings['app.actor_user_id'] = options.actorUserId
      return run(settings, work, options)
    },

    withSecretLookup(work, options = {}) {
      const settings: Record<string, string> = { 'app.secret_lookup': 'on' }
      if (options.actorUserId) settings['app.actor_user_id'] = options.actorUserId
      return run(settings, work, options)
    },

    async databaseNow(tx): Promise<Date> {
      // clock_timestamp() rather than now(): now() is the transaction start
      // time, which would let a long transaction accept a submission after the
      // deadline passed mid-transaction. Convert through Unix epoch rather
      // than relying on a driver-specific timestamptz decoder: the latter can
      // reinterpret the database wall clock in the host timezone.
      const rows = await tx.$queryRaw<Array<{ epochMilliseconds: bigint }>>`
        select (extract(epoch from clock_timestamp()) * 1000)::bigint as "epochMilliseconds"
      `
      const row = rows[0]
      if (row === undefined) {
        throw new Error('Failed to read the current time from the database.')
      }
      return new Date(Number(row.epochMilliseconds))
    },
  }
}
