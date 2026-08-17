import { t } from 'elysia'
import { MarkdownText, PageOf, PaginationQuery, Uuid } from '../../shared/http'

export const SupportTicketCategory = t.Union([
  t.Literal('BUG'),
  t.Literal('ACCESS_OR_ACCOUNT'),
  t.Literal('ORGANIZATION_ISSUE'),
  t.Literal('CHALLENGE_ISSUE'),
  t.Literal('ABUSE_OR_SAFETY'),
  t.Literal('FEATURE_REQUEST'),
  t.Literal('OTHER'),
])

export const SupportTicketStatus = t.Union([
  t.Literal('OPEN'),
  t.Literal('TRIAGED'),
  t.Literal('IN_PROGRESS'),
  t.Literal('WAITING_USER'),
  t.Literal('RESOLVED'),
  t.Literal('CLOSED'),
])

export const SupportTicketPriority = t.Union([
  t.Literal('LOW'),
  t.Literal('NORMAL'),
  t.Literal('HIGH'),
  t.Literal('URGENT'),
])

export const CreateTicketBody = t.Object({
  organizationId: t.Optional(Uuid),
  challengeId: t.Optional(Uuid),
  category: SupportTicketCategory,
  subject: t.String({ minLength: 3, maxLength: 200 }),
  description: MarkdownText(10_000),
})

export const AddCommentBody = t.Object({
  body: MarkdownText(4000),
})

export const AssignTicketBody = t.Object({
  assignedToUserId: t.Union([Uuid, t.Null()]),
})

export const ChangeStatusBody = t.Object({
  status: SupportTicketStatus,
})

export const SetPriorityBody = t.Object({
  priority: SupportTicketPriority,
})

export const ResolveTicketBody = t.Object({
  resolutionSummary: t.String({ minLength: 3, maxLength: 2000 }),
})

export const PlatformTicketListQuery = t.Composite([
  PaginationQuery,
  t.Object({
    status: t.Optional(SupportTicketStatus),
    priority: t.Optional(SupportTicketPriority),
    assignedToUserId: t.Optional(Uuid),
  }),
])

export const SupportTicketResponse = t.Object({
  id: Uuid,
  userId: Uuid,
  organizationId: t.Union([Uuid, t.Null()]),
  challengeId: t.Union([Uuid, t.Null()]),
  category: SupportTicketCategory,
  subject: t.String(),
  description: t.String(),
  priority: SupportTicketPriority,
  status: SupportTicketStatus,
  assignedToUserId: t.Union([Uuid, t.Null()]),
  resolutionSummary: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
})

export const SupportTicketNoteResponse = t.Object({
  id: Uuid,
  ticketId: Uuid,
  authorUserId: Uuid,
  body: t.String(),
  createdAt: t.String(),
})

export const SupportTicketListResponse = PageOf(SupportTicketResponse)

export const SupportTicketDetailResponse = t.Object({
  ticket: SupportTicketResponse,
  comments: t.Array(SupportTicketNoteResponse),
})

export const PlatformSupportTicketDetailResponse = t.Object({
  ticket: SupportTicketResponse,
  comments: t.Array(SupportTicketNoteResponse),
  internalNotes: t.Array(SupportTicketNoteResponse),
})
