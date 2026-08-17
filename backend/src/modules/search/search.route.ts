import { Elysia } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { PublicErrorResponses } from '../../shared/http'
import type { SearchController } from './search.controller'
import { PublicSearchQuery, PublicSearchResponse } from './search.dto'

export function searchRoutes(controller: SearchController, auth: AuthPlugin) {
  return new Elysia({ name: 'search-routes', prefix: '/public' })
    .use(auth)
    .get('/search', ({ access, query }) => controller.search(query.q, access.ipAddress), {
      query: PublicSearchQuery,
      response: { 200: PublicSearchResponse, ...PublicErrorResponses },
      detail: {
        tags: ['Public'],
        summary: 'Search public organizations and challenges',
        description: 'Fuzzy name/title search over the same public projections as direct listing.',
      },
    })
}
