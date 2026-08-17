import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type AnnouncementAudience = 'ALL_MEMBERS' | 'CHALLENGE_PARTICIPANTS' | 'PUBLIC'
export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface AnnouncementRow {
  id: string
  organizationId: string
  challengeId: string | null
  title: string
  body: string
  audience: AnnouncementAudience
  priority: AnnouncementPriority
  publishAt: Date | null
  expiresAt: Date | null
  isPublished: boolean
  publishedAt: Date | null
  deliverInApp: boolean
  deliverEmail: boolean
  deliverIntegration: boolean
  createdByUserId: string
  createdAt: Date
}

export interface CreateAnnouncementInput {
  id: string
  organizationId: string
  challengeId?: string
  title: string
  body: string
  audience?: AnnouncementAudience
  priority?: AnnouncementPriority
  publishAt?: Date
  expiresAt?: Date
  deliverInApp?: boolean
  deliverEmail?: boolean
  deliverIntegration?: boolean
  createdByUserId: string
}

export type AnnouncementPatch = Partial<
  Pick<
    AnnouncementRow,
    | 'title'
    | 'body'
    | 'audience'
    | 'priority'
    | 'publishAt'
    | 'expiresAt'
    | 'deliverInApp'
    | 'deliverEmail'
    | 'deliverIntegration'
  >
>

export type FaqPatch = Partial<Pick<FaqRow, 'question' | 'answer' | 'displayOrder' | 'isPublished'>>

export interface FaqRow {
  id: string
  organizationId: string
  challengeId: string | null
  question: string
  answer: string
  displayOrder: number
  isPublished: boolean
  createdByUserId: string
  createdAt: Date
}

export interface CreateFaqInput {
  id: string
  organizationId: string
  challengeId?: string
  question: string
  answer: string
  displayOrder?: number
  createdByUserId: string
}

export interface AnnouncementsRepository {
  create(client: PrismaTransactionClient, input: CreateAnnouncementInput): Promise<AnnouncementRow>
  findById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<AnnouncementRow | null>
  list(
    client: PrismaTransactionClient,
    organizationId: string,
    filters: { challengeId?: string; isPublished?: boolean },
    page: PageRequest,
  ): Promise<Page<AnnouncementRow>>
  update(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    patch: AnnouncementPatch,
  ): Promise<void>
  setPublished(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    isPublished: boolean,
    publishedAt: Date | null,
  ): Promise<void>

  createFaq(client: PrismaTransactionClient, input: CreateFaqInput): Promise<FaqRow>
  findFaqById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<FaqRow | null>
  listFaqs(
    client: PrismaTransactionClient,
    organizationId: string,
    filters: { challengeId?: string },
  ): Promise<FaqRow[]>
  updateFaq(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    patch: FaqPatch,
  ): Promise<void>
  deleteFaq(client: PrismaTransactionClient, organizationId: string, id: string): Promise<void>
  setFaqOrder(
    client: PrismaTransactionClient,
    organizationId: string,
    orderedIds: readonly string[],
  ): Promise<void>
}

export function createAnnouncementsRepository(): AnnouncementsRepository {
  return {
    async create(client, input) {
      return client.announcement.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          title: input.title,
          body: input.body,
          audience: input.audience ?? 'ALL_MEMBERS',
          priority: input.priority ?? 'NORMAL',
          publishAt: input.publishAt,
          expiresAt: input.expiresAt,
          deliverInApp: input.deliverInApp ?? true,
          deliverEmail: input.deliverEmail ?? false,
          deliverIntegration: input.deliverIntegration ?? false,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findById(client, organizationId, id) {
      return client.announcement.findFirst({ where: { id, organizationId } })
    },

    async list(client, organizationId, filters, page) {
      const rows = await client.announcement.findMany({
        where: {
          organizationId,
          ...(filters.challengeId !== undefined ? { challengeId: filters.challengeId } : {}),
          ...(filters.isPublished !== undefined ? { isPublished: filters.isPublished } : {}),
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async update(client, organizationId, id, patch) {
      await client.announcement.updateMany({ where: { id, organizationId }, data: patch })
    },

    async setPublished(client, organizationId, id, isPublished, publishedAt) {
      await client.announcement.updateMany({
        where: { id, organizationId },
        data: { isPublished, publishedAt },
      })
    },

    async createFaq(client, input) {
      return client.faq.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          question: input.question,
          answer: input.answer,
          displayOrder: input.displayOrder ?? 0,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findFaqById(client, organizationId, id) {
      return client.faq.findFirst({ where: { id, organizationId } })
    },

    async listFaqs(client, organizationId, filters) {
      return client.faq.findMany({
        where: {
          organizationId,
          ...(filters.challengeId !== undefined ? { challengeId: filters.challengeId } : {}),
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    },

    async updateFaq(client, organizationId, id, patch) {
      await client.faq.updateMany({ where: { id, organizationId }, data: patch })
    },

    async deleteFaq(client, organizationId, id) {
      await client.faq.deleteMany({ where: { id, organizationId } })
    },

    async setFaqOrder(client, organizationId, orderedIds) {
      await Promise.all(
        orderedIds.map((id, index) =>
          client.faq.updateMany({ where: { id, organizationId }, data: { displayOrder: index } }),
        ),
      )
    },
  }
}
