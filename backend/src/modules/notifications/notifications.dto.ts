import { t } from 'elysia'
import { PageOf, PaginationQuery, Uuid } from '../../shared/http'

const NotificationCategory = t.Union([
  t.Literal('ORGANIZATION_INVITE'),
  t.Literal('ORGANIZATION_APPLICATION_DECISION'),
  t.Literal('PARTICIPATION_DECISION'),
  t.Literal('TEAM_INVITATION'),
  t.Literal('TEAM_MEMBERSHIP_CHANGE'),
  t.Literal('SUBMISSION_FINALIZED'),
  t.Literal('DEADLINE_CHANGED'),
  t.Literal('DEADLINE_REMINDER'),
  t.Literal('ANNOUNCEMENT'),
  t.Literal('JUDGING_ASSIGNMENT'),
  t.Literal('JUDGING_REMINDER'),
  t.Literal('RESULTS_PUBLISHED'),
  t.Literal('FEEDBACK_RELEASED'),
  t.Literal('SUPPORT_TICKET_UPDATE'),
  t.Literal('MATCHMAKING_INTEREST'),
  t.Literal('PORTFOLIO_UPDATE'),
])

export const NotificationResponse = t.Object({
  id: Uuid,
  organizationId: t.Union([Uuid, t.Null()]),
  category: NotificationCategory,
  title: t.String(),
  body: t.String(),
  linkUrl: t.Union([t.String(), t.Null()]),
  readAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const NotificationListResponse = PageOf(NotificationResponse)
export const NotificationListQuery = t.Composite([
  PaginationQuery,
  t.Object({ unreadOnly: t.Optional(t.Boolean()) }),
])

export const UnreadCountResponse = t.Object({ count: t.Integer() })

export const NotificationPreferenceResponse = t.Object({
  disabledCategories: t.Array(NotificationCategory),
})

export const UpdateNotificationPreferenceBody = t.Object({
  disabledCategories: t.Array(NotificationCategory, { maxItems: 30 }),
})
