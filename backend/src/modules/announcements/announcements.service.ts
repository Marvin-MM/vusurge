import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, checkPermission, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { type Page, type PaginationLimits, toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import type {
  AnnouncementPatch,
  AnnouncementRow,
  AnnouncementsRepository,
  FaqPatch,
  FaqRow,
} from './announcements.repository'

export interface CreateAnnouncementInput {
  challengeId?: string
  title: string
  body: string
  audience?: AnnouncementRow['audience']
  priority?: AnnouncementRow['priority']
  publishAt?: string
  expiresAt?: string
  deliverInApp?: boolean
  deliverEmail?: boolean
  deliverIntegration?: boolean
}

export type UpdateAnnouncementInput = Omit<AnnouncementPatch, 'publishAt' | 'expiresAt'> & {
  publishAt?: string | null
  expiresAt?: string | null
}

export interface CreateFaqInput {
  challengeId?: string
  question: string
  answer: string
  displayOrder?: number
}

function canManage(access: AccessContext, permission: Permission): boolean {
  return checkPermission(access, permission).allowed
}

export interface AnnouncementsService {
  create(
    access: AccessContext,
    organizationId: string,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementRow>
  get(
    access: AccessContext,
    organizationId: string,
    announcementId: string,
  ): Promise<AnnouncementRow>
  list(
    access: AccessContext,
    organizationId: string,
    filters: { challengeId?: string },
    query: { limit?: number; cursor?: string },
  ): Promise<Page<AnnouncementRow>>
  update(
    access: AccessContext,
    organizationId: string,
    announcementId: string,
    patch: UpdateAnnouncementInput,
  ): Promise<AnnouncementRow>
  publish(
    access: AccessContext,
    organizationId: string,
    announcementId: string,
  ): Promise<AnnouncementRow>
  unpublish(
    access: AccessContext,
    organizationId: string,
    announcementId: string,
  ): Promise<AnnouncementRow>

  createFaq(access: AccessContext, organizationId: string, input: CreateFaqInput): Promise<FaqRow>
  listFaqs(
    access: AccessContext,
    organizationId: string,
    filters: { challengeId?: string },
  ): Promise<FaqRow[]>
  updateFaq(
    access: AccessContext,
    organizationId: string,
    faqId: string,
    patch: FaqPatch,
  ): Promise<FaqRow>
  deleteFaq(access: AccessContext, organizationId: string, faqId: string): Promise<void>
  reorderFaqs(
    access: AccessContext,
    organizationId: string,
    orderedIds: readonly string[],
  ): Promise<FaqRow[]>
}

export function createAnnouncementsService(
  repository: AnnouncementsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  paginationLimits: PaginationLimits,
): AnnouncementsService {
  return {
    async create(access, organizationId, input) {
      authorize(access, Permission.OrganizationManageAnnouncements)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const announcement = await repository.create(tx, {
            id: newId(),
            organizationId,
            challengeId: input.challengeId,
            title: input.title,
            body: input.body,
            audience: input.audience,
            priority: input.priority,
            publishAt: input.publishAt !== undefined ? new Date(input.publishAt) : undefined,
            expiresAt: input.expiresAt !== undefined ? new Date(input.expiresAt) : undefined,
            deliverInApp: input.deliverInApp,
            deliverEmail: input.deliverEmail,
            deliverIntegration: input.deliverIntegration,
            createdByUserId: actorUserId,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.AnnouncementCreated,
            resourceType: 'announcement',
            resourceId: announcement.id,
            summary: `Created announcement "${announcement.title}".`,
          })
          return announcement
        },
        { actorUserId },
      )
    },

    async get(access, organizationId, announcementId) {
      authorize(access, Permission.OrganizationViewPrivate)

      return transactions.withTenant(organizationId, async (tx) => {
        const announcement = await repository.findById(tx, organizationId, announcementId)
        if (announcement === null) throw notFound('Announcement not found.')
        if (
          !announcement.isPublished &&
          !canManage(access, Permission.OrganizationManageAnnouncements)
        ) {
          throw notFound('Announcement not found.')
        }
        return announcement
      })
    },

    async list(access, organizationId, filters, query) {
      authorize(access, Permission.OrganizationViewPrivate)
      const page = toPageRequest(query, paginationLimits)
      const isPublished = canManage(access, Permission.OrganizationManageAnnouncements)
        ? undefined
        : true

      return transactions.withTenant(organizationId, (tx) =>
        repository.list(tx, organizationId, { ...filters, isPublished }, page),
      )
    },

    async update(access, organizationId, announcementId, patch) {
      authorize(access, Permission.OrganizationManageAnnouncements)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await repository.findById(tx, organizationId, announcementId)
          if (before === null) throw notFound('Announcement not found.')

          const { publishAt, expiresAt, ...rest } = patch
          await repository.update(tx, organizationId, announcementId, {
            ...rest,
            ...(publishAt !== undefined
              ? { publishAt: publishAt === null ? null : new Date(publishAt) }
              : {}),
            ...(expiresAt !== undefined
              ? { expiresAt: expiresAt === null ? null : new Date(expiresAt) }
              : {}),
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.AnnouncementUpdated,
            resourceType: 'announcement',
            resourceId: announcementId,
            summary: `Updated announcement "${before.title}".`,
          })

          const after = await repository.findById(tx, organizationId, announcementId)
          if (after === null) throw notFound('Announcement not found.')
          return after
        },
        { actorUserId },
      )
    },

    async publish(access, organizationId, announcementId) {
      authorize(access, Permission.OrganizationManageAnnouncements)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await repository.findById(tx, organizationId, announcementId)
          if (before === null) throw notFound('Announcement not found.')
          if (before.isPublished) {
            throw conflict(ErrorCode.CONFLICT, 'This announcement is already published.')
          }

          const now = await transactions.databaseNow(tx)
          await repository.setPublished(tx, organizationId, announcementId, true, now)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.AnnouncementPublished,
            resourceType: 'announcement',
            resourceId: announcementId,
            summary: `Published announcement "${before.title}".`,
          })
          await outbox.write(tx, {
            eventType: 'announcement.published',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'announcement',
            aggregateId: announcementId,
            organizationId,
            dedupeKey: `announcement-published:${announcementId}`,
            payload: { announcementId },
          })

          const after = await repository.findById(tx, organizationId, announcementId)
          if (after === null) throw notFound('Announcement not found.')
          return after
        },
        { actorUserId },
      )
    },

    async unpublish(access, organizationId, announcementId) {
      authorize(access, Permission.OrganizationManageAnnouncements)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await repository.findById(tx, organizationId, announcementId)
          if (before === null) throw notFound('Announcement not found.')
          if (!before.isPublished) {
            throw conflict(ErrorCode.CONFLICT, 'This announcement is not published.')
          }

          await repository.setPublished(tx, organizationId, announcementId, false, null)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.AnnouncementUnpublished,
            resourceType: 'announcement',
            resourceId: announcementId,
            summary: `Unpublished announcement "${before.title}".`,
          })

          const after = await repository.findById(tx, organizationId, announcementId)
          if (after === null) throw notFound('Announcement not found.')
          return after
        },
        { actorUserId },
      )
    },

    async createFaq(access, organizationId, input) {
      authorize(access, Permission.OrganizationManageFaqs)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const faq = await repository.createFaq(tx, {
            id: newId(),
            organizationId,
            challengeId: input.challengeId,
            question: input.question,
            answer: input.answer,
            displayOrder: input.displayOrder,
            createdByUserId: actorUserId,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FaqChanged,
            resourceType: 'faq',
            resourceId: faq.id,
            summary: 'Created a FAQ entry.',
          })
          return faq
        },
        { actorUserId },
      )
    },

    async listFaqs(access, organizationId, filters) {
      authorize(access, Permission.OrganizationViewPrivate)
      const canManageFaqs = canManage(access, Permission.OrganizationManageFaqs)

      return transactions.withTenant(organizationId, async (tx) => {
        const rows = await repository.listFaqs(tx, organizationId, filters)
        return canManageFaqs ? rows : rows.filter((row) => row.isPublished)
      })
    },

    async updateFaq(access, organizationId, faqId, patch) {
      authorize(access, Permission.OrganizationManageFaqs)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await repository.findFaqById(tx, organizationId, faqId)
          if (before === null) throw notFound('FAQ entry not found.')

          await repository.updateFaq(tx, organizationId, faqId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FaqChanged,
            resourceType: 'faq',
            resourceId: faqId,
            summary: 'Updated a FAQ entry.',
          })

          const after = await repository.findFaqById(tx, organizationId, faqId)
          if (after === null) throw notFound('FAQ entry not found.')
          return after
        },
        { actorUserId },
      )
    },

    async deleteFaq(access, organizationId, faqId) {
      authorize(access, Permission.OrganizationManageFaqs)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await repository.findFaqById(tx, organizationId, faqId)
          if (before === null) throw notFound('FAQ entry not found.')

          await repository.deleteFaq(tx, organizationId, faqId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FaqChanged,
            resourceType: 'faq',
            resourceId: faqId,
            summary: 'Deleted a FAQ entry.',
          })
        },
        { actorUserId },
      )
    },

    async reorderFaqs(access, organizationId, orderedIds) {
      authorize(access, Permission.OrganizationManageFaqs)
      const actorUserId = access.actor?.userId
      if (orderedIds.length === 0) throw badRequest('At least one FAQ id must be provided.')

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await repository.setFaqOrder(tx, organizationId, orderedIds)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FaqChanged,
            resourceType: 'faq',
            summary: `Reordered ${orderedIds.length} FAQ entries.`,
          })

          return repository.listFaqs(tx, organizationId, {})
        },
        { actorUserId },
      )
    },
  }
}
