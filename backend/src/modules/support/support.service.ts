import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import {
  authorize,
  checkPermission,
  Permission,
  requireVerifiedActor,
} from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, notFound, validationFailed } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type {
  CreateTicketInput,
  PlatformTicketFilters,
  SupportRepository,
  SupportTicketCategory,
  SupportTicketNoteRow,
  SupportTicketPriority,
  SupportTicketRow,
  SupportTicketStatus,
} from './support.repository'

/**
 * Support tickets and feature requests (master prompt section 25).
 *
 * Every write that a ticket's own user should hear about — a status change,
 * a staff comment, a resolution — writes a `support_ticket.updated` outbox
 * event in the same transaction, so the email/notification fan-out survives
 * a crash between commit and delivery exactly like every other module.
 */

const TERMINAL_STATUS: SupportTicketStatus = 'CLOSED'

function requireOwnerOrSupport(
  access: AccessContext,
  ticket: SupportTicketRow,
): { actorUserId: string; isSupportStaff: boolean } {
  const { actor } = requireVerifiedActor(access)
  const isSupportStaff = checkPermission(access, Permission.PlatformSupport).allowed
  if (!isSupportStaff && ticket.userId !== actor.userId) {
    // A caller with no relationship to this ticket sees exactly what a caller
    // naming a nonexistent ticket sees (master prompt section 35).
    throw notFound()
  }
  return { actorUserId: actor.userId, isSupportStaff }
}

