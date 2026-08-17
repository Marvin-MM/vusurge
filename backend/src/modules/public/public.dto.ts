import { t } from 'elysia'
import { PageOf, PaginationQuery, Slug } from '../../shared/http'

/**
 * Public-surface contracts. Every field here is safe for an unauthenticated,
 * unrelated caller to see — no private fields, no counts derived from private
 * data (master prompt section 34.3).
 */

export const PublicOrganizationResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  slug: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  organizationType: t.String(),
  websiteUrl: t.Union([t.String(), t.Null()]),
  country: t.Union([t.String(), t.Null()]),
  region: t.Union([t.String(), t.Null()]),
  logoAssetId: t.Union([t.String({ format: 'uuid' }), t.Null()]),
  createdAt: t.String(),
})

export const PublicOrganizationListResponse = PageOf(PublicOrganizationResponse)

export const PublicOrganizationListQuery = t.Composite([
  PaginationQuery,
  t.Object({ q: t.Optional(t.String({ maxLength: 100 })) }),
])

export const OrgSlugParam = t.Object({ orgSlug: Slug })

export const PublicChallengeResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  organizationSlug: t.String(),
  organizationName: t.String(),
  slug: t.String(),
  title: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  description: t.Union([t.String(), t.Null()]),
  coverAssetId: t.Union([t.String({ format: 'uuid' }), t.Null()]),
  status: t.String(),
  publishedAt: t.String(),
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
  participationPolicy: t.String(),
  createdAt: t.String(),
})

export const PublicChallengeListResponse = PageOf(PublicChallengeResponse)

export const PublicChallengeListQuery = t.Composite([
  PaginationQuery,
  t.Object({ q: t.Optional(t.String({ maxLength: 100 })) }),
])

export const OrgChallengeSlugParams = t.Object({ orgSlug: Slug, challengeSlug: Slug })

export const PublicInnovationResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  organizationSlug: t.String(),
  organizationName: t.String(),
  title: t.String(),
  opportunityStatement: t.Union([t.String(), t.Null()]),
  thesis: t.Union([t.String(), t.Null()]),
  expectedImpact: t.Union([t.String(), t.Null()]),
  beneficiaries: t.Union([t.String(), t.Null()]),
  strategicThemes: t.Array(t.String()),
  stage: t.String(),
  createdAt: t.String(),
})

export const PublicInnovationListResponse = PageOf(PublicInnovationResponse)

export const PublicChallengeTrackResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  challengeId: t.String({ format: 'uuid' }),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  archivedAt: t.Union([t.String(), t.Null()]),
})

export const PublicChallengeTrackListResponse = t.Array(PublicChallengeTrackResponse)

export const PublicAnnouncementResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  challengeId: t.String({ format: 'uuid' }),
  title: t.String(),
  body: t.String(),
  priority: t.String(),
  publishedAt: t.Union([t.String(), t.Null()]),
})

export const PublicAnnouncementListResponse = t.Array(PublicAnnouncementResponse)

export const PublicFaqResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  challengeId: t.String({ format: 'uuid' }),
  question: t.String(),
  answer: t.String(),
})

export const PublicFaqListResponse = t.Array(PublicFaqResponse)

export const PublicSubmissionResultResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  challengeId: t.String({ format: 'uuid' }),
  submissionId: t.String({ format: 'uuid' }),
  trackId: t.Union([t.String({ format: 'uuid' }), t.Null()]),
  rankLabel: t.Union([t.String(), t.Null()]),
  rank: t.Union([t.Integer(), t.Null()]),
  aggregateScore: t.Union([t.Integer(), t.Null()]),
})

export const PublicSubmissionResultListResponse = t.Array(PublicSubmissionResultResponse)

export const PublicProjectResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  organizationSlug: t.String(),
  organizationName: t.String(),
  challengeSlug: t.String(),
  challengeTitle: t.String(),
  teamName: t.String(),
  title: t.Union([t.String(), t.Null()]),
  tagline: t.Union([t.String(), t.Null()]),
  solutionDescription: t.Union([t.String(), t.Null()]),
  impactBeneficiaries: t.Union([t.String(), t.Null()]),
  technologyTags: t.Array(t.String()),
  repositoryUrl: t.Union([t.String(), t.Null()]),
  demoUrl: t.Union([t.String(), t.Null()]),
  pitchVideoUrl: t.Union([t.String(), t.Null()]),
  presentationUrl: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const PublicProjectListResponse = PageOf(PublicProjectResponse)
