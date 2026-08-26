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
 * Note: `prisma migrate dev` (development only) requires a shadow database.
 * If your provider does not support CREATE DATABASE (e.g. Neon free tier), use
 * `prisma db push` for local schema iteration instead.
 */
const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required.')
}

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun run prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
})