export interface SupportService {
  create(
    access: AccessContext,
    input: Omit<CreateTicketInput, 'id' | 'userId'>,
  ): Promise<SupportTicketRow>
  listMine(
    access: AccessContext,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<SupportTicketRow>>
  get(
    access: AccessContext,
    ticketId: string,
  ): Promise<{ ticket: SupportTicketRow; comments: SupportTicketNoteRow[] }>
  addComment(access: AccessContext, ticketId: string, body: string): Promise<SupportTicketNoteRow>
  reopen(access: AccessContext, ticketId: string): Promise<SupportTicketRow>
  close(access: AccessContext, ticketId: string): Promise<SupportTicketRow>

  listForPlatform(
    access: AccessContext,
    filters: PlatformTicketFilters,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<SupportTicketRow>>
  getForPlatform(
    access: AccessContext,
    ticketId: string,
  ): Promise<{
    ticket: SupportTicketRow
    comments: SupportTicketNoteRow[]
    internalNotes: SupportTicketNoteRow[]
  }>
  assign(
    access: AccessContext,
    ticketId: string,
    assignedToUserId: string | null,
  ): Promise<SupportTicketRow>
  changeStatus(
    access: AccessContext,
    ticketId: string,
    status: SupportTicketStatus,
  ): Promise<SupportTicketRow>
  setPriority(
    access: AccessContext,
    ticketId: string,
    priority: SupportTicketPriority,
  ): Promise<SupportTicketRow>
  addStaffComment(
    access: AccessContext,
    ticketId: string,
    body: string,
  ): Promise<SupportTicketNoteRow>
  addInternalNote(
    access: AccessContext,
    ticketId: string,
    body: string,
  ): Promise<SupportTicketNoteRow>
  resolve(
    access: AccessContext,
    ticketId: string,
    resolutionSummary: string,
  ): Promise<SupportTicketRow>
}

export function createSupportService(
  repository: SupportRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  rateLimiter: RateLimiter,
  limits: PaginationLimits,
): SupportService {
  async function loadOrThrow(tx: Parameters<SupportRepository['findById']>[0], id: string) {
    const ticket = await repository.findById(tx, id)
    if (ticket === null) throw notFound('Support ticket not found.')
    return ticket
  }

  async function notifyOwner(
    tx: Parameters<SupportRepository['findById']>[0],
    ticket: SupportTicketRow,
    summary: string,
    eventKey: string,
  ): Promise<void> {
    await outbox.write(tx, {
      eventType: 'support_ticket.updated',
      queueName: QueueName.Email,
      aggregateType: 'support_ticket',
      aggregateId: ticket.id,
      dedupeKey: `support-ticket-updated:${ticket.id}:${eventKey}`,
      payload: { ticketId: ticket.id, userId: ticket.userId, subject: ticket.subject, summary },
    })
  }

  return {
    async create(access, input) {
      const { actor } = requireVerifiedActor(access)
      await rateLimiter.enforce(RateLimitPolicies.SupportTicketCreation, { userId: actor.userId })

      return transactions.withoutTenant(
        async (tx) => {
          const ticket = await repository.create(tx, {
            id: newId(),
            userId: actor.userId,
            organizationId: input.organizationId,
            challengeId: input.challengeId,
            category: input.category,
            subject: input.subject,
            description: input.description,
          })

          await audit.write(tx, {
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.SupportTicketCreated,
            resourceType: 'support_ticket',
            resourceId: ticket.id,
            summary: `Opened a support ticket: "${ticket.subject}".`,
          })

          return ticket
        },
        { actorUserId: actor.userId },
      )
    },

    async listMine(access, query) {
      const { actor } = requireVerifiedActor(access)
      const page = toPageRequest(query, limits)
      return transactions.withoutTenant((tx) => repository.listForUser(tx, actor.userId, page))
    },

    async get(access, ticketId) {
      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        requireOwnerOrSupport(access, ticket)
        const comments = await repository.listComments(tx, ticketId)
        return { ticket, comments }
      })
    },

    async addComment(access, ticketId, body) {
      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        const { actorUserId } = requireOwnerOrSupport(access, ticket)
        if (ticket.status === TERMINAL_STATUS) {
          throw conflict(ErrorCode.CONFLICT, 'This ticket is closed. Reopen it to add a comment.')
        }

        const comment = await repository.addComment(tx, {
          id: newId(),
          ticketId,
          authorUserId: actorUserId,
          body,
        })

        await audit.write(tx, {
          actorType: 'USER',
          actorUserId,
          action: AuditAction.SupportTicketCreated,
          resourceType: 'support_ticket_comment',
          resourceId: comment.id,
          summary: `Commented on support ticket "${ticket.subject}".`,
        })

        return comment
      })
    },

    async reopen(access, ticketId) {
      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        const { actor } = requireVerifiedActor(access)
        if (ticket.userId !== actor.userId) throw notFound()

        if (ticket.status !== 'RESOLVED') {
          throw conflict(ErrorCode.CONFLICT, 'Only a resolved ticket can be reopened.')
        }

        const updated = await repository.updateStatus(tx, ticketId, 'IN_PROGRESS')

        await audit.write(tx, {
          actorType: 'USER',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketStatusChanged,
          resourceType: 'support_ticket',
          resourceId: ticketId,
          summary: `Reopened support ticket "${ticket.subject}".`,
        })

        return updated
      })
    },

    async close(access, ticketId) {
      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        const { actor } = requireVerifiedActor(access)
        if (ticket.userId !== actor.userId) throw notFound()

        if (ticket.status === TERMINAL_STATUS) {
          throw conflict(ErrorCode.CONFLICT, 'This ticket is already closed.')
        }

        const updated = await repository.updateStatus(tx, ticketId, TERMINAL_STATUS)

        await audit.write(tx, {
          actorType: 'USER',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketStatusChanged,
          resourceType: 'support_ticket',
          resourceId: ticketId,
          summary: `Closed support ticket "${ticket.subject}".`,
        })

        return updated
      })
    },

    async listForPlatform(access, filters, query) {
      authorize(access, Permission.PlatformSupport)
      const page = toPageRequest(query, limits)
      return transactions.withoutTenant((tx) => repository.listForPlatform(tx, filters, page))
    },

    async getForPlatform(access, ticketId) {
      authorize(access, Permission.PlatformSupport)
      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        const [comments, internalNotes] = await Promise.all([
          repository.listComments(tx, ticketId),
          repository.listInternalNotes(tx, ticketId),
        ])
        return { ticket, comments, internalNotes }
      })
    },

    async assign(access, ticketId, assignedToUserId) {
      authorize(access, Permission.PlatformSupport)
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)

        if (assignedToUserId !== null) {
          const capable = await repository.isSupportCapable(tx, assignedToUserId)
          if (!capable) {
            throw validationFailed('The assignee does not hold a support-capable platform role.', [
              {
                field: 'assignedToUserId',
                code: 'not_support_capable',
                message: 'Not eligible for assignment.',
              },
            ])
          }
        }

        const updated = await repository.assign(tx, ticketId, assignedToUserId)

        await audit.write(tx, {
          actorType: 'PLATFORM_ADMIN',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketAssigned,
          resourceType: 'support_ticket',
          resourceId: ticketId,
          summary:
            assignedToUserId === null
              ? `Unassigned support ticket "${ticket.subject}".`
              : `Assigned support ticket "${ticket.subject}".`,
        })

        return updated
      })
    },

    async changeStatus(access, ticketId, status) {
      authorize(access, Permission.PlatformSupport)
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        if (ticket.status === status) {
          throw conflict(ErrorCode.CONFLICT, 'The ticket already has this status.')
        }

        const updated = await repository.updateStatus(tx, ticketId, status)

        await audit.write(tx, {
          actorType: 'PLATFORM_ADMIN',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketStatusChanged,
          resourceType: 'support_ticket',
          resourceId: ticketId,
          summary: `Changed support ticket "${ticket.subject}" status to ${status}.`,
        })

        await notifyOwner(
          tx,
          updated,
          `Your support ticket status changed to ${status}.`,
          updated.updatedAt.toISOString(),
        )

        return updated
      })
    },

    async setPriority(access, ticketId, priority) {
      authorize(access, Permission.PlatformSupport)
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        const updated = await repository.updatePriority(tx, ticketId, priority)

        await audit.write(tx, {
          actorType: 'PLATFORM_ADMIN',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketPriorityChanged,
          resourceType: 'support_ticket',
          resourceId: ticketId,
          summary: `Changed support ticket "${ticket.subject}" priority to ${priority}.`,
        })

        return updated
      })
    },

    async addStaffComment(access, ticketId, body) {
      authorize(access, Permission.PlatformSupport)
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)

        const comment = await repository.addComment(tx, {
          id: newId(),
          ticketId,
          authorUserId: actor.userId,
          body,
        })

        await audit.write(tx, {
          actorType: 'PLATFORM_ADMIN',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketCreated,
          resourceType: 'support_ticket_comment',
          resourceId: comment.id,
          summary: `Staff commented on support ticket "${ticket.subject}".`,
        })

        await notifyOwner(tx, ticket, 'A staff member replied to your support ticket.', comment.id)

        return comment
      })
    },

    async addInternalNote(access, ticketId, body) {
      authorize(access, Permission.PlatformSupport)
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)

        const note = await repository.addInternalNote(tx, {
          id: newId(),
          ticketId,
          authorUserId: actor.userId,
          body,
        })

        await audit.write(tx, {
          actorType: 'PLATFORM_ADMIN',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketCreated,
          resourceType: 'support_ticket_internal_note',
          resourceId: note.id,
          summary: `Added an internal note to support ticket "${ticket.subject}".`,
        })

        return note
      })
    },

    async resolve(access, ticketId, resolutionSummary) {
      authorize(access, Permission.PlatformSupport)
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(async (tx) => {
        const ticket = await loadOrThrow(tx, ticketId)
        if (ticket.status === TERMINAL_STATUS) {
          throw conflict(ErrorCode.CONFLICT, 'A closed ticket cannot be resolved. Reopen it first.')
        }

        const updated = await repository.updateStatus(tx, ticketId, 'RESOLVED', resolutionSummary)

        await audit.write(tx, {
          actorType: 'PLATFORM_ADMIN',
          actorUserId: actor.userId,
          action: AuditAction.SupportTicketResolved,
          resourceType: 'support_ticket',
          resourceId: ticketId,
          summary: `Resolved support ticket "${ticket.subject}".`,
        })

        await notifyOwner(tx, updated, resolutionSummary, updated.updatedAt.toISOString())

        return updated
      })
    },
  }
}

// Re-exported so route/controller/test files can import ticket category and
// status literal unions from this module alongside the service factory.
export type { SupportTicketCategory, SupportTicketPriority, SupportTicketStatus }
