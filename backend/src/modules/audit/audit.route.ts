import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { AuditController } from './audit.controller'
import { AuditEventListResponse, AuditEventResponse, PlatformAuditListQuery } from './audit.dto'

export function auditRoutes(controller: AuditController, auth: AuthPlugin) {
  return new Elysia({ name: 'audit-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId/audit',
      ({ access, params, query }) =>
        controller.listForOrganization(access, params.organizationId, query),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 512 })),
        }),
        response: { 200: AuditEventListResponse, ...CommonErrorResponses },
        detail: { tags: ['Audit'], summary: "List an organization's audit events" },
      },
    )
    .get(
      '/organizations/:organizationId/audit/:auditEventId',
      ({ access, params }) =>
        controller.getForOrganization(access, params.organizationId, params.auditEventId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, auditEventId: Uuid }),
        response: { 200: AuditEventResponse, ...CommonErrorResponses },
        detail: { tags: ['Audit'], summary: 'Get a single audit event' },
      },
    )
    .get(
      '/platform/audit',
      ({ access, query }) =>
        controller.listForPlatform(access, { organizationId: query.organizationId }, query),
      {
        requireAuth: true,
        query: PlatformAuditListQuery,
        response: { 200: AuditEventListResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Platform'],
          summary: 'List platform-wide audit events',
          description:
            'Restricted to PLATFORM_SUPERADMIN. Viewing this itself writes an audit entry.',
        },
      },
    )
    .get(
      '/platform/audit/:auditEventId',
      ({ access, params }) => controller.getForPlatform(access, params.auditEventId),
      {
        requireAuth: true,
        params: t.Object({ auditEventId: Uuid }),
        response: { 200: AuditEventResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Platform'],
          summary: 'Get a single platform audit event',
          description:
            'Restricted to PLATFORM_SUPERADMIN. Viewing this itself writes an audit entry.',
        },
      },
    )
}
