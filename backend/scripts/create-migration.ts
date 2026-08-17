/**
 * Create a migration from the current Prisma schema, without a TTY.
 *
 * `prisma migrate dev` is interactive: it prompts whenever a change could be
 * destructive, which makes it unusable in a non-interactive shell or in CI.
 * This script produces the same artefact deterministically by diffing the
 * applied migration history against the schema, writing the SQL, and letting
 * the operator review it before `prisma migrate deploy` applies it.
 *
 * Usage:
 *   bun run scripts/create-migration.ts <snake_case_name>
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const name = process.argv[2]

if (name === undefined || !/^[a-z0-9_]+$/.test(name)) {
  console.error('Usage: bun run scripts/create-migration.ts <snake_case_name>')
  process.exit(1)
}

const backendDir = join(import.meta.dir, '..')
const migrationsDir = join(backendDir, 'prisma', 'migrations')

const shadowUrl = process.env['SHADOW_DATABASE_URL']
if (shadowUrl === undefined || shadowUrl === '') {
  console.error('SHADOW_DATABASE_URL is required to diff the schema safely.')
  process.exit(1)
}

const diff = spawnSync(
  'bunx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema',
    'prisma/schema',
    '--script',
  ],
  // The shadow database used to replay the migration history is read from
  // prisma.config.ts (SHADOW_DATABASE_URL); Prisma 7 removed the CLI flag.
  { encoding: 'utf8', cwd: backendDir },
)

if (diff.status !== 0) {
  console.error(diff.stderr)
  process.exit(diff.status ?? 1)
}

const sql = diff.stdout.trim()

if (sql === '' || sql.includes('This is an empty migration')) {
  console.log('No schema changes detected; nothing to do.')
  process.exit(0)
}

// Prisma's own timestamp format, so ordering matches `migrate deploy`.
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

const directory = join(migrationsDir, `${timestamp}_${name}`)
mkdirSync(directory, { recursive: true })
writeFileSync(join(directory, 'migration.sql'), `${sql}\n`, 'utf8')

console.log(`Created prisma/migrations/${timestamp}_${name}/migration.sql`)
console.log('Review the SQL, then apply it with: bun run db:migrate')

if (/^\s*DROP (INDEX|POLICY|VIEW|FUNCTION|TRIGGER)/im.test(sql)) {
  console.warn(
    '\n⚠  This migration contains a DROP INDEX/POLICY/VIEW/FUNCTION/TRIGGER statement.\n' +
      '   `prisma migrate diff` cannot see hand-written SQL (RLS policies, views, functions,\n' +
      '   pg_trgm indexes) that has no representation in the .prisma schema files, and will\n' +
      '   propose dropping them as "extra" objects on every future diff. Check each DROP\n' +
      '   against docs/adr/0015-runtime-db-role-and-rls.md and docs/adr/0013-public-projection-views.md\n' +
      '   before applying — do not run db:migrate on this file without reviewing it.',
  )
}
