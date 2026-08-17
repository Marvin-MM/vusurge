# ADR 0003 — Better Auth for identity, custom domain authorization

Status: Accepted
Date: 2026-08-16

## Context

Authentication (who is this?) and authorization (what may they do to this
specific tenant-owned resource?) are different problems. Better Auth solves
the first well: email/password, verification, reset, OAuth, sessions,
two-factor. It also ships an `organization` plugin that solves a GENERIC
version of the second — but this platform's authorization model has
requirements that plugin does not express: last-owner protection enforced as
an atomic database guard, RLS-backed tenant isolation, challenge-scoped staff
who hold no organization membership at all, and a fixed four-role hierarchy
with an explicit assignment ceiling.

## Decision

Better Auth owns identity only. Its Prisma adapter is pointed at the same
database and the same Prisma client the rest of the application uses — one
connection pool, not two. The Elysia integration is mounted once
(`shared/auth/elysia-plugin.ts`) and produces a single `access` value every
downstream route reads.

Everything past "who is this" is custom, built on `shared/authorization`:

- A closed set of named permissions (`Permission`), never a per-tenant
  role builder.
- A role → permission matrix (`ORGANIZATION_ROLE_PERMISSIONS`) that IS the
  policy, not a description of it.
- `checkPermission` / `authorize`, which evaluate platform, organization, and
  challenge-scoped permissions independently — a platform role is never a
  superset of organization permissions, and challenge staff never gain
  organization access through their assignment.
- `AccessContextResolver`, which reads authoritative membership and role state
  from the database on every request, never from a client-supplied "active
  organization" or a JWT claim.

## Consequences

- Organization membership, roles, invitations, join codes, and join requests
  are this codebase's own tables and modules, not Better Auth's. This is more
  code than adopting the plugin, in exchange for the specific guarantees
  (atomic last-owner protection, RLS enforcement, challenge-scoped staff
  isolation) the plugin does not provide.
- `resolveActor` reads two genuinely global, non-RLS tables (`user`,
  `platform_role_assignment`); `resolveOrganization` reads two RLS-protected
  tenant tables and needed a purpose-built access mode to do so safely before
  tenant context can be established — see ADR 0015 and the
  `app_context_resolution_access()` migration.
- Adding a new organization role would mean extending the closed
  `OrganizationRole` enum and the permission matrix, not configuring a plugin.
  That friction is deliberate: master prompt section 5.2 explicitly forbids
  organization-defined role builders in this release.
