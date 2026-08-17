import { createMediaRepository } from '../../modules/media/media.repository'
import type { JobHandler } from '../job-router'

interface MediaDeletionRequestedPayload {
  assetId: string
}

const repository = createMediaRepository()

/**
 * Removes a provider object only after the durable tombstone and outbox event
 * have committed. Retrying a provider deletion is safe; the database state is
 * advanced with a compare-and-set so duplicate deliveries stay idempotent.
 */
export const handleMediaAssetDeletionRequested: JobHandler = async (context) => {
  const { assetId } = context.payload as unknown as MediaDeletionRequestedPayload
  if (typeof assetId !== 'string') throw new Error('Media cleanup job is missing assetId.')

  const { imageProvider, transactions } = context.infrastructure
  const asset = await transactions.withPlatformAccess((tx) => repository.findById(tx, assetId), {
    purpose: 'media cleanup: resolve one tombstoned provider asset',
  })
  if (asset === null || asset.status === 'DELETED') return
  if (asset.status !== 'PENDING_DELETION') {
    throw new Error(`Media asset ${assetId} is not pending deletion.`)
  }

  const deliveryType = asset.deliveryType === 'UPLOAD' ? 'upload' : 'authenticated'
  await imageProvider.destroy(asset.cloudinaryPublicId, deliveryType)

  const markDeleted = async (): Promise<void> => {
    if (asset.organizationId === null) {
      await transactions.withPlatformAccess((tx) => repository.markDeleted(tx, assetId), {
        purpose: 'media cleanup: complete deletion of a user-owned asset',
      })
    } else {
      await transactions.withTenant(asset.organizationId, (tx) =>
        repository.markDeleted(tx, assetId),
      )
    }
  }
  await markDeleted()
}
