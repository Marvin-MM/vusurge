import { defineConfig } from 'prisma/config'

/**
 * Prisma CLI configuration.
 *
 * The CLI connects with MIGRATION_DATABASE_URL, which must point at the
 * schema-owning migration role. The application processes never use that
 * connection: they run as the least-privilege runtime role via DATABASE_URL
 * (see scripts/bootstrap-db.ts and docs/adr/0015-runtime-db-role-and-rls.md).
 *
 * Falling back to DATABASE_URL would silently run migrations as the runtime
 * role, so it is deliberately not done here.
 */
const migrationUrl = process.env['MIGRATION_DATABASE_URL']

/**
 * `prisma migrate dev` diffs the schema against a throwaway shadow database.
 * It is a development-only command; production deploys use `migrate deploy`,
 * which needs no shadow database and therefore no elevated rights.
 */
const shadowUrl = process.env['SHADOW_DATABASE_URL']

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun run prisma/seed.ts',
  },
  ...(migrationUrl
    ? {
        datasource: {
          url: migrationUrl,
          ...(shadowUrl ? { shadowDatabaseUrl: shadowUrl } : {}),
        },
      }
    : {}),
})
