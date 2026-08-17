import type { Database } from '../../shared/database'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type {
  PublicChallengeRow,
  PublicOrganizationRow,
  PublicRepository,
} from '../public/public.repository'

/**
 * Public search (master prompt section 27).
 *
 * Deliberately thin: it queries the same `PublicRepository` the `public`
 * module uses — the same curated views, so a search result can never surface
 * anything a direct public listing wouldn't — and applies its own
 * `PublicSearch` rate-limit policy rather than the `public` module's
 * `PublicListing` one, since a search fans out into two underlying queries
 * and is a more attractive abuse target than a plain listing.
 */
export interface SearchResult {
  organizations: PublicOrganizationRow[]
  challenges: PublicChallengeRow[]
}

export interface SearchService {
  search(q: string, ipAddress: string | undefined): Promise<SearchResult>
}

const MAX_RESULTS_PER_TYPE = 10

export function createSearchService(
  repository: PublicRepository,
  database: Database,
  rateLimiter: RateLimiter,
): SearchService {
  return {
    async search(q, ipAddress) {
      await rateLimiter.enforce(RateLimitPolicies.PublicSearch, { ipAddress })

      const trimmed = q.trim().slice(0, 100)
      if (trimmed === '') return { organizations: [], challenges: [] }

      const page = { limit: MAX_RESULTS_PER_TYPE }
      const [organizations, challenges] = await Promise.all([
        repository.listOrganizations(database.client, trimmed, page),
        repository.listChallenges(database.client, trimmed, page),
      ])

      return { organizations: organizations.items, challenges: challenges.items }
    },
  }
}
