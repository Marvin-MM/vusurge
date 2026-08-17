# Organization state transitions

`Organization.status` (`prisma/schema/organization.prisma`) is one of:

```
ACTIVE ⇄ SUSPENDED
  ↓         ↓
      ARCHIVED
```

An organization is created directly as `ACTIVE` the moment a platform
superadmin approves its `OrganizationApplication` — there is no `PENDING`
organization status; the pending state lives on the application, not the
organization it will become.

## Transitions

| From | Action | To | Who | Guard |
|---|---|---|---|---|
| — | Approve application | `ACTIVE` | `PLATFORM_SUPERADMIN` (`platform.review_applications`) | Application must be `PENDING`; creates the organization, grants the applicant `ORG_OWNER`, all in one transaction |
| `ACTIVE` | `POST /platform/organizations/:id/suspend` | `SUSPENDED` | `PLATFORM_SUPERADMIN` (`platform.manage_organizations`), fresh session | reason required; an organization owner cannot override or self-reinstate a suspension |
| `SUSPENDED` | `POST /platform/organizations/:id/reinstate` | `ACTIVE` | `PLATFORM_SUPERADMIN`, fresh session | reason required |
| `ACTIVE` or `SUSPENDED` | `POST /organizations/:id/archive` (owner) | `ARCHIVED` | `ORG_OWNER` (`organization.archive`), fresh session | reason required |
| `ACTIVE` or `SUSPENDED` | `POST /platform/organizations/:id/archive` (platform) | `ARCHIVED` | `PLATFORM_SUPERADMIN`, fresh session | reason required |

`ARCHIVED` is **terminal** — no code path transitions an organization back
out of it. There is no un-archive action, by design: archival is presented
as a one-way decision (distinct from suspension, which is explicitly
reversible).

## Independence from other settings

- **Visibility** (`PRIVATE`/`PUBLIC`, whether the organization appears in
  public listings) is a wholly separate field from status and from join
  policy. A `PUBLIC` organization is discoverable; it does not thereby become
  joinable.
- **Join policy** (invite-only / join-code / join-request /
  reserved-but-not-activatable `OPEN`) governs how a user becomes a member
  and is independent of both status and visibility.
- A `SUSPENDED` or `ARCHIVED` organization disappears from every public
  projection view (`public_organization_view`, `public_challenge_view`,
  `public_innovation_view`, `public_project_view`) the instant the status
  changes — those views filter on `organization.status = 'ACTIVE'` directly,
  so a challenge that is individually `PUBLIC` and published still vanishes
  the moment its owning organization is suspended (proven by
  `tests/e2e/public.test.ts`).

## What suspension/archival does and does not do

Suspending or archiving an organization changes its own `status` column only.
It does not cascade a status change onto the organization's challenges,
submissions, or other tenant data — those rows are untouched and become
reachable again immediately upon reinstatement (for `SUSPENDED`). What
actually blocks activity while an organization is not `ACTIVE` is enforced at
each write path's own authorization/precondition check (for example,
`organizations.service.ts`'s `allowSuspendedOrganization`/
`allowArchivedOrganization` options on `authorize()`, used narrowly to permit
exactly the actions that must remain available — e.g. reinstating, or an
owner archiving their own already-suspended organization — while blocking
everything else).

## Audit and notification side effects

Every transition above writes an `AuditEvent` (`organization.created`,
`organization.suspended`, `organization.reinstated`, `organization.archived`
— see `docs/audit-events.md`) in the same transaction as the status change.
Application approval additionally writes an outbox event
(`organization_application.decided`) that emails the applicant.
