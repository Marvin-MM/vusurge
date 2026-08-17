import type { AccessContext } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type { AuditEventRow, PlatformAuditFilters } from './audit.repository'
import type { AuditService } from './audit.service'

function serialize(row: AuditEventRow) {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

function serializePage(page: Page<AuditEventRow>) {
  return { items: page.items.map(serialize), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

export function createAuditController(service: AuditService) {
  return {
    async listForOrganization(
      access: AccessContext,
      organizationId: string,
      query: { limit?: number; cursor?: string },
    ) {
      return serializePage(await service.listForOrganization(access, organizationId, query))
    },

    async getForOrganization(access: AccessContext, organizationId: string, auditEventId: string) {
      return serialize(await service.getForOrganization(access, organizationId, auditEventId))
    },

    async listForPlatform(
      access: AccessContext,
      filters: PlatformAuditFilters,
      query: { limit?: number; cursor?: string },
    ) {
      return serializePage(await service.listForPlatform(access, filters, query))
    },

    async getForPlatform(access: AccessContext, auditEventId: string) {
      return serialize(await service.getForPlatform(access, auditEventId))
    },
  }
}

export type AuditController = ReturnType<typeof createAuditController>
