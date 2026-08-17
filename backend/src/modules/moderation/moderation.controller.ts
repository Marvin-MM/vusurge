import type { AccessContext } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type { ContentReportRow, ContentReportStatus } from './moderation.repository'
import type { CreateReportInput, ModerationService } from './moderation.service'

function serialize(row: ContentReportRow) {
  return {
    id: row.id,
    reporterUserId: row.reporterUserId,
    targetType: row.targetType,
    targetId: row.targetId,
    targetOrganizationId: row.targetOrganizationId,
    category: row.category,
    description: row.description,
    status: row.status,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    resolutionReason: row.resolutionReason,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializePage(page: Page<ContentReportRow>) {
  return { items: page.items.map(serialize), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

export function createModerationController(service: ModerationService) {
  return {
    async create(access: AccessContext, input: CreateReportInput) {
      const report = await service.create(access, input)
      return serialize(report)
    },

    async listMine(access: AccessContext, query: { limit?: number; cursor?: string }) {
      return serializePage(await service.listMine(access, query))
    },

    async listForPlatform(
      access: AccessContext,
      filters: { status?: ContentReportStatus },
      query: { limit?: number; cursor?: string },
    ) {
      return serializePage(await service.listForPlatform(access, filters, query))
    },

    async getForPlatform(access: AccessContext, reportId: string) {
      return serialize(await service.getForPlatform(access, reportId))
    },

    async dismiss(access: AccessContext, reportId: string, reason: string) {
      return serialize(await service.dismiss(access, reportId, reason))
    },

    async hideContent(access: AccessContext, reportId: string, reason: string) {
      return serialize(await service.hideContent(access, reportId, reason))
    },

    async restoreContent(access: AccessContext, reportId: string, reason: string) {
      return serialize(await service.restoreContent(access, reportId, reason))
    },

    async suspendOrganization(access: AccessContext, reportId: string, reason: string) {
      return serialize(await service.suspendOrganization(access, reportId, reason))
    },
  }
}

export type ModerationController = ReturnType<typeof createModerationController>
