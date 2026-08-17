# Audit event catalog

Every high-value business or security change writes an append-only
`AuditEvent` row (`prisma/schema/infrastructure.prisma`) in the **same
database transaction** as the change it records — never a best-effort
after-the-fact log. **This document is a manually maintained mirror of
`src/shared/audit/audit-actions.ts` — if the two disagree, the code is
authoritative.**

## Read access

- `GET /organizations/:organizationId/audit` and `/audit/:auditEventId` —
  requires `organization.view_audit` (`ORG_ADMIN`+).
- `GET /platform/audit`, `/platform/audit/:auditEventId`, and
  `/platform/organizations/:organizationId/audit-summary` — requires
  `platform.view_audit` (`PLATFORM_SUPERADMIN` only). **Reading the
  platform-wide audit log is itself audited**: every call writes its own
  `platform.audit_accessed` entry, so a superadmin reviewing the audit trail
  leaves the same kind of record as any other platform-administrative
  action. There is no update or delete endpoint for audit events, matching
  the database grants themselves: the runtime role (`ip_app`) holds only
  `INSERT`/`SELECT` on `audit_event`, enforced at the PostgreSQL level, not
  merely in application code — the application cannot alter or delete audit
  history even if a bug tried to.

## Fields recorded

`id`, `organizationId` (null for global/platform actions), `actorType`
(`USER` \| `SYSTEM` \| `PLATFORM_ADMIN`), `actorUserId`, `action`,
`resourceType`, `resourceId`, `summary` (human-readable), `changes`
(structured before/after JSON where applicable), `reason` (for actions that
require one), `requestId`, `ipAddress`, `userAgent`, `createdAt`.

## Action catalog

### Organization applications and lifecycle
`organization_application.submitted` · `.updated` · `.resubmitted` ·
`.approved` · `.rejected` · `organization.created` · `.profile_updated` ·
`.settings_updated` · `.visibility_changed` · `.join_policy_changed` ·
`.suspended` · `.reinstated` · `.archived` · `.limits_changed`

### Membership and roles
`organization.membership.created` · `.role_changed` · `.removed` ·
`.reactivated` · `organization.ownership_transferred`

### Invitations, join codes, join requests
`organization.invitation.created` · `.revoked` · `.resent` · `.accepted` ·
`.declined` · `organization.join_code.created` · `.revoked` · `.redeemed` ·
`organization.join_request.submitted` · `.withdrawn` · `.approved` ·
`.rejected`

### Challenges
`challenge.created` · `.updated` · `.published` · `.rescheduled` ·
`.deadline_extended` · `.deadline_shortened` · `.reopened` · `.cancelled` ·
`.archived` · `challenge.track.created` · `.updated` · `.archived` ·
`challenge.prize.changed` · `challenge.sponsor.changed`

### Terms and consent
`challenge.terms_version.created` · `.activated` · `challenge.terms.accepted`

### Forms
`form.created` · `.updated` · `form.version.created` · `.published` ·
`form.response.submitted`

### Participation
`participation.registered` · `.application_submitted` · `.approved` ·
`.rejected` · `.withdrawn` · `.disqualified` · `.reinstated`

### Teams
`team.created` · `.updated` · `team.invitation.created` · `.revoked` ·
`.declined` · `team.member.joined` · `.left` · `.removed` ·
`team.captain_transferred` · `team.organizer_exception`

### Matchmaking
`matchmaking.post.created` · `.updated` · `.closed` · `.deleted` ·
`matchmaking.interest.expressed`

### Submissions
`submission.created` · `.draft_saved` · `.finalized` · `.reopened` ·
`.disqualified` · `.reinstated`

### Judging
`judging.staff_invited` · `.staff_invitation_revoked` · `.staff_accepted` ·
`.staff_removed` · `judging.rubric.created` · `judging.rubric_version.created`
· `.activated` · `judging.assignment.created` · `.reassigned` · `.removed` ·
`judging.conflict_declared` · `.recused` · `judging.scorecard.submitted` ·
`.reopened` · `judging.finalized` · `results.finalized` · `.published` ·
`.retracted` · `results.feedback_released`

### Communication
`announcement.created` · `.updated` · `.published` · `.unpublished` ·
`faq.changed`

### Integrations
`integration.created` · `.updated` · `.credential_rotated` · `.deleted` ·
`.tested`

### Media and files
`media.asset_claimed` · `.asset_deleted` · `file.uploaded` · `.deleted` ·
`.quarantined`

### Exports and analytics
`export.requested` · `.downloaded` · `.deleted`

### Innovation portfolio
`innovation.created` · `.updated` · `.promoted_from_submission` ·
`.stage_changed` · `.milestone_changed` · `.evidence_changed` ·
`.metric_changed`

### Support and moderation
`support.ticket_created` · `.status_changed` · `.assigned` ·
`.priority_changed` · `.resolved` · `moderation.content_reported` ·
`.report_dismissed` · `.report_action_taken` · `.content_hidden` ·
`.content_restored`

### Email deliverability
`email.suppressed`

### Platform and account security
`platform.role_granted` · `.role_revoked` · `.feature_flag_changed` ·
`.audit_accessed` · `account.deletion_requested` · `.deletion_cancelled` ·
`.deletion_applied`

## Reason-required actions

A non-exhaustive but representative set of actions that require an explicit
`reason` string in the request body, because they are high-privilege,
irreversible, or participant-visible: challenge cancel/archive, deadline
extend/reopen, organization suspend/reinstate/archive, ownership transfer,
results retraction, participation reject/disqualify/reinstate, moderation
actions, and account deletion request/cancellation notes.

## Tenant scoping

`organizationId` is set for every organization-scoped action and left `null`
for genuinely global/platform actions (account deletion, platform role
grants). `audit_event` itself carries no row-level-security policy — the
database-level `INSERT`/`SELECT`-only grant is what protects it, not RLS —
but every read path still scopes by `organizationId` in its `WHERE` clause
(`withTenant` for the organization-facing endpoint, `withPlatformAccess` for
the platform-wide one) so a caller only ever sees what their permission
level allows.
