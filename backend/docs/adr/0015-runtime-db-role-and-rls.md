# ADR 0015 — Least-privilege runtime role, RLS, and transaction-local tenancy

Status: Accepted
Date: 2026-08-16

## Context

Application-level authorization is necessary but not sufficient. A single missed
`where organizationId` clause in one repository method is a cross-tenant data
leak, and code review is not a reliable control against that class of mistake.
The database must be able to refuse.

PostgreSQL row-level security can enforce it, but only if the role the
application connects as is actually subject to policies — a superuser, a table
owner, or a role with `BYPASSRLS` silently ignores them.

## Decision

### Three roles

| Role | Purpose | Rights |
|---|---|---|
| `ip_migrator` | owns tables, runs migrations | schema owner and `BYPASSRLS`; used by tooling only, never by a running process |
| `ip_app` | the application runtime | `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, owns nothing, cannot create objects in `public` |
| `ip_public_views` | owns only the explicit public projection views | `NOLOGIN`, `BYPASSRLS`; the runtime role is not a member and cannot assume it |

All are created by `scripts/bootstrap-db.ts`, which an operator runs once. The
API and worker never hold the migration connection: `DATABASE_URL` and
`MIGRATION_DATABASE_URL` are separate settings, and `prisma.config.ts`
deliberately does not fall back from one to the other.

Statement-level safety nets are attached to the role itself, so they survive
connection pooling: `statement_timeout`, `idle_in_transaction_session_timeout`,
and `lock_timeout`.

### Append-only audit

`ip_app` holds `SELECT` and `INSERT` on `audit_event` and nothing else. `UPDATE`,
`DELETE`, and `TRUNCATE` are revoked. A mistaken audit record is corrected by
appending another event, never by rewriting history. Integration tests assert
each denial against the real database, because an application-level test could
not distinguish "the code never issues this statement" from "the database would
refuse it".

### Transaction-local tenant context

RLS policies read the active tenant from a setting established with
`set_config('app.organization_id', $1, true)` — the third argument makes it
**transaction-local**.

This is the critical detail. Prisma hands out pooled connections; a
session-level setting would outlive its transaction and leak the previous
request's tenant to the next request that reused the connection. The setting is
therefore established inside the same transaction as the queries it governs, by
the single helper `withTenantTransaction`, which is the only sanctioned way to
obtain a transaction client for tenant data.

`current_setting('app.organization_id', true)` returns NULL when unset, and a
policy comparing a column to NULL yields NULL rather than true — so a query that
forgot to establish tenant context matches **no** rows rather than all of them.
Failure is closed by construction.

### Purpose-based platform access

Platform administration needs cross-tenant reach. Rather than a permanent
bypass, `withPlatformAccess(purpose)` sets `app.platform_access` transaction-
locally, which the policies honour. A non-empty purpose is required, the access
is logged, and the caller is responsible for the audit record that justifies it.
There is deliberately no casual "view everything" path.

### View semantics

Public projection views are security-barrier, definer-semantics views owned by
the dedicated `NOLOGIN` role `ip_public_views`. Only that explicit column
allowlist can exercise the role's RLS bypass. Tenant tables use `FORCE ROW LEVEL
SECURITY`; `ip_app` owns no table, has `NOBYPASSRLS`, is not a member of the view
owner role, and cannot assume either maintenance identity. See ADR 0013.

## Consequences

- Deployment requires a bootstrap step before the first migration. It is
  explicit, one-time, and operator-run — never performed at application startup.
- Role names (`ip_app`, `ip_migrator`) are part of the deployment contract
  because migration SQL references them; the migration fails loudly if the
  runtime role is absent rather than silently leaving it without grants.
- There is deliberately no broad default table/function grant. Every migration
  grants only the operations its new objects require, enables and forces RLS
  where applicable, and updates the narrow public-view source allowlist when a
  projection changes. The database-privilege tests fail if public views gain
  write access or their owner gains unrelated base-table reads.
- Application authorization remains mandatory. RLS confines a query to one
  tenant; it says nothing about whether *this actor* may perform *this action*.
