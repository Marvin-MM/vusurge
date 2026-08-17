import { createFilesRepository } from '../../modules/files/files.repository'
import { AuditAction } from '../../shared/audit'
import type { JobHandler } from '../job-router'

interface FileJobPayload {
  organizationId: string
  fileId?: string
  storedObjectId?: string
}

const repository = createFilesRepository()

export const handleFileScanRequested: JobHandler = async (context) => {
  const payload = context.payload as unknown as FileJobPayload
  if (typeof payload.organizationId !== 'string' || typeof payload.fileId !== 'string') {
    throw new Error('File scan job is missing organizationId or fileId.')
  }

  const { transactions, objectStorage, fileScanner, config, audit } = context.infrastructure
  const claimed = await transactions.withTenant(payload.organizationId, (tx) =>
    repository.claimScan(tx, payload.organizationId, payload.fileId as string),
  )
  if (claimed === null) {
    const current = await transactions.withTenant(payload.organizationId, (tx) =>
      repository.findFileAsset(tx, payload.organizationId, payload.fileId as string),
    )
    if (
      current === null ||
      ['CLEAN', 'INFECTED', 'FAILED', 'DELETED', 'PENDING_DELETION'].includes(
        current.storedObject.status,
      )
    ) {
      return
    }
    throw new Error(`File ${payload.fileId} is already being scanned.`)
  }

  try {
    const bytes = await objectStorage.readObject(
      claimed.storedObject.objectKey,
      config.uploads.maxDocumentBytes,
    )
    const result = await fileScanner.scan(bytes)
    await transactions.withTenant(payload.organizationId, async (tx) => {
      const changed = await repository.completeScan(
        tx,
        payload.organizationId,
        payload.fileId as string,
        result.clean,
        result.signature,
      )
      if (changed && result.clean) {
        await audit.write(tx, {
          organizationId: payload.organizationId,
          actorType: 'SYSTEM',
          action: AuditAction.FileUploaded,
          resourceType: 'file_asset',
          resourceId: payload.fileId,
          summary: 'Private file passed malware scanning and became available.',
        })
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const terminal = context.attempt >= config.worker.outbox.maxAttempts
    await transactions.withTenant(payload.organizationId, (tx) =>
      repository.failScan(tx, payload.organizationId, payload.fileId as string, message, terminal),
    )
    throw error
  }
}

export const handleFileDeletionRequested: JobHandler = async (context) => {
  const payload = context.payload as unknown as FileJobPayload
  if (typeof payload.organizationId !== 'string' || typeof payload.storedObjectId !== 'string') {
    throw new Error('File deletion job is missing organizationId or storedObjectId.')
  }

  const { transactions, objectStorage, audit } = context.infrastructure
  const object = await transactions.withTenant(payload.organizationId, (tx) =>
    repository.findStoredObject(tx, payload.organizationId, payload.storedObjectId as string),
  )
  if (object === null || object.status === 'DELETED') return
  if (object.status !== 'PENDING_DELETION') {
    throw new Error(`Stored object ${payload.storedObjectId} is not pending deletion.`)
  }

  await objectStorage.deleteObject(object.objectKey)
  await transactions.withTenant(payload.organizationId, async (tx) => {
    const changed =
      typeof payload.fileId === 'string'
        ? await repository.markDeleted(tx, payload.organizationId, payload.fileId)
        : await repository.markUnclaimedDeleted(
            tx,
            payload.organizationId,
            payload.storedObjectId as string,
          )
    if (changed && typeof payload.fileId === 'string') {
      await audit.write(tx, {
        organizationId: payload.organizationId,
        actorType: 'SYSTEM',
        action: AuditAction.FileDeleted,
        resourceType: 'file_asset',
        resourceId: payload.fileId,
        summary: 'Deleted a private file from object storage and retained its tombstone.',
      })
    }
  })
}
