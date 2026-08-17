import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { FileAssetRow } from './files.repository'
import type {
  FileConfirmationInput,
  FilesService,
  FileUploadAuthorizationInput,
} from './files.service'

export function createFilesController(service: FilesService) {
  return {
    async createUploadAuthorization(access: AccessContext, input: FileUploadAuthorizationInput) {
      requireActor(access)
      const result = await service.createUploadAuthorization(access, input)
      return { ...result, expiresAt: result.expiresAt.toISOString() }
    },

    async confirm(access: AccessContext, input: FileConfirmationInput) {
      requireActor(access)
      const result = await service.confirm(access, input)
      return serializeFile(result.file, result.scanStatus)
    },

    async download(access: AccessContext, fileId: string) {
      requireActor(access)
      const result = await service.getDownloadUrl(access, fileId)
      return { ...result, expiresAt: result.expiresAt.toISOString() }
    },

    async remove(access: AccessContext, fileId: string) {
      requireActor(access)
      await service.remove(access, fileId)
    },
  }
}

function serializeFile(
  file: FileAssetRow,
  scanStatus: 'QUARANTINED' | 'CLEAN' | 'INFECTED' | 'FAILED',
) {
  return {
    id: file.id,
    purpose: file.purpose,
    resourceType: file.resourceType,
    resourceId: file.resourceId,
    displayName: file.displayName,
    status: file.status,
    scanStatus,
    createdAt: file.createdAt.toISOString(),
  }
}

export type FilesController = ReturnType<typeof createFilesController>
