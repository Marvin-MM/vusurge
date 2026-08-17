/**
 * One-time database bootstrap.
 *
 * Creates the three least-privilege roles the application relies on and installs
 * the PostgreSQL extensions the schema depends on. Must be run by an operator
 * holding superuser (or at least CREATEROLE + CREATE EXTENSION) rights. It is
 * deliberately NOT run by the API or worker process at startup.
 *
 *   ip_migrator  owns the schema, runs migrations. Used only by tooling.
 *   ip_app       runtime role. Owns nothing, is NOT superuser, does NOT have
 *                BYPASSRLS, and is therefore subject to every RLS policy.
 *   ip_public_views
 *                NOLOGIN owner for the allowlisted public projection views.
 *                It may bypass RLS solely so FORCE RLS can remain enabled on
 *                the underlying tables; the runtime role cannot SET ROLE to it.
 *
 * Idempotent: safe to re-run. Re-running rotates the role passwords to the
 * values currently supplied in the environment.
 *
 * Usage:
 *   bun run db:bootstrap
 *
 * Required environment:
 *   BOOTSTRAP_DATABASE_URL  superuser connection to the target database
 *   DB_MIGRATOR_USER / DB_MIGRATOR_PASSWORD
 *   DB_APP_USER / DB_APP_PASSWORD
 */
import { Client } from 'pg'

const NUL = String.fromCharCode(0)

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? undefined : value.trim()
}

function connectionUrlForDatabase(connectionString: string, database: string): string {
  const url = new URL(connectionString)
  url.pathname = `/${encodeURIComponent(database)}`
  return url.toString()
}

/** Quote a PostgreSQL identifier. Identifiers cannot be bound as parameters. */
function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(
      `Refusing to use "${value}" as a SQL identifier: only [A-Za-z_][A-Za-z0-9_]* is allowed.`,
    )
  }
  return `"${value}"`
}

/** Quote a PostgreSQL string literal. Passwords cannot be bound in CREATE ROLE. */
function quoteLiteral(value: string): string {
  if (value.includes(NUL)) {
    throw new Error('Refusing to use a value containing a NUL byte as a SQL literal.')
  }
  return `'${value.replaceAll("'", "''")}'`
}

/** Create a login role if absent, then re-assert its security attributes. */
async function ensureLoginRole(
  client: Client,
  name: string,
  password: string,
  options: { bypassRls: boolean },
): Promise<void> {
  const identifier = quoteIdentifier(name)
  const literalPassword = quoteLiteral(password)

  const existing = await client.query('select 1 from pg_roles where rolname = $1', [name])
  if (existing.rowCount === 0) {
    await client.query(`create role ${identifier} with login password ${literalPassword}`)
  }

  await client.query(
    `alter role ${identifier} with login password ${literalPassword} ` +
      `nosuperuser nocreatedb nocreaterole noreplication ${options.bypassRls ? 'bypassrls' : 'nobypassrls'}`,
  )
}

async function ensurePublicViewOwner(client: Client): Promise<void> {
  const existing = await client.query('select 1 from pg_roles where rolname = $1', [
    'ip_public_views',
  ])
  if (existing.rowCount === 0) {
    await client.query('create role ip_public_views with nologin bypassrls')
  }
  await client.query(
    'alter role ip_public_views with nologin nosuperuser nocreatedb nocreaterole ' +
      'noreplication bypassrls',
  )
}

