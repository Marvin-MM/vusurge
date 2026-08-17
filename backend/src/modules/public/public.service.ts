import type { Database } from '../../shared/database'
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
  database: Database,
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
      return repository.listOrganizations(database.client, q === '' ? undefined : q, page)
    },

    async getOrganization(slug) {
      const organization = await repository.findOrganizationBySlug(database.client, slug)
      if (organization === null) throw notFound('Organization not found.')
      return organization
    },

    async listChallenges(query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      const q = query.q?.trim().slice(0, 100)
      return repository.listChallenges(database.client, q === '' ? undefined : q, page)
    },

    async listChallengesForOrganization(organizationSlug, query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      return repository.listChallengesForOrganization(database.client, organizationSlug, page)
    },

    async getChallenge(organizationSlug, challengeSlug) {
      const challenge = await repository.findChallenge(
        database.client,
        organizationSlug,
        challengeSlug,
      )
      if (challenge === null) throw notFound('Challenge not found.')
      return challenge
    },

    async listInnovationsForOrganization(organizationSlug, query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      return repository.listInnovationsForOrganization(database.client, organizationSlug, page)
    },

    async listTracks(organizationSlug, challengeSlug) {
      const challenge = await repository.findChallenge(
        database.client,
        organizationSlug,
        challengeSlug,
      )
      if (challenge === null) throw notFound('Challenge not found.')
      return repository.listTracksForChallenge(database.client, organizationSlug, challengeSlug)
    },

    async listAnnouncements(organizationSlug, challengeSlug) {
      const challenge = await repository.findChallenge(
        database.client,
        organizationSlug,
        challengeSlug,
      )
      if (challenge === null) throw notFound('Challenge not found.')
      return repository.listAnnouncementsForChallenge(
        database.client,
        organizationSlug,
        challengeSlug,
      )
    },

    async listFaqs(organizationSlug, challengeSlug) {
      const challenge = await repository.findChallenge(
        database.client,
        organizationSlug,
        challengeSlug,
      )
      if (challenge === null) throw notFound('Challenge not found.')
      return repository.listFaqsForChallenge(database.client, organizationSlug, challengeSlug)
    },

    async listResults(organizationSlug, challengeSlug) {
      const challenge = await repository.findChallenge(
        database.client,
        organizationSlug,
        challengeSlug,
      )
      if (challenge === null) throw notFound('Challenge not found.')
      return repository.listResultsForChallenge(database.client, organizationSlug, challengeSlug)
    },

    async listProjectsForOrganization(organizationSlug, query, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicListing, { ipAddress })
      const page = toPageRequest(query, limits)
      return repository.listProjectsForOrganization(database.client, organizationSlug, page)
    },
  }
}
