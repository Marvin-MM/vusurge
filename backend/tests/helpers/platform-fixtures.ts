import type { TestUser } from './auth-flow'
import { createVerifiedUser } from './auth-flow'
import type { TestApp } from './test-app'

/**
 * A verified user holding PLATFORM_SUPERADMIN with an MFA-assured session.
 *
 * Tests outside Better Auth's own contract suite set the resulting assurance
 * fields directly. Authorization still consumes the same server-controlled
 * session state as a real successful TOTP/backup-code flow.
 */
export async function createPlatformSuperadmin(
  app: TestApp,
  reason = 'test fixture',
): Promise<TestUser> {
  const user = await createVerifiedUser(app)

  await app.infrastructure.database.client.$transaction([
    app.infrastructure.database.client.platformRoleAssignment.create({
      data: { id: crypto.randomUUID(), userId: user.userId, role: 'PLATFORM_SUPERADMIN', reason },
    }),
    app.infrastructure.database.client.user.update({
      where: { id: user.userId },
      data: { twoFactorEnabled: true },
    }),
    app.infrastructure.database.client.session.updateMany({
      where: { userId: user.userId },
      data: { mfaVerifiedAt: new Date(), authenticationMethod: 'mfa' },
    }),
  ])

  return user
}
