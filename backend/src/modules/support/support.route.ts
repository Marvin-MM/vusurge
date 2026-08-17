import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { SupportController } from './support.controller'
import {
  AddCommentBody,
  AssignTicketBody,
  ChangeStatusBody,
  CreateTicketBody,
  PlatformSupportTicketDetailResponse,
  PlatformTicketListQuery,
  ResolveTicketBody,
  SetPriorityBody,
  SupportTicketDetailResponse,
  SupportTicketListResponse,
  SupportTicketNoteResponse,
  SupportTicketResponse,
} from './support.dto'

export function supportRoutes(controller: SupportController, auth: AuthPlugin) {
  return (
    new Elysia({ name: 'support-routes' })
      .use(auth)
      // --- User surface ----------------------------------------------------
      .post('/support/tickets', ({ access, body }) => controller.create(access, body), {
        requireAuth: true,
        body: CreateTicketBody,
        response: { 200: SupportTicketResponse, ...CommonErrorResponses },
        detail: { tags: ['Support'], summary: 'Open a support ticket' },
      })
      .get('/support/tickets', ({ access, query }) => controller.listMine(access, query), {
        requireAuth: true,
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 512 })),
        }),
        response: { 200: SupportTicketListResponse, ...CommonErrorResponses },
        detail: { tags: ['Support'], summary: "List the caller's own support tickets" },
      })
      .get(
        '/support/tickets/:ticketId',
        ({ access, params }) => controller.get(access, params.ticketId),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          response: { 200: SupportTicketDetailResponse, ...CommonErrorResponses },
          detail: { tags: ['Support'], summary: 'Get a support ticket and its comments' },
        },
      )
      .post(
        '/support/tickets/:ticketId/comments',
        ({ access, params, body }) => controller.addComment(access, params.ticketId, body.body),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          body: AddCommentBody,
          response: { 200: SupportTicketNoteResponse, ...CommonErrorResponses },
          detail: { tags: ['Support'], summary: 'Add a comment to a support ticket' },
        },
      )
      .post(
        '/support/tickets/:ticketId/reopen',
        ({ access, params }) => controller.reopen(access, params.ticketId),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          response: { 200: SupportTicketResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Support'],
            summary: 'Reopen a resolved support ticket',
            description: 'Only valid from RESOLVED status.',
          },
        },
      )
      .post(
        '/support/tickets/:ticketId/close',
        ({ access, params }) => controller.close(access, params.ticketId),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          response: { 200: SupportTicketResponse, ...CommonErrorResponses },
          detail: { tags: ['Support'], summary: 'Close a support ticket' },
        },
      )
      // --- Platform surface --------------------------------------------------
      .get(
        '/platform/support/tickets',
        ({ access, query }) =>
          controller.listForPlatform(
            access,
            {
              status: query.status,
              priority: query.priority,
              assignedToUserId: query.assignedToUserId,
            },
            query,
          ),
        {
          requireAuth: true,
          query: PlatformTicketListQuery,
          response: { 200: SupportTicketListResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'List support tickets for triage' },
        },
      )
      .get(
        '/platform/support/tickets/:ticketId',
        ({ access, params }) => controller.getForPlatform(access, params.ticketId),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          response: { 200: PlatformSupportTicketDetailResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Platform'],
            summary: 'Get a support ticket for triage',
            description: 'Includes staff-only internal notes.',
          },
        },
      )
      .post(
        '/platform/support/tickets/:ticketId/assign',
        ({ access, params, body }) =>
          controller.assign(access, params.ticketId, body.assignedToUserId),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          body: AssignTicketBody,
          response: { 200: SupportTicketResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Assign a support ticket to a staff member' },
        },
      )
      .post(
        '/platform/support/tickets/:ticketId/change-status',
        ({ access, params, body }) => controller.changeStatus(access, params.ticketId, body.status),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          body: ChangeStatusBody,
          response: { 200: SupportTicketResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Change a support ticket status' },
        },
      )
      .post(
        '/platform/support/tickets/:ticketId/set-priority',
        ({ access, params, body }) =>
          controller.setPriority(access, params.ticketId, body.priority),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          body: SetPriorityBody,
          response: { 200: SupportTicketResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Set a support ticket priority' },
        },
      )
      .post(
        '/platform/support/tickets/:ticketId/comments',
        ({ access, params, body }) =>
          controller.addStaffComment(access, params.ticketId, body.body),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          body: AddCommentBody,
          response: { 200: SupportTicketNoteResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Add a user-visible staff comment' },
        },
      )
      .post(
        '/platform/support/tickets/:ticketId/internal-notes',
        ({ access, params, body }) =>
          controller.addInternalNote(access, params.ticketId, body.body),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          body: AddCommentBody,
          response: { 200: SupportTicketNoteResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Platform'],
            summary: 'Add a staff-only internal note',
            description: 'Never exposed through any user-facing endpoint.',
          },
        },
      )
      .post(
        '/platform/support/tickets/:ticketId/resolve',
        ({ access, params, body }) =>
          controller.resolve(access, params.ticketId, body.resolutionSummary),
        {
          requireAuth: true,
          params: t.Object({ ticketId: Uuid }),
          body: ResolveTicketBody,
          response: { 200: SupportTicketResponse, ...CommonErrorResponses },
          detail: { tags: ['Platform'], summary: 'Resolve a support ticket' },
        },
      )
  )
}
