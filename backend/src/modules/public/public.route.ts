import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { PublicErrorResponses } from '../../shared/http'
import type { PublicController } from './public.controller'
import {
  OrgChallengeSlugParams,
  OrgSlugParam,
  PublicAnnouncementListResponse,
  PublicChallengeListQuery,
  PublicChallengeListResponse,
  PublicChallengeResponse,
  PublicChallengeTrackListResponse,
  PublicFaqListResponse,
  PublicInnovationListResponse,
  PublicOrganizationListQuery,
  PublicOrganizationListResponse,
  PublicOrganizationResponse,
  PublicProjectListResponse,
  PublicSubmissionResultListResponse,
} from './public.dto'

/**
 * Unauthenticated public surface. Every response is built exclusively from
 * curated projections — never a base tenant table — so private organizations
 * and unpublished/hidden challenges can never leak here regardless of how a
 * query is shaped (master prompt section 34.3).
 */
export function publicRoutes(controller: PublicController, auth: AuthPlugin) {
  return new Elysia({ name: 'public-routes', prefix: '/public' })
    .use(auth)
    .get(
      '/organizations',
      ({ access, query }) => controller.listOrganizations(query, access.ipAddress),
      {
        query: PublicOrganizationListQuery,
        response: { 200: PublicOrganizationListResponse, ...PublicErrorResponses },
        detail: { tags: ['Public'], summary: 'List public organizations' },
      },
    )
    .get('/organizations/:orgSlug', ({ params }) => controller.getOrganization(params.orgSlug), {
      params: OrgSlugParam,
      response: { 200: PublicOrganizationResponse, ...PublicErrorResponses },
      detail: { tags: ['Public'], summary: 'Get a public organization by slug' },
    })
    .get('/challenges', ({ access, query }) => controller.listChallenges(query, access.ipAddress), {
      query: PublicChallengeListQuery,
      response: { 200: PublicChallengeListResponse, ...PublicErrorResponses },
      detail: { tags: ['Public'], summary: 'List public challenges across every organization' },
    })
    .get(
      '/organizations/:orgSlug/challenges',
      ({ access, params, query }) =>
        controller.listChallengesForOrganization(params.orgSlug, query, access.ipAddress),
      {
        params: OrgSlugParam,
        query: PublicChallengeListQuery,
        response: { 200: PublicChallengeListResponse, ...PublicErrorResponses },
        detail: { tags: ['Public'], summary: "List an organization's public challenges" },
      },
    )
    .get(
      '/organizations/:orgSlug/challenges/:challengeSlug',
      ({ params }) => controller.getChallenge(params.orgSlug, params.challengeSlug),
      {
        params: OrgChallengeSlugParams,
        response: { 200: PublicChallengeResponse, ...PublicErrorResponses },
        detail: {
          tags: ['Public'],
          summary: 'Get a public challenge by organization and challenge slug',
        },
      },
    )
    .get(
      '/organizations/:orgSlug/innovations',
      ({ access, params, query }) =>
        controller.listInnovationsForOrganization(params.orgSlug, query, access.ipAddress),
      {
        params: OrgSlugParam,
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 512 })),
        }),
        response: { 200: PublicInnovationListResponse, ...PublicErrorResponses },
        detail: {
          tags: ['Public'],
          summary: "List an organization's organizer-approved public innovation portfolio items",
        },
      },
    )
    .get(
      '/organizations/:orgSlug/challenges/:challengeSlug/tracks',
      ({ params }) => controller.listTracks(params.orgSlug, params.challengeSlug),
      {
        params: OrgChallengeSlugParams,
        response: { 200: PublicChallengeTrackListResponse, ...PublicErrorResponses },
        detail: { tags: ['Public'], summary: "A public challenge's tracks" },
      },
    )
    .get(
      '/organizations/:orgSlug/challenges/:challengeSlug/announcements',
      ({ params }) => controller.listAnnouncements(params.orgSlug, params.challengeSlug),
      {
        params: OrgChallengeSlugParams,
        response: { 200: PublicAnnouncementListResponse, ...PublicErrorResponses },
        detail: { tags: ['Public'], summary: "A public challenge's published announcements" },
      },
    )
    .get(
      '/organizations/:orgSlug/challenges/:challengeSlug/faqs',
      ({ params }) => controller.listFaqs(params.orgSlug, params.challengeSlug),
      {
        params: OrgChallengeSlugParams,
        response: { 200: PublicFaqListResponse, ...PublicErrorResponses },
        detail: { tags: ['Public'], summary: "A public challenge's published FAQs" },
      },
    )
    .get(
      '/organizations/:orgSlug/challenges/:challengeSlug/results',
      ({ params }) => controller.listResults(params.orgSlug, params.challengeSlug),
      {
        params: OrgChallengeSlugParams,
        response: { 200: PublicSubmissionResultListResponse, ...PublicErrorResponses },
        detail: {
          tags: ['Public'],
          summary: "A public challenge's results, once the organizer has published them",
        },
      },
    )
    .get(
      '/organizations/:orgSlug/projects',
      ({ access, params, query }) =>
        controller.listProjectsForOrganization(params.orgSlug, query, access.ipAddress),
      {
        params: OrgSlugParam,
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 512 })),
        }),
        response: { 200: PublicProjectListResponse, ...PublicErrorResponses },
        detail: {
          tags: ['Public'],
          summary:
            "An organization's project showcase — only finalized, non-disqualified " +
            'submissions whose team explicitly consented to publication',
        },
      },
    )
}
