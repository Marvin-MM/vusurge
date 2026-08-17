import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { AnalyticsController } from './analytics.controller'
import {
  AnalyticsOverviewResponse,
  ChallengeAnalyticsResponse,
  ChallengeAnalyticsSummaryListResponse,
  PortfolioAnalyticsResponse,
} from './analytics.dto'

export function analyticsRoutes(controller: AnalyticsController, auth: AuthPlugin) {
  return new Elysia({ name: 'analytics-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId/analytics/overview',
      ({ access, params }) => controller.getOverview(access, params.organizationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: AnalyticsOverviewResponse, ...CommonErrorResponses },
        detail: { tags: ['Analytics'], summary: 'Organization analytics overview' },
      },
    )
    .get(
      '/organizations/:organizationId/analytics/challenges',
      ({ access, params }) => controller.listChallengeSummaries(access, params.organizationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: ChallengeAnalyticsSummaryListResponse, ...CommonErrorResponses },
        detail: { tags: ['Analytics'], summary: 'Per-challenge analytics summary' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/analytics',
      ({ access, params }) =>
        controller.getChallengeAnalytics(access, params.organizationId, params.challengeId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        response: { 200: ChallengeAnalyticsResponse, ...CommonErrorResponses },
        detail: { tags: ['Analytics'], summary: 'Deep-dive analytics for one challenge' },
      },
    )
    .get(
      '/organizations/:organizationId/analytics/portfolio',
      ({ access, params }) => controller.getPortfolioAnalytics(access, params.organizationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: PortfolioAnalyticsResponse, ...CommonErrorResponses },
        detail: { tags: ['Analytics'], summary: 'Innovation portfolio analytics' },
      },
    )
}
