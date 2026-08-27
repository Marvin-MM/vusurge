import type { TenantTransactionRunner } from '../../shared/database'
import { notFound } from '../../shared/errors'
import { type Page, type PaginationLimits, toPageRequest } from '../../shared/http'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type {
  PublicAnnouncementRow,
  PublicChallengeRow,
  PublicChallengeTrackRow,
  PublicFaqRow,
  PublicInnovationRow,
  PublicOrganizationRow,
  PublicProjectRow,
  PublicRepository,
  PublicSubmissionResultRow,
} from './public.repository'

export interface PublicService {
  listOrganizations(
    query: { q?: string; limit?: number; cursor?: string },
    ipAddress: string | undefined,
  ): Promise<Page<PublicOrganizationRow>>
  getOrganization(slug: string): Promise<PublicOrganizationRow>
  listChallenges(
    query: { q?: string; limit?: number; cursor?: string },
    ipAddress: string | undefined,
  ): Promise<Page<PublicChallengeRow>>
  listChallengesForOrganization(
    organizationSlug: string,
    query: { limit?: number; cursor?: string },
    ipAddress: string | undefined,
  ): Promise<Page<PublicChallengeRow>>
  getChallenge(organizationSlug: string, challengeSlug: string): Promise<PublicChallengeRow>
  listInnovationsForOrganization(
    organizationSlug: string,
    query: { limit?: number; cursor?: string },
    ipAddress: string | undefined,
  ): Promise<Page<PublicInnovationRow>>
  listTracks(organizationSlug: string, challengeSlug: string): Promise<PublicChallengeTrackRow[]>
  listAnnouncements(
    organizationSlug: string,
    challengeSlug: string,
  ): Promise<PublicAnnouncementRow[]>
  listFaqs(organizationSlug: string, challengeSlug: string): Promise<PublicFaqRow[]>
  listResults(organizationSlug: string, challengeSlug: string): Promise<PublicSubmissionResultRow[]>
  listProjectsForOrganization(
    organizationSlug: string,
    query: { limit?: number; cursor?: string },
    ipAddress: string | undefined,
  ): Promise<Page<PublicProjectRow>>
}

export function createPublicService(
  repository: PublicRepository,
  transactions: TenantTransactionRunner,
  rateLimiter: RateLimiter,
  limits: PaginationLimits,
): PublicService {
  return {
    async listOrganizations(query, ipAddress) {
      // Public listing/search is abuse-sensitive (master prompt section 36):
      // it is unauthenticated and reads the database on every call.
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      const q = query.q?.trim().slice(0, 100)
      return transactions.withPublicProjection((tx) =>
        repository.listOrganizations(tx, q === '' ? undefined : q, page),
      )
    },

    async getOrganization(slug) {
      const organization = await transactions.withPublicProjection((tx) =>
        repository.findOrganizationBySlug(tx, slug),
      )
      if (organization === null) throw notFound('Organization not found.')
      return organization
    },

    async listChallenges(query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      const q = query.q?.trim().slice(0, 100)
      return transactions.withPublicProjection((tx) =>
        repository.listChallenges(tx, q === '' ? undefined : q, page),
      )
    },

    async listChallengesForOrganization(organizationSlug, query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      return transactions.withPublicProjection((tx) =>
        repository.listChallengesForOrganization(tx, organizationSlug, page),
      )
    },

    async getChallenge(organizationSlug, challengeSlug) {
      const challenge = await transactions.withPublicProjection((tx) =>
        repository.findChallenge(tx, organizationSlug, challengeSlug),
      )
      if (challenge === null) throw notFound('Challenge not found.')
      return challenge
    },

    async listInnovationsForOrganization(organizationSlug, query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      return transactions.withPublicProjection((tx) =>
        repository.listInnovationsForOrganization(tx, organizationSlug, page),
      )
    },

    async listTracks(organizationSlug, challengeSlug) {
      return transactions.withPublicProjection(async (tx) => {
        const challenge = await repository.findChallenge(tx, organizationSlug, challengeSlug)
        if (challenge === null) throw notFound('Challenge not found.')
        return repository.listTracksForChallenge(tx, organizationSlug, challengeSlug)
      })
    },

    async listAnnouncements(organizationSlug, challengeSlug) {
      return transactions.withPublicProjection(async (tx) => {
        const challenge = await repository.findChallenge(tx, organizationSlug, challengeSlug)
        if (challenge === null) throw notFound('Challenge not found.')
        return repository.listAnnouncementsForChallenge(tx, organizationSlug, challengeSlug)
      })
    },

    async listFaqs(organizationSlug, challengeSlug) {
      return transactions.withPublicProjection(async (tx) => {
        const challenge = await repository.findChallenge(tx, organizationSlug, challengeSlug)
        if (challenge === null) throw notFound('Challenge not found.')
        return repository.listFaqsForChallenge(tx, organizationSlug, challengeSlug)
      })
    },

    async listResults(organizationSlug, challengeSlug) {
      return transactions.withPublicProjection(async (tx) => {
        const challenge = await repository.findChallenge(tx, organizationSlug, challengeSlug)
        if (challenge === null) throw notFound('Challenge not found.')
        return repository.listResultsForChallenge(tx, organizationSlug, challengeSlug)
      })
    },

    async listProjectsForOrganization(organizationSlug, query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      return transactions.withPublicProjection((tx) =>
        repository.listProjectsForOrganization(tx, organizationSlug, page),
      )
    },
  }
}
