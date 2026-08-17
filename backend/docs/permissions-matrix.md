# Permissions matrix

Authorization is expressed as named permissions ("does this actor hold
permission X in this organization"), never as role-name string comparisons.
This keeps the policy in one place and makes a role change a data change in
`src/shared/authorization/roles.ts` rather than a scattered edit across every
route. **This document is a manually maintained mirror of that file — if the
two ever disagree, the code is authoritative.**

Deny by default: a permission not explicitly granted to a role is denied.
There is no wildcard grant, and no organization can define its own roles —
the role set is fixed and closed, because an organization able to mint roles
is an organization able to mint privilege escalation.

## Organization roles

Each role is additive over the one above it — `MEMBER` ⊂ `CHALLENGE_MANAGER`
⊂ `ORG_ADMIN` ⊂ `ORG_OWNER` — except where noted.

| Permission | MEMBER | CHALLENGE_MANAGER | ORG_ADMIN | ORG_OWNER |
|---|---|---|---|---|
| `organization.view_private` | ✓ | ✓ | ✓ | ✓ |
| `challenge.view` | ✓ | ✓ | ✓ | ✓ |
| `submission.create` | ✓ | ✓ | ✓ | ✓ |
| `submission.edit_own` | ✓ | ✓ | ✓ | ✓ |
| `submission.submit` | ✓ | ✓ | ✓ | ✓ |
| `organization.manage_forms` | | ✓ | ✓ | ✓ |
| `organization.manage_announcements` | | ✓ | ✓ | ✓ |
| `organization.manage_faqs` | | ✓ | ✓ | ✓ |
| `challenge.create` | | ✓ | ✓ | ✓ |
| `challenge.edit` | | ✓ | ✓ | ✓ |
| `challenge.publish` | | ✓ | ✓ | ✓ |
| `challenge.change_schedule` | | ✓ | ✓ | ✓ |
| `challenge.cancel` | | ✓ | ✓ | ✓ |
| `challenge.archive` | | ✓ | ✓ | ✓ |
| `challenge.manage_tracks` | | ✓ | ✓ | ✓ |
| `challenge.manage_prizes` | | ✓ | ✓ | ✓ |
| `challenge.manage_sponsors` | | ✓ | ✓ | ✓ |
| `challenge.manage_terms` | | ✓ | ✓ | ✓ |
| `challenge.manage_participants` | | ✓ | ✓ | ✓ |
| `challenge.manage_teams` | | ✓ | ✓ | ✓ |
| `challenge.manage_judges` | | ✓ | ✓ | ✓ |
| `challenge.manage_rubric` | | ✓ | ✓ | ✓ |
| `challenge.publish_results` | | ✓ | ✓ | ✓ |
| `submission.view_all` | | ✓ | ✓ | ✓ |
| `submission.disqualify` | | ✓ | ✓ | ✓ |
| `submission.reopen` | | ✓ | ✓ | ✓ |
| `judging.view_progress` | | ✓ | ✓ | ✓ |
| `judging.reopen_scorecard` | | ✓ | ✓ | ✓ |
| `judging.finalize` | | ✓ | ✓ | ✓ |
| `judging.release_feedback` | | ✓ | ✓ | ✓ |
| `analytics.view_org` | | ✓ | ✓ | ✓ |
| `innovation.view` | | ✓ | ✓ | ✓ |
| `organization.manage_settings` | | | ✓ | ✓ |
| `organization.manage_profile` | | | ✓ | ✓ |
| `organization.manage_members` | | | ✓ | ✓ |
| `organization.manage_roles` | | | ✓ | ✓ |
| `organization.manage_invitations` | | | ✓ | ✓ |
| `organization.manage_join_codes` | | | ✓ | ✓ |
| `organization.review_join_requests` | | | ✓ | ✓ |
| `organization.manage_integrations` | | | ✓ | ✓ |
| `organization.view_audit` | | | ✓ | ✓ |
| `analytics.export_sensitive` | | | ✓ | ✓ |
| `innovation.manage` | | | ✓ | ✓ |
| `innovation.transition_stage` | | | ✓ | ✓ |
| `organization.transfer_ownership` | | | | ✓ |
| `organization.archive` | | | | ✓ |

`organization.transfer_ownership` and `organization.archive` are **owner-only**
by design: both are irreversible or change who ultimately controls the
tenant, so they are never granted to an admin regardless of how the rest of
the matrix is extended.

A role may assign another role only at or below its own rank
(`canAssignRole` in `roles.ts`) — an admin can never mint an owner, and no
role can promote itself. Rank order: `MEMBER` (1) < `CHALLENGE_MANAGER` (2) <
`ORG_ADMIN` (3) < `ORG_OWNER` (4). The last active owner of an organization
cannot be removed or demoted (enforced in `memberships.service.ts`, proven by
`tests/concurrency/last-owner-protection.test.ts`).

## Challenge-scoped staff roles

A judge or mentor is invited to **one challenge** and never receives
organization membership — an external judge from a sponsor company can score
submissions without gaining access to the member directory, other
challenges, analytics, or the audit log.

| Permission | JUDGE | MENTOR |
|---|---|---|
| `judging.view_assigned` | ✓ | |
| `judging.score_assigned` | ✓ | |
| `mentoring.view_assigned` | | ✓ |

`judging.score_assigned` is additionally constrained by assignment: holding
it permits scoring only the submissions actually assigned to that judge
(`JudgeAssignment` rows), never any submission in the challenge.

## Challenge-participant permissions

Independent of organization membership (master prompt section 12:
"organization membership and challenge participation are distinct"). This is
what lets an `OPEN_AUTHENTICATED` registrant — who by definition holds no
organization role — view the challenge and manage their own team/submission,
without granting anything about the organization itself. Granted whenever
`access.challenge.isApprovedParticipant` is true.

| Permission |
|---|
| `challenge.view` |
| `submission.create` |
| `submission.edit_own` |
| `submission.submit` |

## Platform roles

A platform superadmin is **not** an ordinary organization member. Reaching
into a tenant's private data requires an explicit `/platform/*` route, a
stated purpose string, and an audit record (`withPlatformAccess`) — there is
no ambient "see everything" grant, and platform role assignment itself
requires mandatory MFA and a fresh session for the assigning superadmin.

| Permission | PLATFORM_SUPERADMIN | PLATFORM_SUPPORT_AGENT |
|---|---|---|
| `platform.review_applications` | ✓ | |
| `platform.manage_organizations` | ✓ | |
| `platform.moderate` | ✓ | ✓ |
| `platform.support` | ✓ | ✓ |
| `platform.view_audit` | ✓ | |
| `platform.manage_feature_flags` | ✓ | |
| `platform.manage_roles` | ✓ | |

## Denial semantics: 404 vs 403

A caller with **no relationship at all** to the named organization (no
membership, no challenge-staff role, no approved participation) receives
`404 Not Found` — existence of a private organization/challenge is never
leaked to an unrelated caller. A caller with a **proven relationship** but
insufficient permission (an existing but too-low role, an inactive
membership, an approved participant attempting an organizer-only action)
receives `403 Forbidden`, since they already know the resource exists. See
`tests/security/cross-tenant-idor.test.ts` and
`tests/authorization/permission-matrix.test.ts`.

## Fresh-session-gated actions

A subset of permission checks additionally require a session established
within the last `AUTH_FRESH_SESSION_MAX_AGE_SECONDS` (default 900s),
rejecting the request otherwise even for an actor who holds the underlying
permission. This mirrors "confirm your password before changing it" for the
platform's highest-blast-radius actions:

- organization application approve/reject (platform);
- organization ownership transfer;
- organization archive (owner-initiated and platform);
- organization suspend/reinstate (platform);
- results retraction;
- integration connect/update/remove/test (an outbound webhook URL is a
  credential-adjacent secret);
- moderation hide-content/restore-content/suspend-organization.
