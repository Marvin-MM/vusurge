import { defineConfig } from 'prisma/config'

/**
 * Prisma CLI configuration.
 *
 * One logical database, but migrations and the running app must reach it
 * through different endpoints when a connection pooler sits in front of it:
 *
 *   - The application connects through the POOLED endpoint (DATABASE_URL) via
 *     the pg driver adapter — many short-lived connections, which is exactly
 *     what a pooler is for.
 *   - `prisma migrate deploy` must connect through a DIRECT, non-pooled
 *     endpoint. It takes a session-scoped advisory lock and runs each
 *     migration inside a transaction; Neon's pooled endpoint (`...-pooler...`)
 *     is PgBouncer in transaction-pooling mode, which does not keep session
 *     state across statements, so the advisory lock is unreliable and a
 *     migration can "start ... then fail" (surfaced later as P3009). The same
 *     applies to any external PgBouncer in transaction mode.
 *
 * So the CLI prefers DIRECT_DATABASE_URL when it is set and only falls back to
 * DATABASE_URL. Locally, where you usually talk to Postgres directly, leaving
 * DIRECT_DATABASE_URL unset and pointing DATABASE_URL at the direct port is
 * fine. In production set DIRECT_DATABASE_URL to the non-pooled host.
 *
 * datasource is omitted when neither URL is set so that commands that do not
 * connect (validate, generate) succeed in the static-analysis CI job which
 * does not spin up a database.
 */
const databaseUrl = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL']

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun run prisma/seed.ts',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
