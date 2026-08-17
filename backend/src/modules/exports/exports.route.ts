import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, IdempotencyKey, Uuid } from '../../shared/http'
import type { ExportsController } from './exports.controller'
import {
  CreateExportBody,
  DataExportListResponse,
  DataExportResponse,
  DownloadUrlResponse,
} from './exports.dto'

export function exportsRoutes(controller: ExportsController, auth: AuthPlugin) {
  return new Elysia({ name: 'exports-routes' })
    .use(auth)
    .post(
      '/organizations/:organizationId/exports',
      async ({ access, params, body, headers, set }) => {
        const result = await controller.create(
          access,
          params.organizationId,
          { exportType: body.exportType, filters: body.filters ?? {} },
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
        body: CreateExportBody,
        response: { 201: DataExportResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Exports'],
          summary: 'Request a data export',
          description: 'Generated asynchronously. Poll GET .../exports/:exportId for status.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/exports',
      ({ access, params, query }) => controller.list(access, params.organizationId, query),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 512 })),
        }),
        response: { 200: DataExportListResponse, ...CommonErrorResponses },
        detail: { tags: ['Exports'], summary: 'List data exports' },
      },
    )
    .get(
      '/organizations/:organizationId/exports/:exportId',
      ({ access, params }) => controller.get(access, params.organizationId, params.exportId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, exportId: Uuid }),
        response: { 200: DataExportResponse, ...CommonErrorResponses },
        detail: { tags: ['Exports'], summary: 'Get a data export' },
      },
    )
    .get(
      '/organizations/:organizationId/exports/:exportId/download',
      ({ access, params }) =>
        controller.getDownloadUrl(access, params.organizationId, params.exportId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, exportId: Uuid }),
        response: { 200: DownloadUrlResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Exports'],
          summary: 'Get a short-lived signed download URL',
          description: 'Only available once the export has completed.',
        },
      },
    )
    .delete(
      '/organizations/:organizationId/exports/:exportId',
      async ({ access, params, set }) => {
        await controller.remove(access, params.organizationId, params.exportId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, exportId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Exports'], summary: 'Delete a data export' },
      },
    )
}
