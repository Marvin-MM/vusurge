import { hashPassword } from 'better-auth/crypto'
import type { Infrastructure } from './container'
import { newId } from './shared/ids'

/**
 * Ensures the configured bootstrap superadmin exists.
 * Safe to run concurrently (upserts gracefully).
 */
export async function bootstrapSuperadmin(infrastructure: Infrastructure): Promise<void> {
  const { config, database, logger } = infrastructure
  const { superadminEmail, superadminPassword } = config.bootstrap

  if (!superadminEmail || !superadminPassword) {
    return
  }

  try {
    const existingUser = await database.client.user.findUnique({
      where: { email: superadminEmail },
      select: { id: true },
    })

    let userId = existingUser?.id

    if (!userId) {
      userId = newId()
      const passwordHash = await hashPassword(superadminPassword)

      // Create the user and their auth account
      await database.client.user.create({
        data: {
          id: userId,
          name: 'Platform Superadmin',
          email: superadminEmail,
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
      logger.info({ email: superadminEmail }, 'Bootstrapped initial superadmin user')
    }

    // Ensure they have the superadmin role
    const hasRole = await database.client.platformRoleAssignment.findFirst({
      where: { userId, role: 'PLATFORM_SUPERADMIN', revokedAt: null },
    })

    if (!hasRole) {
      await database.client.platformRoleAssignment.create({
        data: {
          id: newId(),
          userId,
          role: 'PLATFORM_SUPERADMIN',
          reason: 'Application bootstrap configuration',
        },
      })
      logger.info({ email: superadminEmail }, 'Granted PLATFORM_SUPERADMIN role to bootstrap user')
    }
  } catch (error) {
    logger.error({ error, email: superadminEmail }, 'Failed to bootstrap superadmin')
  }
}
