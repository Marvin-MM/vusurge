/**
 * Compare Prisma's migration replay to its datamodel while preserving reviewed
 * PostgreSQL-only objects that Prisma cannot model (RLS, views, triggers,
 * security-definer resolvers, expression indexes, and selected SQL defaults).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const snapshotPath = join(root, 'docs', 'generated', 'prisma-migration-diff.txt')
const generate = process.argv.includes('--generate')

const child = Bun.spawn(
  [
    'bunx',
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema',
    'prisma/schema',
  ],
  { cwd: root, env: Bun.env, stdout: 'pipe', stderr: 'inherit' },
)
const output = await new Response(child.stdout).text()
const exitCode = await child.exited
if (exitCode !== 0) throw new Error(`prisma migrate diff failed with exit code ${exitCode}.`)

const normalized = output.trim().length === 0 ? 'No difference detected.\n' : `${output.trim()}\n`
if (generate) {
  writeFileSync(snapshotPath, normalized, 'utf8')
  console.log('Updated docs/generated/prisma-migration-diff.txt.')
} else {
  if (!existsSync(snapshotPath) || readFileSync(snapshotPath, 'utf8') !== normalized) {
    throw new Error(
      'Prisma migration/datamodel drift changed. Review it and run bun run db:drift:generate.',
    )
  }
  console.log(
    'Prisma migration/datamodel drift matches the reviewed PostgreSQL extension snapshot.',
  )
}
