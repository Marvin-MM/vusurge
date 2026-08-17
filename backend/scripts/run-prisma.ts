/**
 * Run Prisma with Bun's loaded environment forwarded explicitly.
 *
 * Prisma 7 intentionally no longer loads `.env` itself. Bun loads the local
 * file for this wrapper and production/CI can inject the same variables into
 * the process environment. Forwarding the environment makes both modes
 * deterministic without adding a second dotenv implementation.
 */
let prismaArguments = Bun.argv.slice(2)
const useTestDatabase = prismaArguments[0] === '--test-database'

if (useTestDatabase) {
  prismaArguments = prismaArguments.slice(1)
}

if (prismaArguments.length === 0) {
  console.error('Usage: bun run scripts/run-prisma.ts <prisma arguments...>')
  process.exit(64)
}

const childEnvironment = { ...process.env }

if (useTestDatabase) {
  const testMigrationUrl = process.env.TEST_MIGRATION_DATABASE_URL
  if (testMigrationUrl === undefined || testMigrationUrl.trim() === '') {
    console.error('TEST_MIGRATION_DATABASE_URL is required for --test-database.')
    process.exit(78)
  }
  if (testMigrationUrl === process.env.MIGRATION_DATABASE_URL) {
    console.error('Refusing to use the primary migration database as the isolated test database.')
    process.exit(78)
  }

  const testDatabaseName = decodeURIComponent(new URL(testMigrationUrl).pathname.slice(1))
  if (!/(^|_)test($|_)/i.test(testDatabaseName)) {
    console.error(`Refusing test migration URL with non-test database name: ${testDatabaseName}`)
    process.exit(78)
  }

  childEnvironment.MIGRATION_DATABASE_URL = testMigrationUrl
  // `migrate deploy` does not need a shadow database. Avoid accidentally
  // coupling an isolated test migration to the development shadow database.
  childEnvironment.SHADOW_DATABASE_URL = undefined
}

const child = Bun.spawn(['bunx', 'prisma', ...prismaArguments], {
  cwd: process.cwd(),
  env: childEnvironment,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(await child.exited)
