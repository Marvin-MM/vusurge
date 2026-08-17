import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { MediaAssetRow } from './media.repository'
import type { MediaService, UploadAuthorizationInput } from './media.service'

function serializeAsset(row: MediaAssetRow) {
  return {
    id: row.id,
    purpose: row.purpose,
    status: row.status,
    format: row.format,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createMediaController(service: MediaService) {
  return {
    async createUploadAuthorization(access: AccessContext, input: UploadAuthorizationInput) {
      requireActor(access)
      const result = await service.createUploadAuthorization(access, input)
      return { ...result, expiresAt: result.expiresAt.toISOString() }
    },

    async confirm(access: AccessContext, assetId: string) {
      requireActor(access)
      const row = await service.confirm(access, assetId)
      return serializeAsset(row)
    },

    async getDeliveryUrl(access: AccessContext, assetId: string) {
      requireActor(access)
      const delivery = await service.getDeliveryUrl(access, assetId)
      return {
        url: delivery.url,
        expiresAt: delivery.expiresAt?.toISOString() ?? null,
      }
    },

    async getPublicDeliveryUrl(assetId: string, ipAddress: string | undefined) {
      const delivery = await service.getPublicDeliveryUrl(assetId, ipAddress)
      return {
        url: delivery.url,
        expiresAt: delivery.expiresAt?.toISOString() ?? null,
      }
    },

    async remove(access: AccessContext, assetId: string) {
      requireActor(access)
      await service.remove(access, assetId)
    },
  }
}

export type MediaController = ReturnType<typeof createMediaController>
