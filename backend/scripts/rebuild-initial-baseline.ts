/**
 * One-time pre-deployment migration-history squash.
 *
 * This command is intentionally guarded and is never part of CI/deployment.
 * It accepts a reviewed pg_dump --schema-only file, removes psql-only framing,
 * backs up the existing migration directories under /tmp, and replaces them
 * with one baseline. Never use it after any shared environment is deployed.
 */
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const confirmation = '--confirm-no-deployments'
const dumpPath = process.argv.find((value) => value.endsWith('.sql'))
if (!process.argv.includes(confirmation) || dumpPath === undefined) {
  throw new Error(
    `Usage: bun run scripts/rebuild-initial-baseline.ts ${confirmation} /tmp/schema.sql`,
  )
}

const root = join(import.meta.dir, '..')
const migrationsDirectory = join(root, 'prisma', 'migrations')
const migrationEntries = readdirSync(migrationsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))

if (migrationEntries.length < 2) {
  throw new Error('Refusing to squash a migration history with fewer than two migrations.')
}

let dump = readFileSync(dumpPath, 'utf8')
if (dump.includes('_prisma_migrations') || /^(COPY|INSERT INTO) /m.test(dump)) {
  throw new Error('The supplied dump contains migration metadata or table data.')
}
if (!dump.includes('FORCE ROW LEVEL SECURITY') || !dump.includes('ip_public_views')) {
  throw new Error('The supplied dump does not contain the reviewed RLS/public-view baseline.')
}

// Prisma executes SQL, not psql meta-commands. The public schema already
// exists because Prisma creates its migration table before applying baseline 1.
dump = dump
  .split('\n')
  .filter((line) => !line.startsWith('\\restrict ') && !line.startsWith('\\unrestrict '))
  .join('\n')
  .replace('CREATE SCHEMA public;\n\n\n', '')

const backupDirectory = mkdtempSync(join(tmpdir(), 'innovation-migrations-before-baseline-'))
for (const entry of migrationEntries) {
  const source = join(migrationsDirectory, entry.name)
  const destination = join(backupDirectory, entry.name)
  cpSync(source, destination, { recursive: true })
}

for (const entry of migrationEntries) {
  const target = join(migrationsDirectory, entry.name)
  if (basename(target) !== entry.name || !target.startsWith(`${migrationsDirectory}/`)) {
    throw new Error(`Refusing unsafe migration target: ${target}`)
  }
  rmSync(target, { recursive: true })
}

const baselineDirectory = join(migrationsDirectory, '20260817000000_initial_baseline')
mkdirSync(baselineDirectory)
writeFileSync(
  join(baselineDirectory, 'migration.sql'),
  `-- REVIEWED PRE-DEPLOYMENT BASELINE.\n-- Generated from the fully remediated schema before any shared deployment.\n-- Runtime/application roles must be provisioned by scripts/bootstrap-db.ts.\n\n${dump.trim()}\n`,
  'utf8',
)

console.log(`Replaced ${migrationEntries.length} migrations with one initial baseline.`)
console.log(`Recoverable source backup: ${backupDirectory}`)
