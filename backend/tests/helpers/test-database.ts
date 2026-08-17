import { PrismaPg } from '@prisma/adapter-pg'
import { Client } from 'pg'
import { PrismaClient } from '../../src/generated/prisma/client'
import { testDatabaseUrl, testMigrationDatabaseUrl } from './test-config'

/**
 * Real-PostgreSQL test fixtures.
 *
 * Two connections are exposed deliberately:
 *
 *   runtime   connects as the least-privilege application role, so a test that
 *             passes proves the application role can do the thing — and a test
 *             asserting a denial proves the role genuinely cannot.
 *
 *   migration connects as the schema owner, used only to set up state that the
 *             runtime role is not permitted to create, and to assert that the
 *             privilege separation itself holds.
 */

/** Prisma client bound to the least-privilege runtime role. */
export function createRuntimeClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: testDatabaseUrl(),
      max: 5,
      application_name: 'innovation-platform-test-runtime',
    }),
  })
}

/** Raw pg client bound to the runtime role, for privilege assertions. */
export async function connectRuntimeSql(): Promise<Client> {
  const client = new Client({ connectionString: testDatabaseUrl() })
  await client.connect()
  return client
}

/** Raw pg client bound to the schema-owning migration role. */
export async function connectMigrationSql(): Promise<Client> {
  const client = new Client({ connectionString: testMigrationDatabaseUrl() })
  await client.connect()
  return client
}

/**
 * Reset mutable state between tests.
 *
 * Truncates every application table (discovered from the catalogue, not a
 * hand-maintained list that silently falls out of date as modules are
 * added — every table this schema has ever grown was a real gap here until
 * the schema was queried directly instead). `CASCADE` makes dependency order
 * irrelevant. Truncate rather than a transaction-per-test: the code under
 * test opens its own transactions, and nesting them would change the
 * isolation behaviour the concurrency tests exist to verify.
 *
 * Runs as the migration role because the runtime role is intentionally denied
 * DELETE on audit_event — the very restriction other tests assert — and
 * because TRUNCATE requires ownership or a dedicated privilege the runtime
 * role deliberately does not have.
 */
export async function resetDatabase(client: Client): Promise<void> {
  const { rows } = await client.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`,
  )
  if (rows.length === 0) return
  const tables = rows.map((row) => `"${row.tablename}"`).join(', ')
  await client.query(`truncate table ${tables} restart identity cascade`)
}

/** Seed only the catalogue entries a workflow explicitly exercises. */
export async function seedTechnologyTags(client: Client, names: readonly string[]): Promise<void> {
  for (const name of names) {
    const slug = name
      .toLowerCase()
      .trim()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/(^-|-$)/g, '')
    await client.query(
      `insert into technology_tag (id, name, slug, category, active)
       values ($1, $2, $3, 'Test catalogue', true)
       on conflict (slug) do update set name = excluded.name, active = true`,
      [crypto.randomUUID(), name, slug],
    )
  }
}