async function main(): Promise<void> {
  const bootstrapUrl = requireEnv('BOOTSTRAP_DATABASE_URL')
  const migratorName = requireEnv('DB_MIGRATOR_USER')
  const appName = requireEnv('DB_APP_USER')
  const migratorUser = quoteIdentifier(migratorName)
  const appUser = quoteIdentifier(appName)

  const client = new Client({ connectionString: bootstrapUrl })
  await client.connect()

  try {
    const { rows } = await client.query<{ database: string; superuser: boolean }>(
      'select current_database() as database, ' +
        'coalesce((select usesuper from pg_user where usename = current_user), false) as superuser',
    )
    const context = rows[0]
    if (context === undefined) {
      throw new Error('Unable to determine the current database context.')
    }
    console.log(
      `Bootstrapping database "${context.database}" as ` +
        `${context.superuser ? 'superuser' : 'non-superuser'}.`,
    )

    // Extensions. pg_trgm powers fuzzy name/title search (master prompt section 27).
    await client.query('create extension if not exists pg_trgm')
    await client.query('create extension if not exists pg_stat_statements')

    await ensureLoginRole(client, migratorName, requireEnv('DB_MIGRATOR_PASSWORD'), {
      // Migrations are the explicit maintenance path and must remain able to
      // repair/rebuild FORCE-RLS tables without weakening runtime isolation.
      bypassRls: true,
    })
    await ensureLoginRole(client, appName, requireEnv('DB_APP_PASSWORD'), { bypassRls: false })
    await ensurePublicViewOwner(client)

    // Every persisted DateTime is an instant. Pin both the database default
    // and application-controlled roles to UTC so SQL comparisons, triggers,
    // raw queries, Prisma, workers, and operator tooling agree even when the
    // host machine uses a regional timezone.
    await client.query(`alter database ${quoteIdentifier(context.database)} set timezone = 'UTC'`)
    await client.query(`alter role ${appUser} set timezone = 'UTC'`)
    await client.query(`alter role ${migratorUser} set timezone = 'UTC'`)

    // The migrator owns the public schema: migrations create objects as this
    // role, and public projection views therefore run with definer semantics
    // (see docs/adr/0013-public-projection-views.md).
    await client.query(`alter schema public owner to ${migratorUser}`)
    await client.query(`grant usage on schema public to ${appUser}`)
    await client.query('grant usage on schema public to ip_public_views')
    await client.query('revoke create on schema public from ip_public_views')
    await client.query(`grant ip_public_views to ${migratorUser}`)
    await client.query('revoke select on all tables in schema public from ip_public_views')
    await client.query(
      `alter default privileges for role ${migratorUser} in schema public ` +
        'revoke select on tables from ip_public_views',
    )

    // A view-definer role needs SELECT only on the tables referenced by the
    // eight allowlisted projections. Reassert these narrowly on an existing
    // database; the initial migration applies the same grants after creation.
    const publicProjectionSources = [
      'announcement',
      'challenge',
      'challenge_team',
      'challenge_track',
      'faq',
      'innovation',
      'organization',
      'result_snapshot',
      'submission',
      'submission_result',
      'submission_technology',
      'submission_version',
    ]
    for (const table of publicProjectionSources) {
      const exists = await client.query('select to_regclass($1) is not null as present', [
        `public.${table}`,
      ])
      if (exists.rows[0]?.present === true) {
        await client.query(
          `grant select on table public.${quoteIdentifier(table)} to ip_public_views`,
        )
      }
    }
    await client.query(`revoke ip_public_views from ${appUser}`)
    // The runtime role must never create objects in the shared schema.
    await client.query(`revoke create on schema public from ${appUser}`)
    await client.query('revoke create on schema public from public')

    // Development/CI only: `prisma migrate dev` diffs against a shadow
    // database. The migration role deliberately lacks CREATEDB, so the shadow
    // database is provisioned here instead of granting that right permanently.
    // `prisma migrate deploy`, used in production, needs no shadow database.
    const shadowDatabase = optionalEnv('SHADOW_DATABASE_NAME')
    if (shadowDatabase !== undefined) {
      const shadowIdentifier = quoteIdentifier(shadowDatabase)
      const exists = await client.query('select 1 from pg_database where datname = $1', [
        shadowDatabase,
      ])
      if (exists.rowCount === 0) {
        await client.query(`create database ${shadowIdentifier} owner ${migratorUser}`)
        console.log(`  shadow database: ${shadowDatabase} (development/CI only)`)
      }
      await client.query(`alter database ${shadowIdentifier} owner to ${migratorUser}`)
      await client.query(`alter database ${shadowIdentifier} set timezone = 'UTC'`)

      // Existing shadow databases need the same ownership and extension
      // bootstrap as newly created ones. Without this, migrate diff can fail
      // before replaying the first migration (or when it reaches a pg_trgm
      // index) after a container/database has been recreated independently.
      const shadowClient = new Client({
        connectionString: connectionUrlForDatabase(bootstrapUrl, shadowDatabase),
      })
      await shadowClient.connect()
      try {
        await shadowClient.query(`alter schema public owner to ${migratorUser}`)
        await shadowClient.query('create extension if not exists pg_trgm')
        await shadowClient.query('create extension if not exists pg_stat_statements')
        await shadowClient.query('grant usage on schema public to ip_public_views')
        await shadowClient.query('revoke create on schema public from ip_public_views')
        await shadowClient.query('revoke create on schema public from public')
      } finally {
        await shadowClient.end()
      }
    }

    // Statement-level safety nets, attached to the role so they survive pooling.
    await client.query(`alter role ${appUser} set statement_timeout = '30s'`)
    await client.query(`alter role ${appUser} set idle_in_transaction_session_timeout = '15s'`)
    await client.query(`alter role ${appUser} set lock_timeout = '10s'`)
    await client.query(`alter role ${migratorUser} set statement_timeout = '0'`)
    await client.query(`alter role ${migratorUser} set lock_timeout = '30s'`)

    console.log('Bootstrap complete.')
    console.log(`  migration role : ${migratorName} (owns schema, runs migrations)`)
    console.log(`  runtime role   : ${appName} (no ownership, no BYPASSRLS)`)
    console.log('  public views   : ip_public_views (NOLOGIN, projection views only)')
    console.log('Next: bun run db:migrate')
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error('Database bootstrap failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
