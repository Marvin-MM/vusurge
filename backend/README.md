# Innovation Management Platform — backend

A production-grade, multi-tenant backend for organizations to run
innovation/hackathon-style challenges: application-gated organization
onboarding, challenge configuration and lifecycle, dynamic screening forms,
challenge-scoped teams, immutable-version submissions, external judge
invitation and scoring, results publication, and a post-challenge innovation
portfolio with stage gates. No frontend, no WebSockets, no payments — see
"Non-goals" below for the complete, deliberate exclusion list.

## Architecture style

A **modular monolith**, not microservices (ADR-0002): one Bun process image
runs as either the API or a worker (`PROCESS_ROLE=api|worker`), sharing one
PostgreSQL database and one codebase, with clear internal module boundaries
instead of network boundaries between them. This buys transactional
consistency across the domains that need it (a business change, its audit
record, and its outbox event all land in one PostgreSQL transaction) without
the operational cost of a distributed system for a problem that does not yet
need one.

**Shared-schema multi-tenancy** (ADR-0001): every organization-owned table
carries a non-null `organization_id`. Composite unique keys
`(id, organization_id)` on parents plus composite foreign keys
`(x_id, organization_id) → parent(id, organization_id)` on children mean
PostgreSQL itself rejects a cross-tenant reference — not just application
code. Row-level security (`ENABLE ROW LEVEL SECURITY`, not `FORCE`; see
ADR-0015) is the second, independent layer: the runtime database role
(`ip_app`) is `NOSUPERUSER`, `NOBYPASSRLS`, owns nothing, and can only ever
see rows whose `organization_id` matches the transaction-local
`app.organization_id` setting — never a connection-global setting, always
set inside the same transaction as the queries it scopes. Five narrow,
purpose-built ways to obtain a scoped Prisma transaction client exist
(`withTenant`, `withPlatformAccess`, `withSecretLookup`,
`withContextResolution`, `withoutTenant` — see ADR-0020), and nothing in the
codebase queries the database any other way.

## Module layering

```
src/
  index.ts        API process entrypoint (Elysia, HTTP)
  worker.ts        Worker process entrypoint (BullMQ consumers + outbox dispatch loop)
  app.ts           Composition root
  container.ts     Manual dependency-injection graph (Infrastructure)
  generated/prisma/  Committed Prisma client + TypedSQL artifacts (see "Prisma" below)
  shared/          Infrastructure only — no business logic. config, errors, logging,
                   observability, database (tenant-transaction helpers), auth,
                   authorization, cache, queue, outbox, audit, idempotency, email,
                   images, storage, security, rate-limit, encryption, time, ids, http.
  modules/<name>/  Business modules. Every module is exactly five files:
                   <name>.dto.ts         Elysia/TypeBox request & response schemas
                   <name>.repository.ts  Prisma access — the ONLY file that touches Prisma
                   <name>.service.ts     Business rules, authorization calls, transactions
                   <name>.controller.ts  HTTP-context → service-call translation
                   <name>.route.ts       Elysia route registration
  workers/         Job router, per-event-type handlers, worker runtime
```

No business controller ever accesses Prisma directly, and no repository ever
calls an external provider — that separation is what lets `docs/queue-catalog.md`
be an accurate map of every asynchronous effect the system can perform, and
what let real defects be found by grep rather than by accident.

Thirty business modules live under `src/modules/`: `meta`, `users`,
`organizations`, `memberships`, `organization-applications`, `invitations`,
`join-codes`, `join-requests`, `public`, `platform-admin`, `challenges`
(tracks/prizes/sponsors/terms are sub-resources of it, not separate
modules), `forms`, `participation`, `announcements` (folds in FAQs), `media`,
`teams`, `matchmaking`, `submissions`, `judging` (staff/rubrics/assignments/
scorecards/results are sub-resources), `notifications`, `webhooks`,
`analytics`, `exports`, `integrations`, `innovation-portfolio`, `support`,
`moderation`, `audit`, `search`, `health`.

## Local prerequisites

- **Bun** 1.3.13+ (this repo pins exact dependency versions in `bun.lock`)
- **Docker** + Compose v2, for the local Postgres/Redis/MinIO stack

