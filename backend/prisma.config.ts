import { defineConfig } from 'prisma/config'

/**
 * Prisma CLI configuration.
 *
 * Simplified to use a single DATABASE_URL for all operations — migrations,
 * runtime queries, and local development. Supply the same connection string
 * you use for the application. For Neon, use the pooled URL with sslmode=require.
 *
 * Prisma 7 requires datasource.url to be set explicitly in this file when
 * using `migrate deploy`; it does not fall back to the schema file's env()
 * call automatically. DATABASE_URL is loaded from .env by Bun locally, and
 * injected via k8s Secret in production — same variable, both modes.
 *
 * datasource is omitted when DATABASE_URL is not set so that commands that
 * do not connect (validate, generate) succeed in the static-analysis CI job
 * which does not spin up a database.
 */
const databaseUrl = process.env['DATABASE_URL']

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun run prisma/seed.ts',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
