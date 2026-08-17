import { t } from 'elysia'
import {
  ActionReason,
  HttpsUrl,
  MarkdownText,
  PageOf,
  PaginationQuery,
  Slug,
  Timestamp,
  TimeZone,
  Uuid,
} from '../../shared/http'

const ChallengeVisibility = t.Union([
  t.Literal('ORG_MEMBERS'),
  t.Literal('PUBLIC'),
  t.Literal('UNLISTED'),
])
const ParticipationPolicy = t.Union([
  t.Literal('ORG_MEMBERS_ONLY'),
  t.Literal('APPROVED_CHALLENGE_PARTICIPANTS'),
  t.Literal('OPEN_AUTHENTICATED'),
])
const ChallengeStatus = t.Union([
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

export const CreateChallengeBody = t.Object({
  title: t.String({ minLength: 2, maxLength: 200 }),
  slug: Slug,
  summary: t.Optional(t.String({ maxLength: 500 })),
  description: t.Optional(MarkdownText(20_000)),
  visibility: t.Optional(ChallengeVisibility),
  displayTimeZone: t.Optional(TimeZone),
  minTeamSize: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  maxTeamSize: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  soloParticipationAllowed: t.Optional(t.Boolean()),
  screeningRequired: t.Optional(t.Boolean()),
  participationPolicy: t.Optional(ParticipationPolicy),
  submissionRequirements: t.Optional(t.String({ maxLength: 10_000 })),
  publicProjectPublicationEnabled: t.Optional(t.Boolean()),
  blindJudgingEnabled: t.Optional(t.Boolean()),
})

export const UpdateChallengeBody = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
  summary: t.Optional(t.String({ maxLength: 500 })),
  description: t.Optional(MarkdownText(20_000)),
  coverAssetId: t.Optional(t.Union([Uuid, t.Null()])),
  visibility: t.Optional(ChallengeVisibility),
  displayTimeZone: t.Optional(TimeZone),
  minTeamSize: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  maxTeamSize: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  soloParticipationAllowed: t.Optional(t.Boolean()),
  screeningRequired: t.Optional(t.Boolean()),
  participationPolicy: t.Optional(ParticipationPolicy),
  submissionRequirements: t.Optional(t.String({ maxLength: 10_000 })),
  publicProjectPublicationEnabled: t.Optional(t.Boolean()),
  blindJudgingEnabled: t.Optional(t.Boolean()),
})

export const ChallengeResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  title: t.String(),
  slug: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  description: t.Union([t.String(), t.Null()]),
  coverAssetId: t.Union([Uuid, t.Null()]),
  visibility: ChallengeVisibility,
  status: ChallengeStatus,
  publishedAt: t.Union([t.String(), t.Null()]),
  registrationOpenAt: t.Union([t.String(), t.Null()]),
  registrationCloseAt: t.Union([t.String(), t.Null()]),
  submissionOpenAt: t.Union([t.String(), t.Null()]),
  submissionDeadline: t.Union([t.String(), t.Null()]),
  judgingStartAt: t.Union([t.String(), t.Null()]),
  judgingEndAt: t.Union([t.String(), t.Null()]),
  resultsPublishedAt: t.Union([t.String(), t.Null()]),
  displayTimeZone: t.String(),
  minTeamSize: t.Integer(),
  maxTeamSize: t.Integer(),
  soloParticipationAllowed: t.Boolean(),
  screeningRequired: t.Boolean(),
  participationPolicy: ParticipationPolicy,
  submissionRequirements: t.Union([t.String(), t.Null()]),
  publicProjectPublicationEnabled: t.Boolean(),
  blindJudgingEnabled: t.Boolean(),
  createdAt: t.String(),
})

export const ChallengeListResponse = PageOf(ChallengeResponse)
export const ChallengeListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(ChallengeStatus) }),
])

export const PublishChallengeBody = t.Object({})

export const RescheduleChallengeBody = t.Object({
  registrationOpenAt: t.Optional(Timestamp),
  registrationCloseAt: t.Optional(Timestamp),
  submissionOpenAt: t.Optional(Timestamp),
  submissionDeadline: t.Optional(Timestamp),
  judgingStartAt: t.Optional(Timestamp),
  judgingEndAt: t.Optional(Timestamp),
  reason: ActionReason,
})

export const ExtendDeadlineBody = t.Object({
  newDeadline: Timestamp,
  reason: ActionReason,
})

export const ReopenChallengeBody = t.Object({
  newDeadline: Timestamp,
  reason: ActionReason,
})

export const CancelChallengeBody = t.Object({ reason: ActionReason })
export const ArchiveChallengeBody = t.Object({ reason: ActionReason })

// --- tracks ------------------------------------------------------------------

export const CreateTrackBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
})

export const UpdateTrackBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 120 })),
  description: t.Optional(t.String({ maxLength: 2000 })),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
})

export const TrackResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  archivedAt: t.Union([t.String(), t.Null()]),
  displayOrder: t.Integer(),
  createdAt: t.String(),
})

export const TrackListResponse = t.Array(TrackResponse)

// --- prizes --------------------------------------------------------------------

export const CreatePrizeBody = t.Object({
  title: t.String({ minLength: 2, maxLength: 120 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  valueLabel: t.Optional(t.String({ maxLength: 120 })),
  trackId: t.Optional(Uuid),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
})

export const UpdatePrizeBody = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 120 })),
  description: t.Optional(t.String({ maxLength: 2000 })),
  valueLabel: t.Optional(t.String({ maxLength: 120 })),
  trackId: t.Optional(t.Union([Uuid, t.Null()])),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
})

export const PrizeResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  title: t.String(),
  description: t.Union([t.String(), t.Null()]),
  valueLabel: t.Union([t.String(), t.Null()]),
  trackId: t.Union([Uuid, t.Null()]),
  displayOrder: t.Integer(),
  createdAt: t.String(),
})

export const PrizeListResponse = t.Array(PrizeResponse)

// --- sponsors ------------------------------------------------------------------

export const CreateSponsorBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  websiteUrl: t.Optional(HttpsUrl),
  tier: t.Optional(t.String({ maxLength: 60 })),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
})

export const UpdateSponsorBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 120 })),
  websiteUrl: t.Optional(t.Union([HttpsUrl, t.Null()])),
  logoAssetId: t.Optional(t.Union([Uuid, t.Null()])),
  tier: t.Optional(t.Union([t.String({ maxLength: 60 }), t.Null()])),
  displayOrder: t.Optional(t.Integer({ minimum: 0 })),
})

export const SponsorResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  name: t.String(),
  websiteUrl: t.Union([t.String(), t.Null()]),
  logoAssetId: t.Union([Uuid, t.Null()]),
  tier: t.Union([t.String(), t.Null()]),
  displayOrder: t.Integer(),
  createdAt: t.String(),
})

export const SponsorListResponse = t.Array(SponsorResponse)

// --- terms versions --------------------------------------------------------------

export const CreateTermsVersionBody = t.Object({
  content: MarkdownText(20_000),
})

export const TermsVersionResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  version: t.Integer(),
  content: t.String(),
  isActive: t.Boolean(),
  activatedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const TermsVersionListResponse = t.Array(TermsVersionResponse)

export const AcceptTermsResponse = t.Object({
  termsVersionId: Uuid,
  acceptedAt: t.String(),
})
