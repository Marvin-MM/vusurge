import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { MembershipsController } from './memberships.controller'
import {
  ChangeRoleBody,
  MemberListQuery,
  MemberListResponse,
  MemberResponse,
  ReactivateBody,
} from './memberships.dto'

export function membershipsRoutes(controller: MembershipsController, auth: AuthPlugin) {
  return new Elysia({ name: 'memberships-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId/members',
      ({ access, params, query }) => controller.list(access, params.organizationId, query),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        query: MemberListQuery,
        response: { 200: MemberListResponse, ...CommonErrorResponses },
        detail: { tags: ['Memberships'], summary: 'List organization members' },
      },
    )
    .get(
      '/organizations/:organizationId/members/:userId',
      ({ access, params }) => controller.get(access, params.organizationId, params.userId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, userId: Uuid }),
        response: { 200: MemberResponse, ...CommonErrorResponses },
        detail: { tags: ['Memberships'], summary: 'Get one member' },
      },
    )
    .post(
      '/organizations/:organizationId/members/:userId/change-role',
      async ({ access, params, body, set }) => {
        await controller.changeRole(access, params.organizationId, params.userId, body.role)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, userId: Uuid }),
        body: ChangeRoleBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Memberships'],
          summary: "Change a member's role",
          description:
            "Enforces the role-assignment ceiling (never above the caller's own role) and the " +
            'last-active-owner invariant.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/members/:userId/remove',
      async ({ access, params, set }) => {
        await controller.remove(access, params.organizationId, params.userId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, userId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Memberships'], summary: 'Remove a member' },
      },
    )
    .post(
      '/organizations/:organizationId/members/:userId/reactivate',
      async ({ access, params, body, set }) => {
        await controller.reactivate(access, params.organizationId, params.userId, body.role)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, userId: Uuid }),
        body: ReactivateBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Memberships'], summary: 'Reactivate a removed member' },
      },
    )
}
