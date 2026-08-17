import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, IdempotencyKey, Uuid } from '../../shared/http'
import type { InvitationsController } from './invitations.controller'
import { CreateInvitationBody, InvitationListResponse, InvitationResponse } from './invitations.dto'

export function invitationsRoutes(controller: InvitationsController, auth: AuthPlugin) {
  return new Elysia({ name: 'invitations-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId/invitations',
      ({ access, params, query }) => controller.list(access, params.organizationId, query),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        query: t.Object({ limit: t.Optional(t.Integer()), cursor: t.Optional(t.String()) }),
        response: { 200: InvitationListResponse, ...CommonErrorResponses },
        detail: { tags: ['Invitations'], summary: 'List organization invitations' },
      },
    )
    .post(
      '/organizations/:organizationId/invitations',
      async ({ access, params, body, headers, set }) => {
        const result = await controller.create(
          access,
          params.organizationId,
          body.email,
          body.role,
          headers['idempotency-key'],
        )
        set.status = result.status
        return result.body
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        headers: t.Object({ 'idempotency-key': IdempotencyKey }),
        body: CreateInvitationBody,
        response: { 201: InvitationResponse, ...CommonErrorResponses },
        detail: { tags: ['Invitations'], summary: 'Create an organization invitation' },
      },
    )
    .get(
      '/organizations/:organizationId/invitations/:invitationId',
      ({ access, params }) => controller.get(access, params.organizationId, params.invitationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, invitationId: Uuid }),
        response: { 200: InvitationResponse, ...CommonErrorResponses },
        detail: { tags: ['Invitations'], summary: 'Get an invitation' },
      },
    )
    .post(
      '/organizations/:organizationId/invitations/:invitationId/revoke',
      async ({ access, params, set }) => {
        await controller.revoke(access, params.organizationId, params.invitationId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, invitationId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Invitations'], summary: 'Revoke an invitation' },
      },
    )
    .post(
      '/organizations/:organizationId/invitations/:invitationId/resend',
      async ({ access, params, set }) => {
        await controller.resend(access, params.organizationId, params.invitationId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, invitationId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Invitations'],
          summary: 'Resend an invitation',
          description: 'Issues a fresh token; the previous link stops working.',
        },
      },
    )
    .post(
      '/invitations/:token/accept',
      ({ access, params }) => controller.accept(access, params.token),
      {
        requireAuth: true,
        params: t.Object({ token: t.String({ minLength: 16, maxLength: 512 }) }),
        response: {
          200: t.Object({ organizationId: Uuid, organizationSlug: t.String() }),
          ...CommonErrorResponses,
        },
        detail: { tags: ['Invitations'], summary: 'Accept an invitation by token' },
      },
    )
    .post(
      '/invitations/:token/decline',
      async ({ access, params, set }) => {
        await controller.decline(access, params.token)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ token: t.String({ minLength: 16, maxLength: 512 }) }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Invitations'], summary: 'Decline an invitation by token' },
      },
    )
}
