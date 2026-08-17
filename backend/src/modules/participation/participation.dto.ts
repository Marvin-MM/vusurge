import { t } from 'elysia'
import {
  ActionReason,
  OptionalActionReason,
  PageOf,
  PaginationQuery,
  Uuid,
} from '../../shared/http'

const ParticipationStatus = t.Union([
  t.Literal('PENDING'),
  t.Literal('APPROVED'),
  t.Literal('REJECTED'),
  t.Literal('WITHDRAWN'),
  t.Literal('DISQUALIFIED'),
])

export const RegisterBody = t.Object({
  acceptTermsVersionId: t.Optional(Uuid),
  formResponseId: t.Optional(Uuid),
})

export const SubmitApplicationBody = t.Object({
  acceptTermsVersionId: t.Optional(Uuid),
  responseData: t.Record(t.String(), t.Unknown()),
})

export const SaveApplicationBody = t.Object({
  responseData: t.Record(t.String({ maxLength: 120 }), t.Unknown()),
})

export const ParticipationApplicationDraftResponse = t.Object({
  id: Uuid,
  formVersionId: Uuid,
  responseData: t.Record(t.String(), t.Unknown()),
  updatedAt: t.String(),
})

/** The participant's own view: never includes organizer-only internal notes. */
export const ParticipationSelfResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  status: ParticipationStatus,
  termsVersionId: t.Union([Uuid, t.Null()]),
  acceptedTermsAt: t.Union([t.String(), t.Null()]),
  appliedAt: t.String(),
  decidedAt: t.Union([t.String(), t.Null()]),
  decisionReason: t.Union([t.String(), t.Null()]),
  withdrawnAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

/** The organizer's view: includes the user identity and internal notes. */
export const ParticipationOrganizerResponse = t.Composite([
  ParticipationSelfResponse,
  t.Object({
    userId: Uuid,
    decidedByUserId: t.Union([Uuid, t.Null()]),
    internalNotes: t.Union([t.String(), t.Null()]),
  }),
])

export const ParticipationListResponse = PageOf(ParticipationOrganizerResponse)
export const ParticipationListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(ParticipationStatus) }),
])

export const ApproveParticipationBody = t.Object({ reason: OptionalActionReason })
export const RejectParticipationBody = t.Object({
  reason: ActionReason,
  internalNotes: t.Optional(t.String({ maxLength: 4000 })),
})
export const DisqualifyParticipationBody = t.Object({ reason: ActionReason })
export const ReinstateParticipationBody = t.Object({ reason: ActionReason })
