import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type { AnnouncementRow, FaqPatch, FaqRow } from './announcements.repository'
import type {
  AnnouncementsService,
  CreateAnnouncementInput,
  CreateFaqInput,
  UpdateAnnouncementInput,
} from './announcements.service'

function serializeAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    title: row.title,
    body: row.body,
    audience: row.audience,
    priority: row.priority,
    publishAt: row.publishAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    deliverInApp: row.deliverInApp,
    deliverEmail: row.deliverEmail,
    deliverIntegration: row.deliverIntegration,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeAnnouncementPage(page: Page<AnnouncementRow>) {
  return {
    items: page.items.map(serializeAnnouncement),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

function serializeFaq(row: FaqRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    question: row.question,
    answer: row.answer,
    displayOrder: row.displayOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createAnnouncementsController(service: AnnouncementsService) {
  return {
    async create(access: AccessContext, organizationId: string, input: CreateAnnouncementInput) {
      requireActor(access)
      const row = await service.create(access, organizationId, input)
      return serializeAnnouncement(row)
    },

    async get(access: AccessContext, organizationId: string, announcementId: string) {
      requireActor(access)
      const row = await service.get(access, organizationId, announcementId)
      return serializeAnnouncement(row)
    },

    async list(
      access: AccessContext,
      organizationId: string,
      filters: { challengeId?: string },
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.list(access, organizationId, filters, query)
      return serializeAnnouncementPage(page)
    },

    async update(
      access: AccessContext,
      organizationId: string,
      announcementId: string,
      patch: UpdateAnnouncementInput,
    ) {
      requireActor(access)
      const row = await service.update(access, organizationId, announcementId, patch)
      return serializeAnnouncement(row)
    },

    async publish(access: AccessContext, organizationId: string, announcementId: string) {
      requireActor(access)
      const row = await service.publish(access, organizationId, announcementId)
      return serializeAnnouncement(row)
    },

    async unpublish(access: AccessContext, organizationId: string, announcementId: string) {
      requireActor(access)
      const row = await service.unpublish(access, organizationId, announcementId)
      return serializeAnnouncement(row)
    },

    async createFaq(access: AccessContext, organizationId: string, input: CreateFaqInput) {
      requireActor(access)
      const row = await service.createFaq(access, organizationId, input)
      return serializeFaq(row)
    },

    async listFaqs(
      access: AccessContext,
      organizationId: string,
      filters: { challengeId?: string },
    ) {
      requireActor(access)
      const rows = await service.listFaqs(access, organizationId, filters)
      return rows.map(serializeFaq)
    },

    async updateFaq(access: AccessContext, organizationId: string, faqId: string, patch: FaqPatch) {
      requireActor(access)
      const row = await service.updateFaq(access, organizationId, faqId, patch)
      return serializeFaq(row)
    },

    async deleteFaq(access: AccessContext, organizationId: string, faqId: string) {
      requireActor(access)
      await service.deleteFaq(access, organizationId, faqId)
    },

    async reorderFaqs(
      access: AccessContext,
      organizationId: string,
      orderedIds: readonly string[],
    ) {
      requireActor(access)
      const rows = await service.reorderFaqs(access, organizationId, orderedIds)
      return rows.map(serializeFaq)
    },
  }
}

export type AnnouncementsController = ReturnType<typeof createAnnouncementsController>
