import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { JoinCodesController } from './join-codes.controller'
import {
  CreatedJoinCodeResponse,
  CreateJoinCodeBody,
  JoinCodeListResponse,
  RedeemJoinCodeBody,
} from './join-codes.dto'

export function joinCodesRoutes(controller: JoinCodesController, auth: AuthPlugin) {
  return new Elysia({ name: 'join-codes-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId/join-codes',
      ({ access, params }) => controller.list(access, params.organizationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: JoinCodeListResponse, ...CommonErrorResponses },
        detail: { tags: ['Join Codes'], summary: 'List organization join codes' },
      },
    )
    .post(
      '/organizations/:organizationId/join-codes',
      ({ access, params, body }) => controller.create(access, params.organizationId, body),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: CreateJoinCodeBody,
        response: { 200: CreatedJoinCodeResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Join Codes'],
          summary: 'Create a join code',
          description: 'The plaintext code is returned exactly once, in this response.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/join-codes/:joinCodeId/revoke',
      async ({ access, params, set }) => {
        await controller.revoke(access, params.organizationId, params.joinCodeId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, joinCodeId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Join Codes'], summary: 'Revoke a join code' },
      },
    )
    .post('/join-codes/redeem', ({ access, body }) => controller.redeem(access, body.code), {
      requireAuth: true,
      body: RedeemJoinCodeBody,
      response: {
        200: t.Object({ organizationId: Uuid, organizationSlug: t.String() }),
        ...CommonErrorResponses,
      },
      detail: {
        tags: ['Join Codes'],
        summary: 'Redeem a join code',
        description:
          'Heavily rate-limited: this is the most brute-forceable surface in the product.',
      },
    })
}
