import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { AnnouncementsController } from './announcements.controller'
import {
  AnnouncementListQuery,
  AnnouncementListResponse,
  AnnouncementResponse,
  CreateAnnouncementBody,
  CreateFaqBody,
  FaqListQuery,
  FaqListResponse,
  FaqResponse,
  ReorderFaqsBody,
  UpdateAnnouncementBody,
  UpdateFaqBody,
} from './announcements.dto'

export function announcementsRoutes(controller: AnnouncementsController, auth: AuthPlugin) {
  return (
    new Elysia({ name: 'announcements-routes' })
      .use(auth)
      .post(
        '/organizations/:organizationId/announcements',
        async ({ access, params, body, set }) => {
          const result = await controller.create(access, params.organizationId, body)
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid }),
          body: CreateAnnouncementBody,
          response: { 201: AnnouncementResponse, ...CommonErrorResponses },
          detail: { tags: ['Announcements'], summary: 'Create an announcement' },
        },
      )
      .get(
        '/organizations/:organizationId/announcements',
        ({ access, params, query }) =>
          controller.list(access, params.organizationId, { challengeId: query.challengeId }, query),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid }),
          query: AnnouncementListQuery,
          response: { 200: AnnouncementListResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Announcements'],
            summary: 'List announcements',
            description: 'Members see only published announcements; organizers see all.',
          },
        },
      )
      .get(
        '/organizations/:organizationId/announcements/:announcementId',
        ({ access, params }) =>
          controller.get(access, params.organizationId, params.announcementId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, announcementId: Uuid }),
          response: { 200: AnnouncementResponse, ...CommonErrorResponses },
          detail: { tags: ['Announcements'], summary: 'Get an announcement' },
        },
      )
      .patch(
        '/organizations/:organizationId/announcements/:announcementId',
        ({ access, params, body }) =>
          controller.update(access, params.organizationId, params.announcementId, body),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, announcementId: Uuid }),
          body: UpdateAnnouncementBody,
          response: { 200: AnnouncementResponse, ...CommonErrorResponses },
          detail: { tags: ['Announcements'], summary: 'Update an announcement' },
        },
      )
      .post(
        '/organizations/:organizationId/announcements/:announcementId/publish',
        ({ access, params }) =>
          controller.publish(access, params.organizationId, params.announcementId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, announcementId: Uuid }),
          response: { 200: AnnouncementResponse, ...CommonErrorResponses },
          detail: { tags: ['Announcements'], summary: 'Publish an announcement' },
        },
      )
      .post(
        '/organizations/:organizationId/announcements/:announcementId/unpublish',
        ({ access, params }) =>
          controller.unpublish(access, params.organizationId, params.announcementId),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, announcementId: Uuid }),
          response: { 200: AnnouncementResponse, ...CommonErrorResponses },
          detail: { tags: ['Announcements'], summary: 'Unpublish an announcement' },
        },
      )
      // --- FAQs ------------------------------------------------------------------
      .get(
        '/organizations/:organizationId/faqs',
        ({ access, params, query }) =>
          controller.listFaqs(access, params.organizationId, { challengeId: query.challengeId }),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid }),
          query: FaqListQuery,
          response: { 200: FaqListResponse, ...CommonErrorResponses },
          detail: {
            tags: ['FAQs'],
            summary: 'List FAQ entries',
            description: 'Members see only published entries; organizers see all.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/faqs',
        async ({ access, params, body, set }) => {
          const result = await controller.createFaq(access, params.organizationId, body)
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid }),
          body: CreateFaqBody,
          response: { 201: FaqResponse, ...CommonErrorResponses },
          detail: { tags: ['FAQs'], summary: 'Create a FAQ entry' },
        },
      )
      .patch(
        '/organizations/:organizationId/faqs/:faqId',
        ({ access, params, body }) =>
          controller.updateFaq(access, params.organizationId, params.faqId, body),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, faqId: Uuid }),
          body: UpdateFaqBody,
          response: { 200: FaqResponse, ...CommonErrorResponses },
          detail: { tags: ['FAQs'], summary: 'Update a FAQ entry' },
        },
      )
      .delete(
        '/organizations/:organizationId/faqs/:faqId',
        async ({ access, params, set }) => {
          await controller.deleteFaq(access, params.organizationId, params.faqId)
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, faqId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['FAQs'], summary: 'Delete a FAQ entry' },
        },
      )
      .post(
        '/organizations/:organizationId/faqs/reorder',
        ({ access, params, body }) =>
          controller.reorderFaqs(access, params.organizationId, body.orderedIds),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid }),
          body: ReorderFaqsBody,
          response: { 200: FaqListResponse, ...CommonErrorResponses },
          detail: {
            tags: ['FAQs'],
            summary: 'Reorder FAQ entries',
            description: 'Sets display order to the position of each id in the provided array.',
          },
        },
      )
  )
}
