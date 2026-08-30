/**
 * Resolve the project-local Prisma CLI entry point.
 *
 * Shared by every script that runs `prisma` (run-prisma.ts,
 * check-prisma-drift.ts, create-migration.ts) so they all resolve the CLI the
 * same way: from this repository's node_modules, and ONLY from there.
 *
 * Why not `bunx prisma`: when the CLI is absent from node_modules, bunx
 * silently installs whatever package currently holds the npm `latest`
 * dist-tag and runs THAT — a floating, untracked Prisma version that can be
 * a different major than the one bun.lock pins. This exact failure broke
 * production on 2026-08-29: the deployed image had been built before the CLI
 * moved into `dependencies`, so the initContainer's `bunx prisma migrate
 * deploy` fetched prisma 8.0.0-rc.12 from npm at pod start, and Prisma 8 no
 * longer registers `migrate` (renamed to `migration`) — every new pod died in
 * init with CLI.UNKNOWN_COMMAND while already-running pods kept serving. A
 * missing CLI must fail loudly here (and earlier still, at image build time
 * via the Dockerfile's `bun run db:validate` gate), never be papered over by
 * a network fetch of an unpinned version.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const prismaDirectory = join(import.meta.dir, '..', 'node_modules', 'prisma')

export function resolvePrismaCli(): string {
  const packageJsonPath = join(prismaDirectory, 'package.json')

  if (!existsSync(packageJsonPath)) {
    console.error(
      'The prisma CLI is not installed in node_modules. Run `bun install` first. ' +
        'Refusing to fall back to `bunx prisma`, which would download an untracked ' +
        'prisma@latest from npm at runtime.',
    )
    process.exit(127)
  }

  const binField: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8')).bin
  const binPath =
    typeof binField === 'string'
      ? binField
      : typeof binField === 'object' && binField !== null && 'prisma' in binField
        ? String((binField as Record<string, unknown>)['prisma'])
        : undefined

  if (binPath === undefined || !existsSync(join(prismaDirectory, binPath))) {
    console.error(
      'The prisma CLI entry point is missing from node_modules/prisma. Run `bun install` first.',
    )
    process.exit(127)
  }

  return join(prismaDirectory, binPath)
}
