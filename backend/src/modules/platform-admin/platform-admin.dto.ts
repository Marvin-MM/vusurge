import { t } from 'elysia'
import { ActionReason, PageOf, PaginationQuery, Uuid } from '../../shared/http'

const OrganizationStatus = t.Union([
  t.Literal('ACTIVE'),
  t.Literal('SUSPENDED'),
  t.Literal('ARCHIVED'),
])

export const PlatformOrganizationResponse = t.Object({
  id: Uuid,
  slug: t.String(),
  name: t.String(),
  organizationType: t.String(),
  status: OrganizationStatus,
  visibility: t.Union([t.Literal('PRIVATE'), t.Literal('PUBLIC')]),
  createdAt: t.String(),
})

export const PlatformOrganizationListResponse = PageOf(PlatformOrganizationResponse)
export const PlatformOrganizationListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(OrganizationStatus) }),
])

export const SuspendOrganizationBody = t.Object({ reason: ActionReason })
export const ReinstateOrganizationBody = t.Object({ reason: ActionReason })
export const PlatformArchiveOrganizationBody = t.Object({ reason: ActionReason })

export const AuditSummaryResponse = t.Object({
  totalEvents: t.Integer(),
  firstEventAt: t.Union([t.String(), t.Null()]),
  lastEventAt: t.Union([t.String(), t.Null()]),
  topActions: t.Array(t.Object({ action: t.String(), count: t.Integer() })),
})

export const PlatformRole = t.Union([
  t.Literal('PLATFORM_SUPERADMIN'),
  t.Literal('PLATFORM_SUPPORT_AGENT'),
])

export const PlatformUserResponse = t.Object({
  id: Uuid,
  name: t.String(),
  email: t.String(),
  emailVerified: t.Boolean(),
  twoFactorEnabled: t.Boolean(),
  deletedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  platformRoles: t.Array(t.Object({ id: Uuid, role: PlatformRole, grantedAt: t.String() })),
})

export const PlatformUserListResponse = PageOf(PlatformUserResponse)
export const PlatformUserListQuery = t.Composite([
  PaginationQuery,
  t.Object({
    search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
    role: t.Optional(PlatformRole),
  }),
])

export const PlatformRoleChangeBody = t.Object({
  role: PlatformRole,
  reason: ActionReason,
})

export const ChallengeStatus = t.Union([
  t.Literal('DRAFT'),
  t.Literal('SCHEDULED'),
  t.Literal('OPEN'),
  t.Literal('CLOSED'),
  t.Literal('JUDGING'),
  t.Literal('RESULTS_READY'),
  t.Literal('RESULTS_PUBLISHED'),
  t.Literal('ARCHIVED'),
  t.Literal('CANCELLED'),
])

export const ChallengeVisibility = t.Union([
  t.Literal('ORG_MEMBERS'),
  t.Literal('PUBLIC'),
  t.Literal('UNLISTED'),
])

export const PlatformChallengeResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  organizationName: t.String(),
  organizationSlug: t.String(),
  title: t.String(),
  slug: t.String(),
  status: ChallengeStatus,
  visibility: ChallengeVisibility,
  moderationHiddenAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const PlatformChallengeListResponse = PageOf(PlatformChallengeResponse)
export const PlatformChallengeListQuery = t.Composite([
  PaginationQuery,
  t.Object({
    search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
    status: t.Optional(ChallengeStatus),
    visibility: t.Optional(ChallengeVisibility),
  }),
])

export const PlatformAnalyticsSummaryResponse = t.Object({
  users: t.Integer({ minimum: 0 }),
  verifiedUsers: t.Integer({ minimum: 0 }),
  usersWithTwoFactor: t.Integer({ minimum: 0 }),
  activeOrganizations: t.Integer({ minimum: 0 }),
  suspendedOrganizations: t.Integer({ minimum: 0 }),
  challenges: t.Integer({ minimum: 0 }),
  publicChallenges: t.Integer({ minimum: 0 }),
  activeParticipations: t.Integer({ minimum: 0 }),
  finalizedSubmissions: t.Integer({ minimum: 0 }),
  openReports: t.Integer({ minimum: 0 }),
  openSupportTickets: t.Integer({ minimum: 0 }),
  generatedAt: t.String(),
})

export const PlatformSettingsResponse = t.Object({
  environment: t.String(),
  serviceVersion: t.String(),
  featureFlags: t.Record(t.String(), t.Boolean()),
  security: t.Object({
    sessionExpiresInSeconds: t.Integer(),
    freshSessionMaxAgeSeconds: t.Integer(),
    rateLimitingEnabled: t.Boolean(),
    failClosedOnHighRisk: t.Boolean(),
    accountDeletionGraceDays: t.Integer(),
  }),
  limits: t.Object({
    maxRequestBodyBytes: t.Integer(),
    maxImageBytes: t.Integer(),
    maxDocumentBytes: t.Integer(),
    maxSubmissionScreenshots: t.Integer(),
  }),
})
