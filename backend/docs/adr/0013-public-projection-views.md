# ADR 0013 — Curated SQL views for every public projection

Status: Accepted
Date: 2026-08-16

## Context

Public routes serve unauthenticated visitors. If they ever queried a tenant
base table directly — even with a `WHERE status = 'ACTIVE'` clause hand-written
into each call site — a single missed filter, a forgotten column exclusion, or
a later column addition would leak private data with no compiler or database
constraint to catch it. This class of mistake (`SELECT *` reaching a public
response) is exactly what master prompt section 6.4 requires structural
protection against, not just code review.

## Decision

Every public projection is a named PostgreSQL view, not a query pattern
repeated in application code. `public_organization_view` is the first:

```sql
create view public_organization_view with (security_invoker = false) as
select id, slug, name, description, organization_type, website_url,
       country, region, logo_asset_id, created_at
from organization
where status = 'ACTIVE' and visibility = 'PUBLIC';
```

Two properties make this safe rather than merely convenient:

1. **The field list is fixed and minimal.** `settings`, membership data, and
   every other non-public column simply do not exist in the view's row shape
   — there is no field to accidentally serialize.
2. **`security_invoker = false` and `security_barrier = true` are explicit.**
   Each view runs with the privileges of `ip_public_views`, a dedicated
   `NOLOGIN` owner that owns no base table. It is the only public-projection
   identity allowed to bypass the `FORCE ROW LEVEL SECURITY` policies on those
   tables. The runtime role `ip_app` is not a member and cannot assume it.
   The owner has `SELECT` only on the twelve base tables used by the eight
   projection views; it has no grant on identity, audit, files, deliveries,
   integrations, idempotency, or other private tables. The runtime role has
   `SELECT` only on the views and no view write privilege.
   Runtime code receives only the view's fixed projection; private base-table
   reads remain bound to an explicit tenant/platform transaction (ADR 0015).

The repository layer for public data (`modules/public/public.repository.ts`)
queries the view with `$queryRaw`, never the Prisma model for `Organization`.

## Consequences

- An organization that changes from `PUBLIC` to `PRIVATE`, or from `ACTIVE`
  to `SUSPENDED`, disappears from every public listing the instant that
  transaction commits — the view's `WHERE` clause is evaluated live, not
  synced into a cache that could lag. Proven in
  `tests/e2e/identity-and-tenancy-workflows.test.ts`.
- Adding a new public-facing field means widening the view's column list, an
  explicit, reviewable schema change — not a risk that a future controller
  quietly introduces by spreading a full model object into a response.
- The same pattern extends to every future public projection (challenges,
  results, portfolio items): a named view with a minimal column list and an
  explicit security-invoker choice, never a base table read from a public
  route.
