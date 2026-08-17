# Test strategy

## Real infrastructure, never mocked business logic

Every test in this suite runs against **real PostgreSQL and real Redis** —
migrations, foreign keys, composite tenant constraints, partial unique
indexes, check constraints, triggers, and row-level security are all
actually exercised, not assumed. A Prisma mock cannot catch an RLS policy
gap, a missing composite foreign key, or a trigger that silently fails to
fire; several of the real defects this codebase found and fixed (see
`docs/IMPLEMENTATION_REPORT.md`) were only reachable by testing through the
genuine PostgreSQL role/RLS boundary. S3 (via a local MinIO container) is
also exercised for real in the exports/media suites.

Only genuinely external SaaS providers are substituted, and only at their
interface boundary, never in business logic: `FakeEmailProvider`
(`tests/helpers/fake-email-provider.ts`) stands in for Resend so a test can
recover a verification/invite link without a live Resend account, and
Cloudinary is disabled (`CLOUDINARY_ENABLED=false`) in the test environment.
Slack/Discord webhook tests make real outbound HTTP calls to
`hooks.slack.com`/`discord.com` (this environment has internet access)
without asserting on the exact provider response — proving the SSRF-safe
dispatch path actually reaches the real network, not a stub.

Two separate database connections are used deliberately in integration
tests: a **runtime** connection (the `ip_app` role) proves what the
least-privilege application role can and cannot do, and a **migration**
connection (`ip_migrator`) is used only to set up state the runtime role
cannot create and to assert the privilege separation itself holds
(`tests/integration/database-privileges.test.ts`).

## Layout

| Directory | What it covers | Files |
|---|---|---|
| `tests/unit/` | Pure functions with no I/O: config parsing/validation, HTTP primitives (pagination, cursors), security primitives (token generation/hashing, SSRF URL validation) | 3 |
| `tests/integration/` | Real-PostgreSQL behavior: RLS policy enforcement across every access mode, the `ip_app`/`ip_migrator` privilege boundary, idempotency-key claiming, the retention sweep against real rows | 5 |
| `tests/authorization/` | Table-driven permission-matrix tests: every (role, permission) pair, cross-tenant forged IDs, suspended organizations, inactive memberships | 1 |
| `tests/concurrency/` | Real races proven with actual concurrent requests, not simulated: join-code max-uses under concurrent redemption, last-active-owner protection, team-capacity row locking (fires two concurrent acceptances at one open slot and asserts exactly one succeeds), the tenant-transaction runner's retry-on-serialization-failure path | 4 |
| `tests/queue/` | Outbox dispatch: `FOR UPDATE SKIP LOCKED` batching, stale-`ENQUEUED` reconciliation, unknown-event-type terminal failure | 1 |
| `tests/e2e/` | Full HTTP-pipeline workflows — Elysia routing, the mounted Better Auth handler, the access-context resolver, RLS — for every module | 26 |
| `tests/security/` | Cross-tenant IDOR probes (404-vs-403 oracle), response-hardening (no stack traces, no internal error leakage) | 2 |

**42 test files, 329 tests, 3,297 assertions** as of this writing (`bun run
test`). Every file follows the same shape: `beforeAll` builds one real
`TestApp` + migration connection for the whole file, `beforeEach` truncates
every table via `resetDatabase` (dynamically discovered from `pg_tables`,
not a hand-maintained list — a hand-maintained list is exactly what caused a
Phase-0-era bug where only four hardcoded tables were actually truncated
between tests), and each `test` builds its own fixtures from scratch through
real HTTP calls.

## Why E2E is the primary layer, not an afterthought

Most of this suite's real defects were found by E2E tests exercising the
actual HTTP/authorization pipeline, not by service-level tests constructed
with a hand-built `AccessContext`. A hand-built context by definition already
assumes the access-resolution logic it is supposed to be testing. Concretely:
the `AccessContextResolver` querying RLS-protected tables through an
unscoped Prisma client (making every `orgContext: true` route 404 for every
caller, including legitimate members) was invisible to any test that
constructed an `AccessContext` by hand and only became visible once a real
signed-in HTTP request actually exercised the resolver. The same pattern
repeated at least four more times across later phases (see
`docs/IMPLEMENTATION_REPORT.md`'s per-phase "defects found and fixed"
sections) — which is why this codebase treats E2E coverage as the primary
correctness signal for authorization and cross-tenant boundaries, not a
final sanity check layered on top of unit tests that already assumed the
boundary worked.

## Critical E2E workflows

Every workflow below runs through the real HTTP pipeline end-to-end
(`tests/e2e/identity-and-tenancy-workflows.test.ts` and peers): signup →
verify → accept organization invitation; join-code onboarding; a user with
zero organizations remains fully valid; organization application → platform
approval → owner membership; a private organization never appears in public
search/listing, and disappears from every public projection the instant it
is made private or its organization is suspended; configure → publish a
challenge; register → organizer approve; create/join a team under row-lock
capacity enforcement; draft → finalize a submission before the deadline;
finalize after the deadline is rejected (`409`), reading database time
directly rather than a cached status; deadline extension/reopen produces an
audit row, a schedule-change row, and an outbox event; external judge
invite → accept → assignment → score → submit; judging finalize → results
finalize → publish; feedback is visible only after release; submission →
portfolio promotion → stage transition → milestone/metric; support ticket
lifecycle; moderation report → platform action; account deletion
request/cancel with a real confirmation email.

## Verification order

Always in this sequence, every time a change is made (not just before
declaring a phase complete):

```
bunx tsc --noEmit        # strict typecheck first — catches the cheapest class of bug
bunx biome check --write .   # lint + format
bunx tsc --noEmit        # re-check: a lint autofix can occasionally change semantics
bun run test              # the full suite, via the package.json script (see below)
```

`bun run test` (not bare `bun test`) is required: the package.json script
carries `--max-concurrency=1 --timeout=30000`. Database-mutating suites share
one disposable PostgreSQL database and are therefore serialized; the tests
that prove races create their contenders inside a single test and remain
genuinely concurrent. Bare `bun test` bypasses this isolation guarantee.

## What is intentionally not covered

Frontend, WebSockets, and every other master-prompt non-goal have no test
surface because they have no implementation surface. See the generated
requirement ledger in `docs/generated/requirement-matrix.md` for the complete,
classified contract and the evidence linked to every in-scope section.
