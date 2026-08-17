import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type SupportTicketCategory =
  | 'BUG'
  | 'ACCESS_OR_ACCOUNT'
  | 'ORGANIZATION_ISSUE'
  | 'CHALLENGE_ISSUE'
  | 'ABUSE_OR_SAFETY'
  | 'FEATURE_REQUEST'
  | 'OTHER'

export type SupportTicketStatus =
  | 'OPEN'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'WAITING_USER'
  | 'RESOLVED'
  | 'CLOSED'

export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface SupportTicketRow {
  id: string
  userId: string
  organizationId: string | null
  challengeId: string | null
  category: SupportTicketCategory
  subject: string
  description: string
  priority: SupportTicketPriority
  status: SupportTicketStatus
  assignedToUserId: string | null
  resolutionSummary: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SupportTicketNoteRow {
  id: string
  ticketId: string
  authorUserId: string
  body: string
  createdAt: Date
}

export interface CreateTicketInput {
  id: string
  userId: string
  organizationId?: string
  challengeId?: string
  category: SupportTicketCategory
  subject: string
  description: string
}

export interface PlatformTicketFilters {
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  assignedToUserId?: string
}

export interface SupportRepository {
  create(tx: PrismaTransactionClient, input: CreateTicketInput): Promise<SupportTicketRow>
  findById(tx: PrismaTransactionClient, id: string): Promise<SupportTicketRow | null>
  listForUser(
    tx: PrismaTransactionClient,
    userId: string,
    page: PageRequest,
  ): Promise<Page<SupportTicketRow>>
  listForPlatform(
    tx: PrismaTransactionClient,
    filters: PlatformTicketFilters,
    page: PageRequest,
  ): Promise<Page<SupportTicketRow>>
  updateStatus(
    tx: PrismaTransactionClient,
    id: string,
    status: SupportTicketStatus,
    resolutionSummary?: string,
  ): Promise<SupportTicketRow>
  updatePriority(
    tx: PrismaTransactionClient,
    id: string,
    priority: SupportTicketPriority,
  ): Promise<SupportTicketRow>
  assign(
    tx: PrismaTransactionClient,
    id: string,
    assignedToUserId: string | null,
  ): Promise<SupportTicketRow>
  addComment(
    tx: PrismaTransactionClient,
    input: { id: string; ticketId: string; authorUserId: string; body: string },
  ): Promise<SupportTicketNoteRow>
  addInternalNote(
    tx: PrismaTransactionClient,
    input: { id: string; ticketId: string; authorUserId: string; body: string },
  ): Promise<SupportTicketNoteRow>
  listComments(tx: PrismaTransactionClient, ticketId: string): Promise<SupportTicketNoteRow[]>
  listInternalNotes(tx: PrismaTransactionClient, ticketId: string): Promise<SupportTicketNoteRow[]>
  /** True when the target user holds an active support-capable platform role. */
  isSupportCapable(tx: PrismaTransactionClient, userId: string): Promise<boolean>
}

export function createSupportRepository(): SupportRepository {
  return {
    async create(tx, input) {
      return tx.supportTicket.create({
        data: {
          id: input.id,
          userId: input.userId,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          category: input.category,
          subject: input.subject,
          description: input.description,
        },
      })
    },

    async findById(tx, id) {
      return tx.supportTicket.findUnique({ where: { id } })
    },

    async listForUser(tx, userId, page) {
      const rows = await tx.supportTicket.findMany({
        where: {
          userId,
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

    async listForPlatform(tx, filters, page) {
      const rows = await tx.supportTicket.findMany({
        where: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.assignedToUserId ? { assignedToUserId: filters.assignedToUserId } : {}),
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

    async updateStatus(tx, id, status, resolutionSummary) {
      return tx.supportTicket.update({
        where: { id },
        data: {
          status,
          ...(resolutionSummary !== undefined ? { resolutionSummary } : {}),
        },
      })
    },

    async updatePriority(tx, id, priority) {
      return tx.supportTicket.update({ where: { id }, data: { priority } })
    },

    async assign(tx, id, assignedToUserId) {
      return tx.supportTicket.update({ where: { id }, data: { assignedToUserId } })
    },

    async addComment(tx, input) {
      return tx.supportTicketComment.create({
        data: {
          id: input.id,
          ticketId: input.ticketId,
          authorUserId: input.authorUserId,
          body: input.body,
        },
      })
    },

    async addInternalNote(tx, input) {
      return tx.supportTicketInternalNote.create({
        data: {
          id: input.id,
          ticketId: input.ticketId,
          authorUserId: input.authorUserId,
          body: input.body,
        },
      })
    },

    async listComments(tx, ticketId) {
      return tx.supportTicketComment.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
      })
    },

    async listInternalNotes(tx, ticketId) {
      return tx.supportTicketInternalNote.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
      })
    },

    async isSupportCapable(tx, userId) {
      const grant = await tx.platformRoleAssignment.findFirst({
        where: {
          userId,
          revokedAt: null,
          role: { in: ['PLATFORM_SUPERADMIN', 'PLATFORM_SUPPORT_AGENT'] },
        },
        select: { id: true },
      })
      return grant !== null
    },
  }
}
