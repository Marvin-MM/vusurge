import { t } from 'elysia'
import { Uuid } from '../../shared/http'

export const TechnologyTagCountResponse = t.Object({
  tag: t.String(),
  count: t.Integer(),
})

export const AnalyticsOverviewResponse = t.Object({
  members: t.Integer(),
  registrations: t.Integer(),
  approvedParticipants: t.Integer(),
  activeTeams: t.Integer(),
  submissionsStarted: t.Integer(),
  finalSubmissions: t.Integer(),
  completionRate: t.Number(),
  judgingCompletion: t.Number(),
  averageScoringTurnaroundHours: t.Union([t.Number(), t.Null()]),
  topTechnologyTags: t.Array(TechnologyTagCountResponse),
  finalistCount: t.Integer(),
  winnerCount: t.Integer(),
})

export const SubmissionsPerTrackResponse = t.Object({
  trackId: t.Union([Uuid, t.Null()]),
  trackName: t.Union([t.String(), t.Null()]),
  submissions: t.Integer(),
})

export const ChallengeAnalyticsResponse = t.Composite([
  AnalyticsOverviewResponse,
  t.Object({ submissionsPerTrack: t.Array(SubmissionsPerTrackResponse) }),
])

export const ChallengeAnalyticsSummaryResponse = t.Object({
  challengeId: Uuid,
  title: t.String(),
  registrations: t.Integer(),
  approvedParticipants: t.Integer(),
  finalSubmissions: t.Integer(),
  judgingCompletion: t.Number(),
})

export const ChallengeAnalyticsSummaryListResponse = t.Array(ChallengeAnalyticsSummaryResponse)

export const PortfolioAnalyticsResponse = t.Object({
  totalInnovations: t.Integer(),
  byStage: t.Array(t.Object({ stage: t.String(), count: t.Integer() })),
  portfolioConversionRate: t.Number(),
  activeMilestones: t.Integer(),
  overdueMilestones: t.Integer(),
})
