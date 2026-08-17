import type { AccessContext } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type {
  PlatformTicketFilters,
  SupportTicketCategory,
  SupportTicketNoteRow,
  SupportTicketPriority,
  SupportTicketRow,
  SupportTicketStatus,
} from './support.repository'
import type { SupportService } from './support.service'

function serializeTicket(row: SupportTicketRow) {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    challengeId: row.challengeId,
    category: row.category,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignedToUserId: row.assignedToUserId,
    resolutionSummary: row.resolutionSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeNote(row: SupportTicketNoteRow) {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializePage(page: Page<SupportTicketRow>) {
  return {
    items: page.items.map(serializeTicket),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

export function createSupportController(service: SupportService) {
  return {
    async create(
      access: AccessContext,
      input: {
        organizationId?: string
        challengeId?: string
        category: SupportTicketCategory
        subject: string
        description: string
      },
    ) {
      const ticket = await service.create(access, input)
      return serializeTicket(ticket)
    },

    async listMine(access: AccessContext, query: { limit?: number; cursor?: string }) {
      const page = await service.listMine(access, query)
      return serializePage(page)
    },

    async get(access: AccessContext, ticketId: string) {
      const { ticket, comments } = await service.get(access, ticketId)
      return { ticket: serializeTicket(ticket), comments: comments.map(serializeNote) }
    },

    async addComment(access: AccessContext, ticketId: string, body: string) {
      const comment = await service.addComment(access, ticketId, body)
      return serializeNote(comment)
    },

    async reopen(access: AccessContext, ticketId: string) {
      const ticket = await service.reopen(access, ticketId)
      return serializeTicket(ticket)
    },

    async close(access: AccessContext, ticketId: string) {
      const ticket = await service.close(access, ticketId)
      return serializeTicket(ticket)
    },

    async listForPlatform(
      access: AccessContext,
      filters: PlatformTicketFilters,
      query: { limit?: number; cursor?: string },
    ) {
      const page = await service.listForPlatform(access, filters, query)
      return serializePage(page)
    },

    async getForPlatform(access: AccessContext, ticketId: string) {
      const { ticket, comments, internalNotes } = await service.getForPlatform(access, ticketId)
      return {
        ticket: serializeTicket(ticket),
        comments: comments.map(serializeNote),
        internalNotes: internalNotes.map(serializeNote),
      }
    },

    async assign(access: AccessContext, ticketId: string, assignedToUserId: string | null) {
      const ticket = await service.assign(access, ticketId, assignedToUserId)
      return serializeTicket(ticket)
    },

    async changeStatus(access: AccessContext, ticketId: string, status: SupportTicketStatus) {
      const ticket = await service.changeStatus(access, ticketId, status)
      return serializeTicket(ticket)
    },

    async setPriority(access: AccessContext, ticketId: string, priority: SupportTicketPriority) {
      const ticket = await service.setPriority(access, ticketId, priority)
      return serializeTicket(ticket)
    },

    async addStaffComment(access: AccessContext, ticketId: string, body: string) {
      const comment = await service.addStaffComment(access, ticketId, body)
      return serializeNote(comment)
    },

    async addInternalNote(access: AccessContext, ticketId: string, body: string) {
      const note = await service.addInternalNote(access, ticketId, body)
      return serializeNote(note)
    },

    async resolve(access: AccessContext, ticketId: string, resolutionSummary: string) {
      const ticket = await service.resolve(access, ticketId, resolutionSummary)
      return serializeTicket(ticket)
    },
  }
}

export type SupportController = ReturnType<typeof createSupportController>
