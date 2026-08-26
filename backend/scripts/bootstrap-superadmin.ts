/**
 * One-time platform superadmin bootstrap.
 *
 * Grants PLATFORM_SUPERADMIN to an existing, already-registered user. This is
 * deliberately NOT something the application does automatically on startup
 * from an environment variable — continuously promoting an email on every
 * boot would mean anyone who ever controlled that address stays a superadmin
 * forever, and it would make the grant invisible in the audit trail (master
 * prompt section 43).
 *
 * The target user must already exist (sign up first, verify their email).
 * This script only grants the role; it does not create the account.
 *
 * Usage:
 *   bun run bootstrap:superadmin -- --email admin@example.org --reason "initial platform bootstrap"
 *
 * Required environment: DATABASE_URL. The command deliberately
 * connects via the same credential that owns the schema.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { newId } from '../src/shared/ids'

function parseArgs(argv: readonly string[]): { email?: string; reason?: string } {
  const result: { email?: string; reason?: string } = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--email') result.email = argv[i + 1]
    if (argv[i] === '--reason') result.reason = argv[i + 1]
  }
  return result
}

async function main(): Promise<void> {
  const { email, reason } = parseArgs(process.argv.slice(2))

  if (email === undefined || email.trim() === '') {
    console.error('Usage: bun run bootstrap:superadmin -- --email <email> --reason "<why>"')
    process.exit(1)
  }
  if (reason === undefined || reason.trim().length < 10) {
    console.error('A --reason of at least 10 characters is required for the audit record.')
    process.exit(1)
  }

  const databaseUrl = process.env['DATABASE_URL']
  if (databaseUrl === undefined || databaseUrl === '') {
    console.error('DATABASE_URL must be set.')
    process.exit(1)
  }

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })

  try {
    const roles = await client.$queryRaw<{ current_user: string; rolbypassrls: boolean }[]>`
      select current_user, r.rolbypassrls
        from pg_roles r
       where r.rolname = current_user
    `
    if (roles[0]?.rolbypassrls !== true) {
      console.error('Refusing to change a platform role through a NOBYPASSRLS runtime identity.')
      process.exit(1)
    }

    const outcome = await client.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, email: true, emailVerified: true, twoFactorEnabled: true },
      })

      if (user === null) {
        throw new Error(
          `No user found with email "${email}". They must sign up and verify their email first.`,
        )
      }
      if (!user.emailVerified) {
        throw new Error(`User "${email}" has not verified their email.`)
      }
      if (!user.twoFactorEnabled) {
        throw new Error(`User "${email}" must enroll two-factor authentication before promotion.`)
      }

      const existing = await tx.platformRoleAssignment.findFirst({
        where: { userId: user.id, role: 'PLATFORM_SUPERADMIN', revokedAt: null },
      })
      if (existing !== null) return { changed: false, user }

      const grant = await tx.platformRoleAssignment.create({
        data: {
          id: newId(),
          userId: user.id,
          role: 'PLATFORM_SUPERADMIN',
          reason,
        },
      })

      // The privilege change and its evidence are one atomic commit.
      await tx.auditEvent.create({
        data: {
          id: newId(),
          actorType: 'SYSTEM',
          action: 'platform.role_granted',
          resourceType: 'platform_role_assignment',
          resourceId: grant.id,
          summary: `Bootstrapped PLATFORM_SUPERADMIN for ${email} via operator command.`,
          reason,
        },
      })
      return { changed: true, user }
    })

    if (!outcome.changed) {
      console.log(`"${email}" already holds PLATFORM_SUPERADMIN. No change made.`)
    } else {
      console.log(`Granted PLATFORM_SUPERADMIN to "${email}".`)
      console.log('The privilege and audit event were committed atomically.')
    }
  } finally {
    await client.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Superadmin bootstrap failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
