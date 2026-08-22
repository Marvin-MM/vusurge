import { UserContext, OrgRole, ChallengeRole } from "./index";

/**
 * The exact permission catalogue from the real backend
 * (backend/src/shared/authorization/permissions.ts). Every string here has a
 * server-side enforcement point — this file is a client-side UX guard only
 * (see `can()` below); it must never diverge from the backend's own list.
 */
export type Permission =
  // Organization
  | "organization.view_private"
  | "organization.manage_settings"
  | "organization.manage_profile"
  | "organization.manage_members"
  | "organization.manage_roles"
  | "organization.transfer_ownership"
  | "organization.archive"
  | "organization.manage_invitations"
  | "organization.manage_join_codes"
  | "organization.review_join_requests"
  | "organization.manage_integrations"
  | "organization.view_audit"
  | "organization.manage_forms"
  | "organization.manage_announcements"
  | "organization.manage_faqs"

  // Challenge
  | "challenge.create"
  | "challenge.edit"
  | "challenge.view"
  | "challenge.publish"
  | "challenge.change_schedule"
  | "challenge.cancel"
  | "challenge.archive"
  | "challenge.manage_tracks"
  | "challenge.manage_prizes"
  | "challenge.manage_sponsors"
  | "challenge.manage_terms"
  | "challenge.manage_participants"
  | "challenge.manage_teams"
  | "challenge.manage_judges"
  | "challenge.manage_rubric"
  | "challenge.publish_results"

  // Submission
  | "submission.create"
  | "submission.edit_own"
  | "submission.submit"
  | "submission.view_all"
  | "submission.disqualify"
  | "submission.reopen"

  // Judging
  | "judging.view_assigned"
  | "judging.score_assigned"
  | "judging.view_progress"
  | "judging.reopen_scorecard"
  | "judging.finalize"
  | "judging.release_feedback"

  // Mentoring (challenge-scoped, distinct from judging)
  | "mentoring.view_assigned"

  // Analytics
  | "analytics.view_org"
  | "analytics.export_sensitive"

  // Innovation portfolio
  | "innovation.view"
  | "innovation.manage"
  | "innovation.transition_stage"

  // Platform
  | "platform.review_applications"
  | "platform.manage_organizations"
  | "platform.moderate"
  | "platform.support"
  | "platform.view_audit"
  | "platform.manage_feature_flags"
  | "platform.manage_roles";

/**
 * Organization roles are strictly additive on the backend
 * (MEMBER ⊂ CHALLENGE_MANAGER ⊂ ORG_ADMIN ⊂ ORG_OWNER) — expressed here as
 * literal set unions, not hand-copied lists, so the invariant can't drift.
 */
const MEMBER_PERMISSIONS: readonly Permission[] = [
  "organization.view_private",
  "challenge.view",
  "submission.create",
  "submission.edit_own",
  "submission.submit",
];

const CHALLENGE_MANAGER_PERMISSIONS: readonly Permission[] = [
  ...MEMBER_PERMISSIONS,
  "organization.manage_forms",
  "organization.manage_announcements",
  "organization.manage_faqs",
  "challenge.create",
  "challenge.edit",
  "challenge.publish",
  "challenge.change_schedule",
  "challenge.cancel",
  "challenge.archive",
  "challenge.manage_tracks",
  "challenge.manage_prizes",
  "challenge.manage_sponsors",
  "challenge.manage_terms",
  "challenge.manage_participants",
  "challenge.manage_teams",
  "challenge.manage_judges",
  "challenge.manage_rubric",
  "challenge.publish_results",
  "submission.view_all",
  "submission.disqualify",
  "submission.reopen",
  "judging.view_progress",
  "judging.reopen_scorecard",
  "judging.finalize",
  "judging.release_feedback",
  "analytics.view_org",
  "innovation.view",
];

const ORG_ADMIN_PERMISSIONS: readonly Permission[] = [
  ...CHALLENGE_MANAGER_PERMISSIONS,
  "organization.manage_settings",
  "organization.manage_profile",
  "organization.manage_members",
  "organization.manage_roles",
  "organization.manage_invitations",
  "organization.manage_join_codes",
  "organization.review_join_requests",
  "organization.manage_integrations",
  "organization.view_audit",
  "analytics.export_sensitive",
  "innovation.manage",
  "innovation.transition_stage",
];

