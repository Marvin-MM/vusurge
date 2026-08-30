/**
 * Run Prisma with Bun's loaded environment forwarded explicitly.
 *
 * Prisma 7 intentionally no longer loads `.env` itself. Bun loads the local
 * file for this wrapper and production/CI can inject the same variables into
 * the process environment. Forwarding the environment makes both modes
 * deterministic without adding a second dotenv implementation.
 *
 * The CLI is resolved from this repository's node_modules only — see
 * scripts/prisma-cli.ts for why a `bunx prisma` fallback is never acceptable.
 */
import { resolvePrismaCli } from './prisma-cli'

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
  const testDatabaseUrl = process.env.TEST_DATABASE_URL
  if (testDatabaseUrl === undefined || testDatabaseUrl.trim() === '') {
    console.error('TEST_DATABASE_URL is required for --test-database.')
    process.exit(78)
  }
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    console.error('Refusing to use the primary database as the isolated test database.')
    process.exit(78)
  }

  const testDatabaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1))
  if (!/(^|_)test($|_)/i.test(testDatabaseName)) {
    console.error(`Refusing test URL with non-test database name: ${testDatabaseName}`)
    process.exit(78)
  }

  // Override DATABASE_URL so prisma.config.ts picks up the test database.
  childEnvironment.DATABASE_URL = testDatabaseUrl
}

const child = Bun.spawn(['bun', resolvePrismaCli(), ...prismaArguments], {
  cwd: process.cwd(),
  env: childEnvironment,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(await child.exited)
