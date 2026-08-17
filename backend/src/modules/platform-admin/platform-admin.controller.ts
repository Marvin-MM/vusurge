import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { OrganizationRow } from '../organizations/organizations.repository'
import type { PlatformAdminService } from './platform-admin.service'

function serialize(row: OrganizationRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    organizationType: row.organizationType,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createPlatformAdminController(service: PlatformAdminService) {
  return {
    async listOrganizations(
      access: AccessContext,
      status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | undefined,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.listOrganizations(access, status, query)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async getOrganization(access: AccessContext, organizationId: string) {
      requireActor(access)
      return serialize(await service.getOrganization(access, organizationId))
    },

    async suspend(access: AccessContext, organizationId: string, reason: string) {
      requireActor(access)
      await service.suspend(access, organizationId, reason)
    },

    async reinstate(access: AccessContext, organizationId: string, reason: string) {
      requireActor(access)
      await service.reinstate(access, organizationId, reason)
    },

    async archive(access: AccessContext, organizationId: string, reason: string) {
      requireActor(access)
      await service.archive(access, organizationId, reason)
    },

    async getAuditSummary(access: AccessContext, organizationId: string) {
      requireActor(access)
      const summary = await service.getAuditSummary(access, organizationId)
      return {
        totalEvents: summary.totalEvents,
        firstEventAt: summary.firstEventAt?.toISOString() ?? null,
        lastEventAt: summary.lastEventAt?.toISOString() ?? null,
        topActions: summary.topActions,
      }
    },
  }
}

export type PlatformAdminController = ReturnType<typeof createPlatformAdminController>
