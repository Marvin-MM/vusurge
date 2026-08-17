/**
 * Development seed data.
 *
 * Populates fixtures useful for local development and manual exploration:
 * the skill catalogue, a verified platform superadmin account, and one
 * approved sample organization with an owner. It is idempotent — safe to run
 * repeatedly against the same database.
 *
 * This is development tooling, not test fixtures: the integration and E2E
 * suites build their own data per test (see tests/helpers) and never depend
 * on this script having run. Never run against a production database.
 *
 * Usage:
 *   bun run db:seed
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from 'better-auth/crypto'
import { PrismaClient } from '../src/generated/prisma/client'
import { newId } from '../src/shared/ids'

const SEED_PASSWORD = 'development-only-password-1234'

const SKILLS: readonly { name: string; category: string }[] = [
  { name: 'TypeScript', category: 'Programming Language' },
  { name: 'Python', category: 'Programming Language' },
  { name: 'Go', category: 'Programming Language' },
  { name: 'Rust', category: 'Programming Language' },
  { name: 'React', category: 'Frontend' },
  { name: 'Vue', category: 'Frontend' },
  { name: 'Node.js', category: 'Backend' },
  { name: 'PostgreSQL', category: 'Database' },
  { name: 'Machine Learning', category: 'Data Science' },
  { name: 'Product Design', category: 'Design' },
  { name: 'UX Research', category: 'Design' },
  { name: 'Project Management', category: 'Operations' },
  { name: 'Public Speaking', category: 'Soft Skills' },
  { name: 'Technical Writing', category: 'Soft Skills' },
]

const TECHNOLOGY_TAGS: readonly { name: string; category: string }[] = [
  { name: 'TypeScript', category: 'Language' },
  { name: 'JavaScript', category: 'Language' },
  { name: 'Python', category: 'Language' },
  { name: 'Go', category: 'Language' },
  { name: 'Rust', category: 'Language' },
  { name: 'Java', category: 'Language' },
  { name: 'React', category: 'Frontend' },
  { name: 'Vue', category: 'Frontend' },
  { name: 'Svelte', category: 'Frontend' },
  { name: 'Node.js', category: 'Backend' },
  { name: 'PostgreSQL', category: 'Database' },
  { name: 'MongoDB', category: 'Database' },
  { name: 'Redis', category: 'Database' },
  { name: 'Docker', category: 'Infrastructure' },
  { name: 'Kubernetes', category: 'Infrastructure' },
  { name: 'AWS', category: 'Cloud' },
  { name: 'TensorFlow', category: 'Machine Learning' },
  { name: 'PyTorch', category: 'Machine Learning' },
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

async function seedSkills(client: PrismaClient): Promise<void> {
  for (const skill of SKILLS) {
    const slug = slugify(skill.name)
    await client.skill.upsert({
      where: { slug },
      create: { id: newId(), name: skill.name, slug, category: skill.category, active: true },
      update: { name: skill.name, category: skill.category, active: true },
    })
  }
  console.log(`Seeded ${SKILLS.length} skills.`)
}

async function seedTechnologyTags(client: PrismaClient): Promise<void> {
  for (const tag of TECHNOLOGY_TAGS) {
    const slug = slugify(tag.name)
    await client.technologyTag.upsert({
      where: { slug },
      create: { id: newId(), name: tag.name, slug, category: tag.category, active: true },
      update: { name: tag.name, category: tag.category, active: true },
    })
  }
  console.log(`Seeded ${TECHNOLOGY_TAGS.length} technology tags.`)
}

/** Create (or find) a verified user with a real Better-Auth-compatible password hash. */
async function seedUser(
  client: PrismaClient,
  email: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await client.user.findUnique({ where: { email }, select: { id: true } })
  if (existing !== null) return { id: existing.id, created: false }

  const userId = newId()
  const passwordHash = await hashPassword(SEED_PASSWORD)

  await client.user.create({
    data: {
      id: userId,
      name,
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
      profile: { create: { displayName: name, visibility: 'ORGANIZATION_MEMBERS' } },
    },
  })

  return { id: userId, created: true }
}

async function seedSuperadmin(client: PrismaClient): Promise<void> {
  const email = 'superadmin@example.org'
  const { id, created } = await seedUser(client, email, 'Platform Superadmin')

  const hasRole = await client.platformRoleAssignment.findFirst({
    where: { userId: id, role: 'PLATFORM_SUPERADMIN', revokedAt: null },
  })
  if (hasRole === null) {
    await client.platformRoleAssignment.create({
      data: {
        id: newId(),
        userId: id,
        role: 'PLATFORM_SUPERADMIN',
        reason: 'Development seed fixture.',
      },
    })
  }

  console.log(
    `${created ? 'Created' : 'Found'} platform superadmin: ${email} / password: ${SEED_PASSWORD}`,
  )
  console.log(
    '  Note: 2FA is not enrolled for this seed account, so sensitive superadmin actions ' +
      '(which require it) will be denied until enrolled through the API.',
  )
}

async function seedSampleOrganization(client: PrismaClient): Promise<void> {
  const ownerEmail = 'owner@example.org'
  const { id: ownerId } = await seedUser(client, ownerEmail, 'Sample Owner')

  const slug = 'sample-innovation-lab'
  const existing = await client.organization.findFirst({ where: { slug } })
  if (existing !== null) {
    console.log(`Sample organization "${slug}" already exists.`)
    return
  }

  const organizationId = newId()

  // Tenant tables are RLS-protected, so creation must run inside a
  // transaction with tenant context set transaction-locally — exactly the
  // pattern `withTenant` provides in the application (see
  // shared/database/tenant-transaction.ts). This script sets it directly to
  // avoid pulling in the full config/logger stack for a one-off fixture.
  await client.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.organization_id', ${organizationId}, true)`

    await tx.organization.create({
      data: {
        id: organizationId,
        slug,
        name: 'Sample Innovation Lab',
        description: 'A development fixture organization for local exploration.',
        organizationType: 'UNIVERSITY_CLUB',
        status: 'ACTIVE',
        visibility: 'PUBLIC',
        settings: { create: { joinPolicy: 'INVITE_ONLY', allowedEmailDomains: [] } },
        memberships: {
          create: {
            id: newId(),
            userId: ownerId,
            role: 'ORG_OWNER',
            status: 'ACTIVE',
            source: 'SEED',
          },
        },
      },
    })
  })

  console.log(`Created sample organization "${slug}" owned by ${ownerEmail}.`)
}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']
  if (databaseUrl === undefined || databaseUrl === '') {
    console.error('DATABASE_URL must be set.')
    process.exit(1)
  }
  if (process.env['APP_ENV'] === 'production') {
    console.error('Refusing to run the development seed script with APP_ENV=production.')
    process.exit(1)
  }

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })

  try {
    await seedSkills(client)
    await seedTechnologyTags(client)
    await seedSuperadmin(client)
    await seedSampleOrganization(client)
    console.log('Seed complete.')
  } finally {
    await client.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
