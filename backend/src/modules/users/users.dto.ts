import { t } from 'elysia'
import { HttpsUrl, MarkdownText, Uuid } from '../../shared/http'

/**
 * Current-user and public-profile contracts.
 *
 * `MeResponse` never includes the account email by default beyond the
 * caller's own record, auth provider secrets/tokens, private memberships, or
 * demographic data (master prompt section 13, 51).
 */

const ProfileVisibility = t.Union([
  t.Literal('PUBLIC'),
  t.Literal('ORGANIZATION_MEMBERS'),
  t.Literal('PRIVATE'),
])

export const SkillSummary = t.Object({
  id: t.Union([Uuid, t.Null()]),
  name: t.String(),
  isCustom: t.Boolean(),
})

const PlatformRoleSummary = t.Union([
  t.Literal('PLATFORM_SUPERADMIN'),
  t.Literal('PLATFORM_SUPPORT_AGENT'),
  t.Null(),
])

export const MeResponse = t.Object({
  id: Uuid,
  email: t.String(),
  emailVerified: t.Boolean(),
  /** The caller's own active platform role, if any. Most users have none. */
  platformRole: PlatformRoleSummary,
  displayName: t.Union([t.String(), t.Null()]),
  bio: t.Union([t.String(), t.Null()]),
  location: t.Union([t.String(), t.Null()]),
  avatarAssetId: t.Union([Uuid, t.Null()]),
  githubUrl: t.Union([t.String(), t.Null()]),
  linkedinUrl: t.Union([t.String(), t.Null()]),
  portfolioUrl: t.Union([t.String(), t.Null()]),
  discordHandle: t.Union([t.String(), t.Null()]),
  visibility: ProfileVisibility,
  twoFactorEnabled: t.Boolean(),
  skills: t.Array(SkillSummary),
})

export const UpdateProfileBody = t.Object({
  displayName: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  bio: t.Optional(MarkdownText(2000)),
  location: t.Optional(t.String({ maxLength: 120 })),
  avatarAssetId: t.Optional(t.Union([Uuid, t.Null()])),
  githubUrl: t.Optional(t.Union([HttpsUrl, t.Null()])),
  linkedinUrl: t.Optional(t.Union([HttpsUrl, t.Null()])),
  portfolioUrl: t.Optional(t.Union([HttpsUrl, t.Null()])),
  discordHandle: t.Optional(t.Union([t.String({ maxLength: 64 }), t.Null()])),
  visibility: t.Optional(ProfileVisibility),
})

export const UpdateSkillsBody = t.Object({
  /** Catalogue skill IDs the user claims. */
  skillIds: t.Array(Uuid, { maxItems: 50 }),
  /** Controlled free-text skills not yet in the catalogue. */
  customNames: t.Array(t.String({ minLength: 1, maxLength: 80 }), { maxItems: 20 }),
})

export const OrganizationMembershipSummary = t.Object({
  organizationId: Uuid,
  organizationSlug: t.String(),
  organizationName: t.String(),
  role: t.Union([
    t.Literal('ORG_OWNER'),
    t.Literal('ORG_ADMIN'),
    t.Literal('CHALLENGE_MANAGER'),
    t.Literal('MEMBER'),
  ]),
  joinedAt: t.String(),
})

export const MyOrganizationsResponse = t.Array(OrganizationMembershipSummary)

export const MyChallengeParticipationResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  organizationSlug: t.String(),
  challengeId: Uuid,
  challengeTitle: t.String(),
  status: t.Union([
    t.Literal('PENDING'),
    t.Literal('APPROVED'),
    t.Literal('REJECTED'),
    t.Literal('WITHDRAWN'),
    t.Literal('DISQUALIFIED'),
  ]),
  appliedAt: t.String(),
})

export const MyChallengeParticipationListResponse = t.Array(MyChallengeParticipationResponse)

const InvitationStatus = t.Union([
  t.Literal('PENDING'),
  t.Literal('ACCEPTED'),
  t.Literal('DECLINED'),
  t.Literal('REVOKED'),
  t.Literal('EXPIRED'),
])

export const MyTeamInvitationResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  organizationSlug: t.String(),
  challengeId: Uuid,
  teamId: Uuid,
  teamName: t.String(),
  status: InvitationStatus,
  expiresAt: t.String(),
  createdAt: t.String(),
})

export const MyTeamInvitationListResponse = t.Array(MyTeamInvitationResponse)

export const MyChallengeStaffInvitationResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  organizationSlug: t.String(),
  challengeId: Uuid,
  challengeTitle: t.String(),
  role: t.String(),
  status: InvitationStatus,
  expiresAt: t.String(),
  createdAt: t.String(),
})

export const MyChallengeStaffInvitationListResponse = t.Array(MyChallengeStaffInvitationResponse)

/** Safe projection served regardless of viewer, respecting visibility rules. */
export const PublicProfileResponse = t.Object({
  id: Uuid,
  displayName: t.String(),
  bio: t.Union([t.String(), t.Null()]),
  location: t.Union([t.String(), t.Null()]),
  avatarAssetId: t.Union([Uuid, t.Null()]),
  githubUrl: t.Union([t.String(), t.Null()]),
  linkedinUrl: t.Union([t.String(), t.Null()]),
  portfolioUrl: t.Union([t.String(), t.Null()]),
  skills: t.Array(SkillSummary),
})

export const AccountDeletionRequestResponse = t.Object({
  id: Uuid,
  status: t.Union([t.Literal('PENDING'), t.Literal('CANCELLED'), t.Literal('COMPLETED')]),
  requestedAt: t.String(),
  eligibleAt: t.String(),
})

export const AccountDeletionRequestStatusResponse = t.Object({
  request: t.Union([AccountDeletionRequestResponse, t.Null()]),
})

export const CreateAccountDeletionRequestBody = t.Object({
  reason: t.Optional(t.String({ maxLength: 1000 })),
})
