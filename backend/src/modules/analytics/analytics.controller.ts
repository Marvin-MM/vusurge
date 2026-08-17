import type { AccessContext } from '../../shared/authorization'
import type { AnalyticsService } from './analytics.service'

export function createAnalyticsController(service: AnalyticsService) {
  return {
    async getOverview(access: AccessContext, organizationId: string) {
      return service.getOverview(access, organizationId)
    },

    async listChallengeSummaries(access: AccessContext, organizationId: string) {
      return service.listChallengeSummaries(access, organizationId)
    },

    async getChallengeAnalytics(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
    ) {
      return service.getChallengeAnalytics(access, organizationId, challengeId)
    },

    async getPortfolioAnalytics(access: AccessContext, organizationId: string) {
      return service.getPortfolioAnalytics(access, organizationId)
    },
  }
}

export type AnalyticsController = ReturnType<typeof createAnalyticsController>
