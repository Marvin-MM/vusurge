# ADR 0019 — Prisma 7 driver adapter, committed client, and TypedSQL scope

Status: Accepted
Date: 2026-08-16

## Context

Prisma 7 changed several things the architecture depends on:

- The `prisma-client-js` generator is superseded by `prisma-client`, which
  **requires** an explicit `output` path.
- A **driver adapter is now mandatory** (`@prisma/adapter-pg` + `pg` for
  PostgreSQL). The Rust query engine is gone.
- A connection URL is **no longer accepted in `schema.prisma`**; the CLI reads
  it from `prisma.config.ts`.
- `prisma migrate dev` no longer seeds automatically, and it is interactive —
  it prompts on any potentially destructive change, which makes it unusable in
  a non-interactive shell or in CI.
- TypedSQL remains a **preview feature** and requires a live database at
  `prisma generate --sql` time, because it introspects the database to type the
  queries.

That last point conflicts with two things a production build needs: a
`docker build` that does not require a database, and a clean checkout that
typechecks before anyone has run migrations.

## Decision

**Driver adapter.** Use `@prisma/adapter-pg`. This is a net gain: the pool is
now application-controlled, so `max`, connection timeout, idle timeout,
`statement_timeout`, and `application_name` are all explicit in
`shared/database/prisma.ts`, and pool counters are readable for readiness and
metrics.

**Connection separation.** `prisma.config.ts` uses `MIGRATION_DATABASE_URL` and
deliberately does *not* fall back to `DATABASE_URL`; falling back would silently
run migrations as the least-privilege runtime role. The application supplies its
own connection through the adapter.

**Generated client is committed.** The generator emits to
`src/generated/prisma/`, and that directory is tracked in git. Prisma 7's client
is Rust-free TypeScript, so this is source, not a binary blob. It makes
`docker build` and a fresh checkout work with no database. CI regenerates and
runs `git diff --exit-code`, so the committed copy cannot drift from the schema
without failing the build.

**Migrations are created non-interactively.** `scripts/create-migration.ts`
diffs the applied migration history against the schema via `prisma migrate diff`
and writes the SQL for review; `prisma migrate deploy` applies it. `migrate dev`
is not used. The shadow database that `migrate diff --from-migrations` needs is
provisioned by the bootstrap script, so the migration role does not need
`CREATEDB` permanently.

**TypedSQL is scoped narrowly** to analytics rollups, judging aggregation, and
search ranking — queries where PostgreSQL-specific SQL is genuinely clearer or
faster than the query builder. Ordinary CRUD stays on the Prisma client.
Everything else that needs raw SQL uses parameterised tagged templates
(`$queryRaw`), never string interpolation.

## Consequences

- Regenerating the client is a normal part of a schema change:
  `bun run db:generate`, then commit. CI enforces it.
- The committed client adds diff noise on schema changes. That is accepted in
  exchange for database-free builds and reproducible images.
- TypedSQL's preview status is contained: it covers a small, fixed set of
  queries, and if it were withdrawn the same queries would move to
  parameterised `$queryRaw` with hand-written row types, with no architectural
  change.
- Raw SQL still needs care that the ORM would otherwise provide. The pg driver
  adapter cannot deserialize a `void` column, so `select pg_sleep(...)` must be
  cast — a small example of the general rule that raw SQL results are the
  caller's responsibility to type correctly.
