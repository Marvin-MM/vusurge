# ADR 0020 — Four tenant-transaction access modes, not one RLS bypass

Status: Accepted
Date: 2026-08-16

## Context

RLS on tenant tables (ADR 0015) requires `app.organization_id` to already be
set before a query against them can see anything. Three legitimate operations
need to read those tables in situations where that is impossible or wrong:

1. **Resolving whether the caller belongs to the organization named in the
   route.** This is what decides whether `withTenant` for that organization is
   even appropriate — it cannot itself require having already made that
   decision. Discovered live: every `orgContext: true` route returned 404
   for every caller, including legitimate members, because
   `AccessContextResolver` queried `organization` and `organization_membership`
   with no tenant context set at all. RLS was doing exactly its job — denying
   an unscoped query — against a query that had no way to become scoped.
2. **Listing a user's own rows across every organization** — "my
   organizations," "my join requests." The caller's identity is known and
   trustworthy (it is their own session); the organization is not, because
   there are many.
3. **Resolving an invitation or join code by its token**, before the
   token has been looked up and its organization learned.

The instinctive fix — route all three through `withPlatformAccess` — is
wrong. That mode represents an administrative bypass, is logged as one on
every call, and doing so for routine, high-frequency, non-administrative
reads would make genuine platform actions impossible to distinguish from
noise in the logs, and would overstate what these reads actually need.

## Decision

Four transaction modes exist on `TenantTransactionRunner`, each granting the
minimum RLS visibility its purpose requires:

| Mode | Sets | Grants | Used for |
|---|---|---|---|
| `withTenant(orgId)` | `app.organization_id` | rows of exactly that tenant | ordinary business operations |
| `withPlatformAccess(purpose)` | `app.platform_access` | every tenant's rows | explicit platform-admin routes; logged, requires a stated purpose |
| `withSecretLookup()` | `app.secret_lookup` | rows matched by an unguessable token | resolving an invitation/join-code by token, before its tenant is known |
| `withContextResolution()` | `app.context_resolution` | `organization`, `organization_membership`, `organization_join_request` | resolving the caller's OWN relationship to an organization, or listing the caller's OWN cross-org rows |

Each mode is backed by its own SQL helper function
(`app_platform_access()`, `app_secret_lookup_access()`,
`app_context_resolution_access()`) and its own additional `OR` clause on the
affected tables' RLS policies — never a shared flag reused for different
purposes. `withContextResolution` and `withSecretLookup` grant read access
only; `organization_join_code`'s policy is the sole exception, because
redemption is deliberately one atomic guarded `UPDATE` rather than a
find-then-mutate pair (see the migration `..._join_code_atomic_redeem_write_access`),
so its `WITH CHECK` also honours secret-lookup access.

Callers of `withContextResolution` and `withSecretLookup` are responsible for
keeping their own query's field list and `WHERE` clause minimal — RLS is not
the backstop for these specific reads, the query is. In every current use,
that means: a caller's own membership row only, or an organization's
`id`/`status` only.

## Consequences

- Discovered and fixed by writing real end-to-end HTTP tests rather than
  service-level tests with a hand-built `AccessContext` — the gap was
  invisible until a request went through the actual resolver. Every E2E test
  in `tests/e2e/` and `tests/security/` now exercises this path for real.
- Four narrow modes, not one broad one, means a future reviewer asking "why
  does this query bypass RLS" gets a precise, checkable answer instead of "it
  needed elevated access" — and a mistaken use of the wrong mode is a
  one-line diff to spot in review.
- The pattern generalises: Phase 2+ modules that need an equivalent
  before-tenant-is-known lookup (challenge staff invitations, team
  invitations) extend an existing table's policy with the same
  `app_secret_lookup_access()` function rather than inventing a new mechanism.
