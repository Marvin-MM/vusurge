import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { PlatformAdminController } from './platform-admin.controller'
import {
  AuditSummaryResponse,
  PlatformArchiveOrganizationBody,
  PlatformOrganizationListQuery,
  PlatformOrganizationListResponse,
  PlatformOrganizationResponse,
  ReinstateOrganizationBody,
  SuspendOrganizationBody,
} from './platform-admin.dto'

export function platformAdminRoutes(controller: PlatformAdminController, auth: AuthPlugin) {
  return new Elysia({ name: 'platform-admin-routes', prefix: '/platform' })
    .use(auth)
    .get(
      '/organizations',
      ({ access, query }) => controller.listOrganizations(access, query.status, query),
      {
        requireAuth: true,
        query: PlatformOrganizationListQuery,
        response: { 200: PlatformOrganizationListResponse, ...CommonErrorResponses },
        detail: { tags: ['Platform'], summary: 'List every organization on the platform' },
      },
    )
    .get(
      '/organizations/:organizationId',
      ({ access, params }) => controller.getOrganization(access, params.organizationId),
      {
        requireAuth: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: PlatformOrganizationResponse, ...CommonErrorResponses },
        detail: { tags: ['Platform'], summary: 'Get any organization' },
      },
    )
    .post(
      '/organizations/:organizationId/suspend',
      async ({ access, params, body, set }) => {
        await controller.suspend(access, params.organizationId, body.reason)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ organizationId: Uuid }),
        body: SuspendOrganizationBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Platform'],
          summary: 'Suspend an organization',
          description:
            'Requires a fresh session. An organization owner cannot override a suspension.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/reinstate',
      async ({ access, params, body, set }) => {
        await controller.reinstate(access, params.organizationId, body.reason)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ organizationId: Uuid }),
        body: ReinstateOrganizationBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Platform'], summary: 'Reinstate a suspended organization' },
      },
    )
    .post(
      '/organizations/:organizationId/archive',
      async ({ access, params, body, set }) => {
        await controller.archive(access, params.organizationId, body.reason)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ organizationId: Uuid }),
        body: PlatformArchiveOrganizationBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Platform'], summary: 'Archive an organization (platform action)' },
      },
    )
    .get(
      '/organizations/:organizationId/audit-summary',
      ({ access, params }) => controller.getAuditSummary(access, params.organizationId),
      {
        requireAuth: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: AuditSummaryResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Platform'],
          summary: "An organization's audit summary",
          description:
            'A safe operational summary (event count, first/last activity, top action types) — ' +
            'restricted to PLATFORM_SUPERADMIN via the same Permission.PlatformViewAudit gate as ' +
            'every other platform audit read, not a bypass of normal audit access control.',
        },
      },
    )
}
