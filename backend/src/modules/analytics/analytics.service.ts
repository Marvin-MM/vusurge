import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { notFound } from '../../shared/errors'
import type { ChallengesRepository } from '../challenges/challenges.repository'
import type {
  AnalyticsOverviewRow,
  AnalyticsRepository,
  ChallengeAnalyticsSummaryRow,
  PortfolioAnalyticsRow,
  SubmissionsPerTrackRow,
} from './analytics.repository'

/**
 * Organization analytics (master prompt section 24).
 *
 * Every metric here is computed directly from the transactional tables at
 * request time — a deliberate scope decision, not an oversight. Rollup
 * tables and Redis-cached dashboard summaries are the master prompt's
 * suggested optimization, not a requirement; adding that caching layer (with
 * its own invalidation-on-outbox-event wiring) is real additional surface
 * area with its own correctness risk, and every count here is already a
 * simple indexed aggregate over one organization's data — proportional to
 * the same real-time-query approach already used throughout this backend
 * (e.g. `listForPlatform`, every module's own listing endpoints). Revisit
 * with real production query-latency data before adding a caching layer.
 */
export interface AnalyticsService {
  getOverview(access: AccessContext, organizationId: string): Promise<AnalyticsOverviewRow>
  listChallengeSummaries(
    access: AccessContext,
    organizationId: string,
  ): Promise<ChallengeAnalyticsSummaryRow[]>
  getChallengeAnalytics(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<AnalyticsOverviewRow & { submissionsPerTrack: SubmissionsPerTrackRow[] }>
  getPortfolioAnalytics(
    access: AccessContext,
    organizationId: string,
  ): Promise<PortfolioAnalyticsRow>
}

export function createAnalyticsService(
  repository: AnalyticsRepository,
  challengesRepository: ChallengesRepository,
  transactions: TenantTransactionRunner,
): AnalyticsService {
  return {
    async getOverview(access, organizationId) {
      authorize(access, Permission.AnalyticsViewOrg)
      return transactions.withTenant(organizationId, (tx) =>
        repository.getOverview(tx, organizationId),
      )
    },

    async listChallengeSummaries(access, organizationId) {
      authorize(access, Permission.AnalyticsViewOrg)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listChallengeSummaries(tx, organizationId),
      )
    },

    async getChallengeAnalytics(access, organizationId, challengeId) {
      authorize(access, Permission.AnalyticsViewOrg)
      return transactions.withTenant(organizationId, async (tx) => {
        const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
        if (challenge === null) throw notFound('Challenge not found.')
        return repository.getChallengeAnalytics(tx, organizationId, challengeId)
      })
    },

    async getPortfolioAnalytics(access, organizationId) {
      authorize(access, Permission.AnalyticsViewOrg)
      return transactions.withTenant(organizationId, (tx) =>
        repository.getPortfolioAnalytics(tx, organizationId),
      )
    },
  }
}
