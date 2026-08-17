import type { OrganizationRole, PlatformRole } from '../../generated/prisma/enums'
import { Permission } from './permissions'

/**
 * The role → permission matrix.
 *
 * This table IS the authorization policy. Roles are a fixed, closed set:
 * organization-defined role builders are deliberately out of scope for this
 * release, because an organization able to mint roles is an organization able
 * to mint privilege escalation.
 *
 * Documented for operators in docs/permissions-matrix.md, which is generated
 * from this table so the two cannot drift.
 */

/** Permissions every active member holds. */
const MEMBER_PERMISSIONS: readonly Permission[] = [
  Permission.OrganizationViewPrivate,
  Permission.ChallengeView,
  Permission.SubmissionCreate,
  Permission.SubmissionEditOwn,
  Permission.SubmissionSubmit,
]

/**
 * A challenge manager runs challenges but does not govern the organization:
 * no member management, no role changes, no integrations, no audit access.
 */
const CHALLENGE_MANAGER_PERMISSIONS: readonly Permission[] = [
  ...MEMBER_PERMISSIONS,
  Permission.OrganizationManageForms,
  Permission.OrganizationManageAnnouncements,
  Permission.OrganizationManageFaqs,
  Permission.ChallengeCreate,
  Permission.ChallengeEdit,
  Permission.ChallengePublish,
  Permission.ChallengeChangeSchedule,
  Permission.ChallengeCancel,
  Permission.ChallengeArchive,
  Permission.ChallengeManageTracks,
  Permission.ChallengeManagePrizes,
  Permission.ChallengeManageSponsors,
  Permission.ChallengeManageTerms,
  Permission.ChallengeManageParticipants,
  Permission.ChallengeManageTeams,
  Permission.ChallengeManageJudges,
  Permission.ChallengeManageRubric,
  Permission.ChallengePublishResults,
  Permission.SubmissionViewAll,
  Permission.SubmissionDisqualify,
  Permission.SubmissionReopen,
  Permission.JudgingViewProgress,
  Permission.JudgingReopenScorecard,
  Permission.JudgingFinalize,
  Permission.JudgingReleaseFeedback,
  Permission.AnalyticsViewOrg,
  Permission.InnovationView,
]

/**
 * An organization admin governs the organization but cannot transfer ownership
 * or archive it — those remain owner-only, because they are irreversible or
 * change who ultimately controls the tenant.
 */
const ORG_ADMIN_PERMISSIONS: readonly Permission[] = [
  ...CHALLENGE_MANAGER_PERMISSIONS,
  Permission.OrganizationManageSettings,
  Permission.OrganizationManageProfile,
  Permission.OrganizationManageMembers,
  Permission.OrganizationManageRoles,
  Permission.OrganizationManageInvitations,
  Permission.OrganizationManageJoinCodes,
  Permission.OrganizationReviewJoinRequests,
  Permission.OrganizationManageIntegrations,
  Permission.OrganizationViewAudit,
  Permission.AnalyticsExportSensitive,
  Permission.InnovationManage,
  Permission.InnovationTransitionStage,
]

const ORG_OWNER_PERMISSIONS: readonly Permission[] = [
  ...ORG_ADMIN_PERMISSIONS,
  Permission.OrganizationTransferOwnership,
  Permission.OrganizationArchive,
]

export const ORGANIZATION_ROLE_PERMISSIONS: Readonly<
  Record<OrganizationRole, readonly Permission[]>
> = {
  ORG_OWNER: ORG_OWNER_PERMISSIONS,
  ORG_ADMIN: ORG_ADMIN_PERMISSIONS,
  CHALLENGE_MANAGER: CHALLENGE_MANAGER_PERMISSIONS,
  MEMBER: MEMBER_PERMISSIONS,
}

/**
 * Challenge-scoped roles.
 *
 * A judge or mentor is invited to ONE challenge and is deliberately not given
 * organization membership: an external judge from a sponsor company must be
 * able to score submissions without gaining access to the member directory,
 * other challenges, analytics, or the audit log (master prompt section 17.2).
 *
 * These permissions are additionally constrained by assignment: holding
 * `judging.score_assigned` permits scoring the submissions assigned to that
 * judge, and nothing else.
 */
export type ChallengeStaffRole = 'JUDGE' | 'MENTOR'

export const CHALLENGE_STAFF_ROLE_PERMISSIONS: Readonly<
  Record<ChallengeStaffRole, readonly Permission[]>
> = {
  JUDGE: [Permission.JudgingViewAssigned, Permission.JudgingScoreAssigned],
  MENTOR: [Permission.MentoringViewAssigned],
}

/**
 * What an APPROVED challenge participant holds, independent of organization
 * membership (master prompt section 12: "organization membership and
 * challenge participation are distinct"). This is what makes an
 * OPEN_AUTHENTICATED registrant — who by definition holds no organization
 * role — able to view the challenge and manage their own team/submission,
 * without granting anything about the organization itself.
 */
export const CHALLENGE_PARTICIPANT_PERMISSIONS: readonly Permission[] = [
  Permission.ChallengeView,
  Permission.SubmissionCreate,
  Permission.SubmissionEditOwn,
  Permission.SubmissionSubmit,
]

/**
 * Platform roles.
 *
 * A platform superadmin is NOT an ordinary organization member. Reaching into
 * a tenant's private data requires an explicit platform route, a stated
 * purpose, and an audit record — there is no ambient "see everything" grant.
 */
export const PLATFORM_ROLE_PERMISSIONS: Readonly<Record<PlatformRole, readonly Permission[]>> = {
  PLATFORM_SUPERADMIN: [
    Permission.PlatformReviewApplications,
    Permission.PlatformManageOrganizations,
    Permission.PlatformModerate,
    Permission.PlatformSupport,
    Permission.PlatformViewAudit,
    Permission.PlatformManageFeatureFlags,
    Permission.PlatformManageRoles,
  ],
  PLATFORM_SUPPORT_AGENT: [Permission.PlatformSupport, Permission.PlatformModerate],
}

/** Ranking used for "at least this role" comparisons and last-owner checks. */
const ORGANIZATION_ROLE_RANK: Readonly<Record<OrganizationRole, number>> = {
  MEMBER: 1,
  CHALLENGE_MANAGER: 2,
  ORG_ADMIN: 3,
  ORG_OWNER: 4,
}

export function organizationRoleRank(role: OrganizationRole): number {
  return ORGANIZATION_ROLE_RANK[role]
}

/**
 * Whether `actorRole` may assign `targetRole`.
 *
 * A role holder may never grant a role above their own — otherwise an admin
 * could promote themselves to owner via a second account. Only an owner may
 * create another owner.
 */
export function canAssignRole(actorRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  return organizationRoleRank(actorRole) >= organizationRoleRank(targetRole)
}

export function organizationRoleHas(role: OrganizationRole, permission: Permission): boolean {
  return ORGANIZATION_ROLE_PERMISSIONS[role].includes(permission)
}

export function platformRoleHas(role: PlatformRole, permission: Permission): boolean {
  return PLATFORM_ROLE_PERMISSIONS[role].includes(permission)
}

export function challengeStaffRoleHas(role: ChallengeStaffRole, permission: Permission): boolean {
  return CHALLENGE_STAFF_ROLE_PERMISSIONS[role].includes(permission)
}

export function challengeParticipantHas(permission: Permission): boolean {
  return CHALLENGE_PARTICIPANT_PERMISSIONS.includes(permission)
}
