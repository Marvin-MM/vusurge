import { serialize, serializeChallenge } from '../public/public.controller'
import type { SearchService } from './search.service'

export function createSearchController(service: SearchService) {
  return {
    async search(q: string, ipAddress: string | undefined) {
      const result = await service.search(q, ipAddress)
      return {
        organizations: result.organizations.map(serialize),
        challenges: result.challenges.map(serializeChallenge),
      }
    },
  }
}

export type SearchController = ReturnType<typeof createSearchController>
