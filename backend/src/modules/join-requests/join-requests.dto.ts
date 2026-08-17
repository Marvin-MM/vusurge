import { t } from 'elysia'
import { ActionReason, PageOf, PaginationQuery, Uuid } from '../../shared/http'

export const JoinRequestStatusSchema = t.Union([
  t.Literal('PENDING'),
  t.Literal('APPROVED'),
  t.Literal('REJECTED'),
  t.Literal('WITHDRAWN'),
])

export const CreateJoinRequestBody = t.Object({
  message: t.Optional(t.String({ maxLength: 2000 })),
})

export const JoinRequestResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  userId: Uuid,
  status: JoinRequestStatusSchema,
  message: t.Union([t.String(), t.Null()]),
  reviewedAt: t.Union([t.String(), t.Null()]),
  decisionReason: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const JoinRequestListResponse = PageOf(JoinRequestResponse)
export const JoinRequestListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(JoinRequestStatusSchema) }),
])

export const RejectJoinRequestBody = t.Object({
  reason: ActionReason,
  internalNotes: t.Optional(t.String({ maxLength: 4000 })),
})
