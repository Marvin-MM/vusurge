import type { AccessContext } from '../../shared/authorization'
import { badRequest } from '../../shared/errors'
import type { Page } from '../../shared/http'
import type { IdempotencyStore } from '../../shared/idempotency'
import type { DataExportRow } from './exports.repository'
import type { CreateExportInput, ExportsService } from './exports.service'

function serialize(row: DataExportRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestedByUserId: row.requestedByUserId,
    exportType: row.exportType,
    filters: row.filters,
    status: row.status,
    storageKey: row.storageKey,
    fileSizeBytes: row.fileSizeBytes,
    rowCount: row.rowCount,
    failureReason: row.failureReason,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializePage(page: Page<DataExportRow>) {
  return { items: page.items.map(serialize), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

export function createExportsController(service: ExportsService, idempotency: IdempotencyStore) {
  return {
    async create(
      access: AccessContext,
      organizationId: string,
      input: CreateExportInput,
      idempotencyKey: string | undefined,
    ) {
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw badRequest('An authenticated actor is required.')
      if (idempotencyKey === undefined) {
        throw badRequest('An Idempotency-Key header is required for this operation.')
      }
      await service.prepareCreate(access, organizationId)
      const result = await idempotency.run(
        {
          actorUserId,
          operation: 'export.create',
          key: idempotencyKey,
          requestBody: { organizationId, ...input },
          organizationId,
        },
        async (tx) => ({
          status: 201,
          body: serialize(await service.create(access, organizationId, input, tx)),
        }),
      )
      return { status: result.status, body: result.value }
    },

    async list(
      access: AccessContext,
      organizationId: string,
      query: { limit?: number; cursor?: string },
    ) {
      return serializePage(await service.list(access, organizationId, query))
    },

    async get(access: AccessContext, organizationId: string, exportId: string) {
      return serialize(await service.get(access, organizationId, exportId))
    },

    async getDownloadUrl(access: AccessContext, organizationId: string, exportId: string) {
      return service.getDownloadUrl(access, organizationId, exportId)
    },

    async remove(access: AccessContext, organizationId: string, exportId: string) {
      await service.remove(access, organizationId, exportId)
    },
  }
}

export type ExportsController = ReturnType<typeof createExportsController>