No local PostgreSQL/Redis/MinIO/ClamAV installation is required — `docker-compose.yml`
provisions them on non-default ports chosen specifically to avoid
colliding with other local stacks.

## Local services

```bash
docker compose up -d
```

Starts, on this machine only (see `docker-compose.yml` for the full
rationale and ports):

| Service | Port | Purpose |
|---|---|---|
| PostgreSQL 18 | `55433` | Primary database |
| Redis (cache) | `56380` | Cache-aside + rate limiting; `allkeys-lru`, safe to lose |
| Redis (queue) | `56381` | BullMQ; `maxmemory-policy=noeviction`, AOF-persisted |
| MinIO | `9110` (API) / `9111` (console) | S3-compatible object storage for exports/private documents |
| ClamAV | `53310` | Malware scanning for quarantined private documents |

This is a **development/test topology only**. Production must use managed,
highly-available PostgreSQL with automated backups and point-in-time
recovery, managed Redis (two separate deployments — see
`docs/env-reference.md`), and a real S3-compatible provider — see
"Production cautions" below.

## Installation

```bash
bun install --frozen-lockfile
cp .env.example .env
# generate a real value for BETTER_AUTH_SECRET (32+ chars) and
# ENCRYPTION_MASTER_KEY (openssl rand -base64 32) in .env
```

## Environment setup

