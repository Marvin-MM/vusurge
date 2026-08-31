import { hashPassword } from 'better-auth/crypto'
import type { Infrastructure } from './container'
import { AuditAction } from './shared/audit'
import { newId } from './shared/ids'
import { describeError } from './shared/logging'

/**
 * Ensures the configured bootstrap superadmin exists.
 *
 * A convenience for the very first deploy, when the platform has no users at
 * all and therefore nobody who could grant the first PLATFORM_SUPERADMIN
 * through the API. `scripts/bootstrap-superadmin.ts` remains the sanctioned
 * path for every later promotion: it targets an existing, email-verified,
 * 2FA-enrolled user, demands an operator justification, and runs as the
 * migrator identity. This path is the break-glass equivalent for bootstrapping
 * and is therefore held to the same standards:
 *
 *   - the grant and its audit event commit atomically (the runtime role can
 *     only INSERT audit rows, so the evidence cannot be rewritten later);
 *   - it is idempotent — re-running against an existing user or role is a
 *     no-op, so rolling restarts and replica races are safe;
 *   - the seeded account is NOT pre-enrolled in 2FA. The authorization policy
 *     forces the gate on first sign-in, so the operator must complete
 *     enrollment before the role grants anything.
 *
 * Misconfiguration must be loud, not silent: a partially configured bootstrap
 * (email without a password) is a boot-time configuration error rather than a
 * quiet skip (see config validation).
 */
export async function bootstrapSuperadmin(infrastructure: Infrastructure): Promise<void> {
  const { config, transactions, audit, logger } = infrastructure
  const { superadminEmail, superadminPassword } = config.bootstrap

  if (superadminEmail === undefined || superadminPassword === undefined) {
    return
  }

  const email = superadminEmail.toLowerCase()

  try {
    const outcome = await transactions.withPlatformAccess(
      async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        })

        let userId = existingUser?.id
        if (userId === undefined) {
          userId = newId()
          const passwordHash = await hashPassword(superadminPassword)
          await tx.user.create({
            data: {
              id: userId,
              name: 'Platform Superadmin',
              email,
              emailVerified: true,
              accounts: {
                create: {
                  id: newId(),
                  providerId: 'credential',
                  accountId: userId,
                  password: passwordHash,
                },
              },
              profile: {
                create: {
                  displayName: 'Platform Superadmin',
                  visibility: 'ORGANIZATION_MEMBERS',
                },
              },
            },
          })
        }

        // The partial unique index on (user_id, role) where revoked_at is
        // null is the real race guard: two replicas granting concurrently see
        // one commit and one unique violation, which is handled below.
        const activeGrant = await tx.platformRoleAssignment.findFirst({
          where: { userId, role: 'PLATFORM_SUPERADMIN', revokedAt: null },
          select: { id: true },
        })
        if (activeGrant !== null) {
          return { changed: false, createdUser: existingUser === null }
        }

        const grant = await tx.platformRoleAssignment.create({
          data: {
            id: newId(),
            userId,
            role: 'PLATFORM_SUPERADMIN',
            reason: 'Application bootstrap configuration',
          },
        })

        // The privilege change and its evidence are one atomic commit, with
        // the same audit action the operator script emits.
        await audit.write(tx, {
          actorType: 'SYSTEM',
          action: AuditAction.PlatformRoleGranted,
          resourceType: 'platform_role_assignment',
          resourceId: grant.id,
          summary: `Bootstrapped PLATFORM_SUPERADMIN for ${email} via application bootstrap configuration.`,
          reason: 'Application bootstrap configuration',
        })

        return { changed: true, createdUser: existingUser === null }
      },
      { purpose: 'Bootstrap the configured platform superadmin on startup.' },
    )

    if (outcome.createdUser) {
      logger.info({ email }, 'Bootstrapped initial superadmin user')
    }
    if (outcome.changed) {
      logger.info(
        { email },
        'Granted PLATFORM_SUPERADMIN role to bootstrap user; 2FA enrollment is required at first sign-in',
      )
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Another replica won the race during a rolling deploy: the role (or
      // user) already exists, which is exactly the desired end state.
      logger.info({ email }, 'Superadmin bootstrap already completed by another replica')
      return
    }
    logger.error({ err: describeError(error), email }, 'Failed to bootstrap superadmin')
  }
}

/**
 * Prisma surfaces unique violations as P2002; the pg driver adapter nests the
 * SQLSTATE (23505) under meta.driverAdapterError. Both spellings are checked,
 * mirroring the SQLSTATE extraction in tenant-transaction.ts.
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as {
    code?: unknown
    meta?: { code?: unknown; driverAdapterError?: { cause?: { code?: unknown } } }
  }
  if (candidate.code === 'P2002') return true
  const state =
    candidate.meta?.driverAdapterError?.cause?.code ?? candidate.meta?.code ?? candidate.code
  return state === '23505'
}