const ORG_OWNER_PERMISSIONS: readonly Permission[] = [
  ...ORG_ADMIN_PERMISSIONS,
  "organization.transfer_ownership",
  "organization.archive",
];

const ORG_ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  MEMBER: MEMBER_PERMISSIONS,
  CHALLENGE_MANAGER: CHALLENGE_MANAGER_PERMISSIONS,
  ORG_ADMIN: ORG_ADMIN_PERMISSIONS,
  ORG_OWNER: ORG_OWNER_PERMISSIONS,
};

/**
 * Challenge-staff roles (JUDGE/MENTOR) are challenge-scoped grants, not
 * organization membership — a judge invited to one challenge gets none of
 * an organization's internal access.
 */
const CHALLENGE_STAFF_ROLE_PERMISSIONS: Record<"JUDGE" | "MENTOR", readonly Permission[]> = {
  JUDGE: ["judging.view_assigned", "judging.score_assigned"],
  MENTOR: ["mentoring.view_assigned"],
};

/**
 * What an APPROVED challenge participant holds, independent of organization
 * membership (an OPEN_AUTHENTICATED registrant may hold no org role at
 * all). Deliberately not merged into ORG_ROLE_PERMISSIONS — this is a
 * structurally distinct axis on the backend.
 */
const CHALLENGE_PARTICIPANT_PERMISSIONS: readonly Permission[] = [
  "challenge.view",
  "submission.create",
  "submission.edit_own",
  "submission.submit",
];

/**
 * Platform roles. PLATFORM_SUPERADMIN does NOT implicitly gain access to
 * every organization's internal permissions — reaching into a tenant's data
 * is always a separate, explicit `platform.*` action on the backend, never
 * an ambient "see everything" grant. A superadmin with no membership in an
 * organization still has no `organization.*`/`challenge.*` permissions
 * there.
 */
const PLATFORM_ROLE_PERMISSIONS: Record<"PLATFORM_SUPERADMIN" | "PLATFORM_SUPPORT_AGENT", readonly Permission[]> = {
  PLATFORM_SUPERADMIN: [
    "platform.review_applications",
    "platform.manage_organizations",
    "platform.moderate",
    "platform.support",
    "platform.view_audit",
    "platform.manage_feature_flags",
    "platform.manage_roles",
  ],
  PLATFORM_SUPPORT_AGENT: ["platform.support", "platform.moderate"],
};

/**
 * Centrally check whether a user context satisfies a given permission.
 * Note: UX guard only. Authorization is enforced server-side — every
 * permission here has a matching server-side check, and a denial here is
 * purely cosmetic (hide a button) rather than a security boundary.
 */
export function can(
  context: UserContext | OrgRole | string | null | undefined,
  permission: Permission,
  challengeId?: string
): boolean {
  if (!context) return false;

  // Direct role-string pass (e.g. rendering a static role badge's capabilities).
  if (typeof context === "string") {
    const orgPerms = ORG_ROLE_PERMISSIONS[context as OrgRole];
    if (orgPerms) return orgPerms.includes(permission);
    const platformPerms = PLATFORM_ROLE_PERMISSIONS[context as "PLATFORM_SUPERADMIN" | "PLATFORM_SUPPORT_AGENT"];
    return platformPerms ? platformPerms.includes(permission) : false;
  }

  // Platform-role permissions (scoped to platform.* only — see note above).
  const platformPerms = PLATFORM_ROLE_PERMISSIONS[context.globalRole as "PLATFORM_SUPERADMIN" | "PLATFORM_SUPPORT_AGENT"];
  if (platformPerms?.includes(permission)) return true;

  // Organization-role permissions.
  if (context.orgRole && ORG_ROLE_PERMISSIONS[context.orgRole]?.includes(permission)) {
    return true;
  }

  // Challenge-scoped role permissions (JUDGE/MENTOR/PARTICIPANT).
  if (challengeId && context.challengeRoles?.[challengeId]) {
    const role = context.challengeRoles[challengeId];
    if (role === "PARTICIPANT") {
      if (CHALLENGE_PARTICIPANT_PERMISSIONS.includes(permission)) return true;
    } else if (CHALLENGE_STAFF_ROLE_PERMISSIONS[role]?.includes(permission)) {
      return true;
    }
  }

  return false;
}

export type { ChallengeRole };
