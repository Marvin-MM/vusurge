# Data retention

Every retention window is an operator-configurable environment variable
(`RETENTION_*`, see `docs/env-reference.md`) — never a hard-coded duration in
application code, per the master prompt's instruction not to invent legal
retention periods. **The defaults shipped in `.env.example` are engineering
placeholders, not legal advice.** Set every window from your own
jurisdiction (GDPR, CCPA, sector-specific rules) and organizational policy
before launch.

## How it runs

`runRetentionSweep` (`src/shared/retention/retention-service.ts`) is a
**callable function, not an in-process scheduler.** No cron/repeatable-job
infrastructure exists in this codebase beyond the outbox dispatcher's own
short-interval poll, and building a general-purpose scheduler was judged a
meaningfully larger addition than the sweep logic itself. Instead,
`scripts/run-retention-sweep.ts` is a standalone entrypoint (`bun run
retention:sweep`) meant to be invoked by whatever trigger fits a given
deployment — a Kubernetes `CronJob`, a systemd timer, a managed scheduled
task. It builds a full `Infrastructure`, runs the sweep, logs a structured
report, and exits non-zero if any individual task failed (so a scheduler's
own alerting picks up a partial failure).

Every task is **independent and best-effort**: one task's failure is caught,
logged, and recorded in the report's `errors` array, and does not prevent
the other eight from running.

## Tasks

| Task | Deletes | Window (env var) |
|---|---|---|
| `idempotency_records` | Expired idempotency keys, via `idempotency.purgeExpired()` | `RETENTION_IDEMPOTENCY_RECORD_HOURS` (default 48h) |
| `media_assets` | `MediaAsset` rows still `PENDING` past their `expiresAt` — an upload that was signed for but never confirmed | derived from the asset's own `expiresAt`, not a separate window |
| `webhook_events` | Received `WebhookEvent` rows older than the window | `RETENTION_WEBHOOK_RECEIPT_DAYS` (default 30d) |
| `notifications` | **Only already-read** notifications older than the window — an unread notification is kept regardless of age until the recipient has actually seen it | `RETENTION_NOTIFICATION_DAYS` (default 180d) |
| `rejected_applications` | `OrganizationApplication` rows `REJECTED` and unmodified past the window | `RETENTION_REJECTED_APPLICATION_DAYS` (default 365d) |
| `support_tickets` | `SupportTicket` rows `RESOLVED` or `CLOSED` and unmodified past the window | `RETENTION_RESOLVED_SUPPORT_TICKET_DAYS` (default 365d) |
| `invitations` | `OrganizationInvitation` rows: `PENDING` past `expiresAt`, or `DECLINED`/`REVOKED`/`EXPIRED` and unmodified past the window | `RETENTION_EXPIRED_INVITATION_DAYS` (default 90d) |
| `join_codes` | `OrganizationJoinCode` rows past `expiresAt`, or revoked past the window | `RETENTION_EXPIRED_INVITATION_DAYS` (shared with invitations) |
| `exports` | `DataExport` rows past `expiresAt` — the private object-storage file is deleted first (best-effort; a failure to delete the file does not block deleting the row, since a dangling object is a smaller problem than a dangling reference to a deleted row), then the row | `RETENTION_EXPORT_FILE_DAYS` (default 7d) |

`RETENTION_EMAIL_EVENT_DAYS` and `RETENTION_UNCLAIMED_MEDIA_HOURS` are
declared in configuration for forward compatibility with the email-event and
media-cleanup queue tasks but are not yet consumed by a sweep task in this
build — the `media_assets` task above already covers the concrete case
(unconfirmed pending uploads) that exists today; a general unclaimed-media
sweep across confirmed-but-orphaned assets is not yet implemented.

## What is deliberately *not* swept

**`audit_event` is never touched by this sweep, on purpose.** The runtime
database role (`ip_app`) is granted only `INSERT`/`SELECT` on that table —
`UPDATE`/`DELETE`/`TRUNCATE` are explicitly revoked at the PostgreSQL level
(see `docs/audit-events.md`) — specifically so the application itself cannot
alter or delete audit history, including via this job. `RETENTION_AUDIT_EVENT_DAYS`
exists in configuration to document the intended window (default ~7 years),
but any eventual audit-history pruning or pseudonymization is necessarily an
operator-run, migration-role action outside the application's own privilege
boundary — a different tool, not a gap in this one.

## Tenant scoping

Global tables (`idempotency_record`, `media_asset`, `webhook_event`,
`notification`, `organization_application`, `support_ticket`) are queried
with the plain database client — no RLS applies to them. Tenant-scoped
tables (`organization_invitation`, `organization_join_code`, `data_export`)
are swept through `transactions.withPlatformAccess`, the same narrow,
purpose-bound, audited cross-tenant access mode used everywhere else a
genuinely cross-tenant operation is required (see ADR-0020) — never a raw
RLS bypass.

## Account deletion

Account deletion (`POST /me/account-deletion-request`) is an explicit,
configurable grace-period workflow. It remains cancellable until a locked
execution transition wins; legal holds and final-organization-owner checks
block execution. The scheduled retention sweep revokes sessions and
credentials, pseudonymizes eligible PII while retaining business/consent/audit
subjects, tombstones user-owned provider media, records
`account.deletion_applied`, and emits `account.deletion_executed`.
