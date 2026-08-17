# ADR 0001 — Shared-schema multi-tenancy keyed on `organization_id`

Status: Accepted
Date: 2026-08-16

## Context

The platform serves many organizations — university clubs, companies, NGOs,
accelerators — from one deployment. A user account is global and may hold zero,
one, or many organization memberships simultaneously. Tenant data must never
cross an organization boundary.

Three models were available:

1. **Database per tenant.** Strongest isolation, but migrations, connection
   pooling, and cross-tenant platform administration all scale linearly with
   tenant count. A platform with thousands of small clubs would exhaust
   connections before it exhausted revenue.
2. **Schema per tenant.** Same migration-fan-out problem, plus PostgreSQL
   catalogue bloat at high schema counts.
3. **Shared schema with a tenant key.** One migration path, one pool, cheap
   platform-wide queries. Isolation becomes an application and policy concern
   rather than a physical one.

## Decision

Use a shared schema. `organization_id` is the tenant key.

Every organization-owned table carries a **non-null `organization_id`**, even
when the organization could be inferred through a relation. Denormalising the
tenant key onto every row is deliberate: it makes the tenant predicate a local
property of each table, so a query cannot accidentally omit it by joining
through a parent, and it lets a row-level security policy be written for every
tenant table in exactly the same shape.

Isolation is enforced at three independent layers, in this order:

1. **Application authorization** — every request resolves the actor's
   membership and role for the organization named in the route, and denies by
   default (see `shared/authorization`).
2. **Composite foreign keys** — child rows reference `(parent_id,
   organization_id)` against a matching composite unique key on the parent, so
   PostgreSQL itself rejects a cross-tenant reference even if application code
   is wrong. See ADR 0015.
3. **Row-level security** — a transaction-local tenant setting confines every
   statement, so a query that forgets its `where organizationId` clause returns
   nothing rather than everything. See ADR 0015.

No single layer is trusted alone. RLS is defence in depth, not a substitute for
authorization; authorization is not a substitute for database constraints.

## Consequences

- A tenant-scoped query must go through `withTenantTransaction`, which is the
  only sanctioned way to obtain a transaction client for tenant data.
- Cache keys are namespaced by `organization_id` so a cached value can never be
  served to the wrong tenant, even when two tenants share a resource ID shape.
- Cross-tenant escape tests are mandatory and release-blocking: for every
  sensitive route, a request from an unrelated organization and a forged
  cross-tenant resource ID must both return 404.
- Platform-wide administrative access is possible but never casual: it requires
  an explicit, purpose-carrying transaction that is logged and audited.
- Very large append-only tables (audit, notifications) can be partitioned later
  if real scale justifies it; the tenant key makes that partitioning natural.
