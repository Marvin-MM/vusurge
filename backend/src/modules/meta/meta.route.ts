import { Elysia } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { PublicErrorResponses } from '../../shared/http'
import type { MetaController } from './meta.controller'
import {
  CapabilitiesResponse,
  SkillListQuery,
  SkillListResponse,
  TechnologyTagListQuery,
  TechnologyTagListResponse,
} from './meta.dto'

export function metaRoutes(controller: MetaController, auth: AuthPlugin) {
  return new Elysia({ name: 'meta-routes', prefix: '/meta' })
    .use(auth)
    .get('/skills', ({ query }) => controller.listSkills(query), {
      query: SkillListQuery,
      response: { 200: SkillListResponse, ...PublicErrorResponses },
      detail: {
        tags: ['Meta'],
        summary: 'Searchable skill catalogue',
        description:
          'Public, paginated catalogue of normalized skills used across profiles and matchmaking.',
      },
    })
    .get('/technology-tags', ({ query }) => controller.listTechnologyTags(query), {
      query: TechnologyTagListQuery,
      response: { 200: TechnologyTagListResponse, ...PublicErrorResponses },
      detail: {
        tags: ['Meta'],
        summary: 'Searchable technology-tag catalogue',
        description:
          'Public, paginated catalogue of normalized technology tags used for submission typeahead.',
      },
    })
    .get('/capabilities', () => controller.capabilities(), {
      response: { 200: CapabilitiesResponse, ...PublicErrorResponses },
      detail: {
        tags: ['Meta'],
        summary: 'Client-visible enabled capabilities',
        description:
          'Safe, non-secret feature flags only. Never exposes operational configuration.',
      },
    })
}