Every variable is validated at process boot — see `.env.example` (the
authoritative, fully commented template) and `docs/env-reference.md` (a
structured index over the same variables, organized by section, noting
what's required and in which environment). A missing or malformed required
value aborts the process immediately (exit code 78) rather than surfacing as
a runtime failure under load.

## Database: roles, migrations, seeding

Two PostgreSQL roles exist by design (ADR-0015): `ip_migrator` owns the
schema and is used only by the Prisma CLI, never by a running process;
`ip_app` is the least-privilege runtime role the API/worker actually connect
as — no superuser, no `BYPASSRLS`, table-by-table grants, and only
`INSERT`/`SELECT` on `audit_event` (enforced at the database level, not just
in application code).

```bash
# One-time, requires a superuser connection (BOOTSTRAP_DATABASE_URL):
bun run db:bootstrap

# Apply every migration as the schema-owning role:
MIGRATION_DATABASE_URL=$MIGRATION_DATABASE_URL bun run db:migrate

# Regenerate the Prisma client (+ TypedSQL) after any schema change:
bun run db:generate

# Development fixtures (skills catalogue, technology tags, etc.):
bun run db:seed
```

**Never hand-edit an already-applied migration file.** If a migration has
already been run against any shared database, create a new follow-up
migration instead — editing an applied one produces a checksum mismatch on
every future `migrate deploy`. Use `bun run db:migration:create <name>` to
generate one via `prisma migrate diff`; a small number of hand-written SQL
objects (RLS policies, security-definer views, `pg_trgm` indexes) have no
representation in the `.prisma` schema files, so the generator always
proposes dropping them — review every `DROP` against
`docs/adr/0015-runtime-db-role-and-rls.md` before applying.

## Running the API

```bash
bun run start:api     # production
bun run dev:api        # --watch, local development
```

Serves `GET /health/live`, `GET /health/ready`, the versioned API under
`/api/v1`, and (when `FEATURE_OPENAPI_UI=true`) a browsable OpenAPI console.

## Running workers

```bash
bun run start:worker
bun run dev:worker
```

The worker process owns the outbox dispatch loop and every BullMQ consumer
(see `docs/queue-catalog.md`). It serves no HTTP traffic. Both processes
drain gracefully on `SIGTERM`/`SIGINT`: stop accepting new work, let active
jobs/requests finish inside `SHUTDOWN_TIMEOUT_MS`, then exit. A job killed
mid-flight leaves its outbox row `ENQUEUED`; the reconciler recovers it on
the next worker start, so nothing is silently lost.

## Tests

```bash
bun run test               # the full suite — always use this, not bare `bun test`
bun run test:unit
bun run test:integration
bun run test:authorization
bun run test:concurrency
bun run test:queue
bun run test:e2e
bun run test:security
```

`bun run test` (not bare `bun test`) is required in practice: the
package.json script carries `--max-concurrency=6 --timeout=15000`, tuned for
stability on a shared/busy machine. See `docs/test-strategy.md` for the full
philosophy (real PostgreSQL/Redis, never mocked business logic) and layout.

## Lint / typecheck

```bash
bun run lint        # biome check .
bun run lint:fix     # biome check --write .
bun run typecheck    # tsc --noEmit
```

## Auth provider configuration

Authentication is [Better Auth](https://www.better-auth.com), mounted
directly at `AUTH_BASE_PATH` (default `/api/v1/auth`) — this backend never
implements its own password/session controllers. Email/password with
verification and reset work out of the box. Google and GitHub OAuth are
opt-in (`GOOGLE_OAUTH_ENABLED`/`GITHUB_OAUTH_ENABLED`); GitHub requests only
the default public scopes, never private-repository access. Two-factor
authentication is available to every user and **mandatory** for
`PLATFORM_SUPERADMIN`. Sessions are durable PostgreSQL-backed cookies (ADR-0004),
not JWTs. See `docs/env-reference.md`'s Authentication section for every
variable, including OAuth callback URL shapes.

## Resend setup

Transactional and security email goes through
[Resend](https://resend.com) exclusively — there is deliberately no
Gmail/generic-SMTP fallback path (ADR-0016). Set `RESEND_API_KEY` and
`EMAIL_ENABLED=true`; production additionally requires `RESEND_WEBHOOK_SECRET`
to verify delivery/bounce/complaint webhook signatures. Use a dedicated
transactional sending subdomain with SPF/DKIM/DMARC configured, and never
enable open/click tracking on authentication email. Every email body is
plain text, never HTML — this backend never renders user-authored Markdown
to HTML anywhere, which removes an entire class of email-borne XSS rather
than adding a sanitizer dependency.

## Cloudinary setup

Cloudinary handles **images only** — challenge cover art, organization
logos, submission screenshots, avatars (ADR-0007). Documents and generated
exports go to S3-compatible storage instead. The backend never proxies image
bytes: it issues a short-lived signed upload authorization, the client
uploads directly to Cloudinary, and the backend confirms the result against
Cloudinary's own API response (never trusting client-supplied metadata)
before claiming the asset. Private delivery (e.g. an unpublished
submission's screenshot) uses signed, time-limited delivery URLs, never a
public Cloudinary URL. Set `CLOUDINARY_ENABLED=true` plus
`CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET`.

## S3 setup

Holds generated CSV exports and, when `FEATURE_DOCUMENT_UPLOADS=true`,
private uploaded documents (ADR-0008). Any S3-compatible provider works —
local development uses the bundled MinIO container. The bucket must be
private and encrypted at rest; the backend only ever hands out short-lived
presigned upload/download URLs, never a public bucket policy. Set
`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`, and `S3_ENDPOINT` for anything
other than real AWS S3.

When document uploads are enabled, also set `MALWARE_SCANNER_ENABLED=true`
and point the scanner host/port at a healthy ClamAV-compatible service. The
local compose service is available at `127.0.0.1:53310`. Confirmation only
moves an object into quarantine; downloads remain blocked until the worker
records a clean scan.

## Redis topology

**Two separate Redis deployments are required in production**, not two
logical databases on one server (ADR-0005): the cache
(`CACHE_REDIS_URL`) needs a TTL-friendly eviction policy
(`allkeys-lru`) and is safe to lose entirely — losing it degrades
performance, never correctness, since every cache read has a
database-backed fallback path. The queue (`QUEUE_REDIS_URL`) backs BullMQ
and **must** run `maxmemory-policy=noeviction` with persistence enabled —
BullMQ's internal data structures are not a cache, and evicting one under
memory pressure can silently drop a queued job. Configuration validation
refuses to boot in production if the two URLs are identical.

## OpenTelemetry

Tracing and metrics are both off by default (`OTEL_TRACING_ENABLED`/
`OTEL_METRICS_ENABLED=false`) and export via OTLP when enabled
(`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`/`_METRICS_ENDPOINT`). An optional
Prometheus scrape listener (`METRICS_PROMETHEUS_PORT`) binds to
`127.0.0.1` by default — it is deliberately outside the public API namespace
and must never be exposed on a public interface.

## OpenAPI

```bash
bun run openapi:generate   # writes docs/openapi.json from the live route DTOs
```

The specification is generated directly from every route's Elysia/TypeBox
schema — it cannot drift from the implementation, because it is not
hand-written. `FEATURE_OPENAPI_UI` (default on outside production) serves a
browsable console at boot; the JSON document itself is always regenerable
regardless of that flag.

## Initial superadmin bootstrap

There is no environment-variable-driven auto-promotion on boot, on purpose:
continuously promoting an email address on every startup would mean anyone
who ever controlled that address stays a superadmin forever, and it would
make the grant invisible in the audit trail. Instead:

```bash
# 1. Sign up and verify the target account through the normal auth flow.
# 2. Then, once, as an operator with database access:
bun run bootstrap:superadmin -- --email admin@example.org --reason "initial platform bootstrap"
```

This writes the role and its `AuditEvent` (`platform.role_granted`) in one
transaction. It requires the operator-only `MIGRATION_DATABASE_URL`, refuses a
`NOBYPASSRLS` runtime identity, and requires the target account to have verified
email plus enrolled MFA. The API exposes no platform-role mutation route.

## Production migration safety

`prisma migrate dev` is never used — it is interactive and cannot run
non-interactively in CI or a deploy pipeline. Migrations are generated with
`bun run db:migration:create` (`prisma migrate diff` against the shadow
database) and applied with `prisma migrate deploy` only, run by the
`ip_migrator` role, never by the runtime `ip_app` role. Review every
generated migration before applying it — the tool cannot see hand-written
SQL objects (RLS policies, security-definer views, `pg_trgm` indexes) and
will propose dropping them on every diff; each such `DROP` in a generated
migration file should be replaced with a comment, not applied. **Never
hand-edit a migration file that has already been applied to any shared
database** — create a new follow-up migration instead.

## Backup/restore operator responsibility

This backend does not implement its own backup mechanism — that is
correctly a managed-PostgreSQL-provider or infrastructure-team
responsibility (point-in-time recovery, automated snapshots, tested restore
procedures). What the application guarantees on its side: the transactional
outbox pattern means a business change and its side effects (audit record,
async job) are recorded atomically, so a restore to any committed point
leaves no dangling "the email was promised but the change never happened"
state. Redis loss (either deployment) cannot become *permanent* business-state
loss: the queue Redis holds only in-flight job state recoverable from the
outbox's `PENDING` rows, and the cache Redis holds only re-derivable data.

## Privacy/retention configuration

See `docs/retention.md` in full. In brief: every retention window is an
environment variable, not a hard-coded duration, and the shipped defaults
are engineering placeholders — set them from your own jurisdiction and
policy before launch. `audit_event` is never purged by the application; the
runtime role's database grants physically prevent it from doing so.

## Known intentionally deferred non-goals

Never built, per the master implementation contract: a frontend of any
kind, WebSockets/real-time push (HTTP polling is always valid; an optional
SSE stream exists behind a flag, not WebSockets), in-app chat, payments,
Kafka/RabbitMQ/NATS, Elasticsearch, a microservices split, ML-based
matching/moderation, admin user impersonation, multi-provider email
failover, a custom organization role builder, a workflow DSL, private
GitHub repository ingestion, a public roadmap/voting feature, XLSX export
(CSV only).

Conditionally enabled capabilities advertise operational readiness rather
than configuration intent. See the generated requirement ledger and evidence
inventory in `docs/generated/requirement-matrix.md` and
`docs/IMPLEMENTATION_REPORT.md`; regenerate both with
`bun run evidence:generate`.

## Further documentation

- `docs/openapi.json` — full endpoint reference, regenerate with `bun run openapi:generate`
- `docs/permissions-matrix.md` — role/permission matrix
- `docs/challenge-states.md` / `docs/organization-states.md` — state machines
- `docs/queue-catalog.md` — every queue and outbox event type
- `docs/env-reference.md` — every environment variable
- `docs/audit-events.md` — every audit action
- `docs/test-strategy.md` — test philosophy and layout
- `docs/retention.md` — data retention
- `docs/adr/` — architecture decision records
- `docs/IMPLEMENTATION_REPORT.md` — generated implementation, event, scheduler, and release-gate evidence
