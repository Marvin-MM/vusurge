import type { PrismaTransactionClient } from '../../shared/database'

export type MediaAssetPurpose =
  | 'USER_AVATAR'
  | 'ORGANIZATION_LOGO'
  | 'CHALLENGE_COVER'
  | 'SPONSOR_LOGO'
  | 'SUBMISSION_SCREENSHOT'
  | 'SUPPORT_TICKET_SCREENSHOT'
  | 'PORTFOLIO_EVIDENCE'

export type MediaAssetStatus = 'PENDING' | 'CONFIRMED' | 'PENDING_DELETION' | 'DELETED'
export type MediaAssetDeliveryType = 'UPLOAD' | 'AUTHENTICATED'

export interface MediaAssetRow {
  id: string
  purpose: MediaAssetPurpose
  status: MediaAssetStatus
  deliveryType: MediaAssetDeliveryType
  organizationId: string | null
  challengeId: string | null
  ownerUserId: string
  resourceType: string
  resourceId: string
  cloudinaryPublicId: string
  format: string | null
  bytes: number | null
  width: number | null
  height: number | null
  expiresAt: Date
  confirmedAt: Date | null
  deletionRequestedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
}

export interface CreatePendingAssetInput {
  id: string
  purpose: MediaAssetPurpose
  deliveryType: MediaAssetDeliveryType
  organizationId?: string
  challengeId?: string
  ownerUserId: string
  resourceType: string
  resourceId: string
  cloudinaryPublicId: string
  expiresAt: Date
}

export interface MediaAttachmentExpectation {
  purpose: MediaAssetPurpose
  organizationId: string | null
  challengeId: string | null
  resourceType: string
  resourceId: string
  ownerUserId?: string
}

/** Application-level validation for a friendly 400 response; database
 * attachment triggers repeat this invariant as the race-safe final guard. */
export function isConfirmedMediaBinding(
  asset: MediaAssetRow | null,
  expected: MediaAttachmentExpectation,
): asset is MediaAssetRow {
  return (
    asset !== null &&
    asset.status === 'CONFIRMED' &&
    asset.purpose === expected.purpose &&
    asset.organizationId === expected.organizationId &&
    asset.challengeId === expected.challengeId &&
    asset.resourceType === expected.resourceType &&
    asset.resourceId === expected.resourceId &&
    (expected.ownerUserId === undefined || asset.ownerUserId === expected.ownerUserId)
  )
}

/**
 * Every call receives a transaction client whose tenant or actor context was
 * selected from the exact-ID media scope resolver. The repository never uses
 * an ambient Prisma client, so PostgreSQL RLS remains active for reads and
 * compare-and-set mutations as well as service-layer purpose authorization.
 */
export interface MediaRepository {
  createPending(
    client: PrismaTransactionClient,
    input: CreatePendingAssetInput,
  ): Promise<MediaAssetRow>
  findById(client: PrismaTransactionClient, id: string): Promise<MediaAssetRow | null>
  confirmPending(
    client: PrismaTransactionClient,
    id: string,
    metadata: { format: string; bytes: number; width: number; height: number },
  ): Promise<MediaAssetRow | null>
  requestDeletion(client: PrismaTransactionClient, id: string): Promise<MediaAssetRow | null>
  markDeleted(client: PrismaTransactionClient, id: string): Promise<MediaAssetRow | null>
}

export function createMediaRepository(): MediaRepository {
  return {
    async createPending(client, input) {
      return client.mediaAsset.create({
        data: {
          id: input.id,
          purpose: input.purpose,
          deliveryType: input.deliveryType,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          ownerUserId: input.ownerUserId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          cloudinaryPublicId: input.cloudinaryPublicId,
          expiresAt: input.expiresAt,
        },
      })
    },

    async findById(client, id) {
      return client.mediaAsset.findUnique({ where: { id } })
    },

    async confirmPending(client, id, metadata) {
      const changed = await client.mediaAsset.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          format: metadata.format,
          bytes: metadata.bytes,
          width: metadata.width,
          height: metadata.height,
        },
      })
      return changed.count === 1 ? client.mediaAsset.findUnique({ where: { id } }) : null
    },

    async requestDeletion(client, id) {
      const changed = await client.mediaAsset.updateMany({
        where: { id, status: { in: ['PENDING', 'CONFIRMED'] } },
        data: { status: 'PENDING_DELETION', deletionRequestedAt: new Date() },
      })
      return changed.count === 1 ? client.mediaAsset.findUnique({ where: { id } }) : null
    },

    async markDeleted(client, id) {
      const changed = await client.mediaAsset.updateMany({
        where: { id, status: 'PENDING_DELETION' },
        data: { status: 'DELETED', deletedAt: new Date() },
      })
      return changed.count === 1 ? client.mediaAsset.findUnique({ where: { id } }) : null
    },
  }
}
