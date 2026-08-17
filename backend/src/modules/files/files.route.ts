import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { FilesController } from './files.controller'
import {
  ConfirmFileBody,
  FileAssetResponse,
  FileDownloadResponse,
  FileUploadAuthorizationBody,
  FileUploadAuthorizationResponse,
} from './files.dto'

export function filesRoutes(controller: FilesController, auth: AuthPlugin) {
  return new Elysia({ name: 'files-routes' })
    .use(auth)
    .post(
      '/files/upload-authorization',
      ({ access, body }) => controller.createUploadAuthorization(access, body),
      {
        requireAuth: true,
        body: FileUploadAuthorizationBody,
        response: { 200: FileUploadAuthorizationResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Files'],
          summary: 'Authorize a direct private document upload',
          description:
            'The signed request is tenant/resource-bound and requires every returned header. ' +
            'The object remains unavailable until confirmation and malware scanning complete.',
        },
      },
    )
    .post(
      '/files/confirm',
      async ({ access, body, set }) => {
        const result = await controller.confirm(access, body)
        set.status = 202
        return result
      },
      {
        requireAuth: true,
        body: ConfirmFileBody,
        response: { 202: FileAssetResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Files'],
          summary: 'Confirm an uploaded private document',
          description:
            'Inspects provider metadata and queues malware scanning; client metadata is not trusted.',
        },
      },
    )
    .get(
      '/files/:fileId/download',
      ({ access, params }) => controller.download(access, params.fileId),
      {
        requireAuth: true,
        params: t.Object({ fileId: Uuid }),
        response: { 200: FileDownloadResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Files'],
          summary: 'Get a short-lived private file download URL',
          description:
            'Available only after a clean scan and a fresh resource authorization check.',
        },
      },
    )
    .delete(
      '/files/:fileId',
      async ({ access, params, set }) => {
        await controller.remove(access, params.fileId)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ fileId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Files'],
          summary: 'Request asynchronous private file deletion',
        },
      },
    )
}
