import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, PaginationQuery, Uuid } from '../../shared/http'
import type { JoinRequestsController } from './join-requests.controller'
import {
  CreateJoinRequestBody,
  JoinRequestListQuery,
  JoinRequestListResponse,
  JoinRequestResponse,
  RejectJoinRequestBody,
} from './join-requests.dto'

export function joinRequestsRoutes(controller: JoinRequestsController, auth: AuthPlugin) {
  return new Elysia({ name: 'join-requests-routes' })
    .use(auth)
    .post(
      '/organizations/:organizationId/join-requests',
      ({ access, params, body }) => controller.create(access, params.organizationId, body.message),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: CreateJoinRequestBody,
        response: { 200: JoinRequestResponse, ...CommonErrorResponses },
        detail: { tags: ['Join Requests'], summary: 'Request to join an organization' },
      },
    )
    .get(
      '/me/organization-join-requests',
      ({ access, query }) => controller.listMine(access, query),
      {
        requireAuth: true,
        query: PaginationQuery,
        response: { 200: JoinRequestListResponse, ...CommonErrorResponses },
        detail: { tags: ['Join Requests'], summary: "The caller's own join requests" },
      },
    )
    .post(
      '/organizations/:organizationId/join-requests/:requestId/withdraw',
      async ({ access, params, set }) => {
        await controller.withdraw(access, params.organizationId, params.requestId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, requestId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Join Requests'], summary: 'Withdraw a join request' },
      },
    )
    .get(
      '/organizations/:organizationId/join-requests',
      ({ access, params, query }) =>
        controller.list(access, params.organizationId, query.status, query),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        query: JoinRequestListQuery,
        response: { 200: JoinRequestListResponse, ...CommonErrorResponses },
        detail: { tags: ['Join Requests'], summary: 'List join requests for review' },
      },
    )
    .get(
      '/organizations/:organizationId/join-requests/:requestId',
      ({ access, params }) => controller.get(access, params.organizationId, params.requestId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, requestId: Uuid }),
        response: { 200: JoinRequestResponse, ...CommonErrorResponses },
        detail: { tags: ['Join Requests'], summary: 'Get a join request' },
      },
    )
    .post(
      '/organizations/:organizationId/join-requests/:requestId/approve',
      async ({ access, params, set }) => {
        await controller.approve(access, params.organizationId, params.requestId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, requestId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Join Requests'], summary: 'Approve a join request' },
      },
    )
    .post(
      '/organizations/:organizationId/join-requests/:requestId/reject',
      async ({ access, params, body, set }) => {
        await controller.reject(
          access,
          params.organizationId,
          params.requestId,
          body.reason,
          body.internalNotes,
        )
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, requestId: Uuid }),
        body: RejectJoinRequestBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Join Requests'], summary: 'Reject a join request' },
      },
    )
}
