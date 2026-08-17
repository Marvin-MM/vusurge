import { t } from 'elysia'
import { ActionReason, PageOf, PaginationQuery, Uuid } from '../../shared/http'

export const ContentReportTargetType = t.Union([t.Literal('ORGANIZATION'), t.Literal('CHALLENGE')])

export const ContentReportCategory = t.Union([
  t.Literal('SPAM'),
  t.Literal('ABUSE'),
  t.Literal('INAPPROPRIATE_CONTENT'),
  t.Literal('INTELLECTUAL_PROPERTY'),
  t.Literal('SAFETY_CONCERN'),
  t.Literal('OTHER'),
])

export const ContentReportStatus = t.Union([
  t.Literal('OPEN'),
  t.Literal('UNDER_REVIEW'),
  t.Literal('DISMISSED'),
  t.Literal('ACTION_TAKEN'),
])

export const CreateReportBody = t.Object({
  targetType: ContentReportTargetType,
  targetId: Uuid,
  category: ContentReportCategory,
  description: t.String({ minLength: 10, maxLength: 2000 }),
})

export const ModerationActionBody = t.Object({
  reason: ActionReason,
})

export const PlatformReportListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(ContentReportStatus) }),
])

export const ContentReportResponse = t.Object({
  id: Uuid,
  reporterUserId: Uuid,
  targetType: ContentReportTargetType,
  targetId: Uuid,
  targetOrganizationId: t.Union([Uuid, t.Null()]),
  category: ContentReportCategory,
  description: t.String(),
  status: ContentReportStatus,
  reviewedByUserId: t.Union([Uuid, t.Null()]),
  reviewedAt: t.Union([t.String(), t.Null()]),
  resolutionReason: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const ContentReportListResponse = PageOf(ContentReportResponse)
