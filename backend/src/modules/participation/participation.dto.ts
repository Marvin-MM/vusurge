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

/** Mirrors forms.dto.ts's field-definition shape (see forms.service.ts's
 * FIELD_TYPES) without importing across module boundaries — kept as
 * `t.Unknown()` per field the same way CreateFormVersionBody does, since the
 * authoritative shape validation already happened when the version was
 * created. */
export const ApplicationFormResponse = t.Union([
  t.Object({ formDefinitionId: Uuid, fields: t.Array(t.Unknown()) }),
  t.Null(),
])

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

/**
 * The roster projection adds the applicant's identity, which an organizer
 * needs in order to review an application. Only on the list route, which is
 * gated on challenge.manage_participants — the single-record organizer
 * responses keep the narrower shape.
 */
export const ParticipationRosterResponse = t.Composite([
  ParticipationOrganizerResponse,
  t.Object({
    displayName: t.Union([t.String(), t.Null()]),
    email: t.String(),
  }),
])

export const ParticipationListResponse = PageOf(ParticipationRosterResponse)
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
