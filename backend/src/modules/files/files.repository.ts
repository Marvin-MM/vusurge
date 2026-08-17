import type { PrismaTransactionClient } from '../../shared/database'
import { newId } from '../../shared/ids'

export type FilePurpose = 'SUBMISSION_PRESENTATION' | 'SUPPORT_ATTACHMENT' | 'PORTFOLIO_EVIDENCE'
export type StoredObjectState =
  | 'PENDING_UPLOAD'
  | 'QUARANTINED'
  | 'CLEAN'
  | 'INFECTED'
  | 'FAILED'
  | 'PENDING_DELETION'
  | 'DELETED'
export type FileAssetState = 'ACTIVE' | 'PENDING_DELETION' | 'DELETED'

export interface StoredObjectRow {
  id: string
  organizationId: string
  challengeId: string | null
  ownerUserId: string
  purpose: FilePurpose
  resourceType: string
  resourceId: string
  displayName: string
  objectKey: string
  expectedContentType: string
  expectedBytes: number
  actualContentType: string | null
  actualBytes: number | null
  etag: string | null
  status: StoredObjectState
  scanDetail: string | null
  uploadExpiresAt: Date
  uploadedAt: Date | null
  scanStartedAt: Date | null
  scannedAt: Date | null
  deletionRequestedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FileAssetRow {
  id: string
  organizationId: string
  challengeId: string | null
  storedObjectId: string
  ownerUserId: string
  purpose: FilePurpose
  resourceType: string
  resourceId: string
  displayName: string
  status: FileAssetState
  createdAt: Date
  updatedAt: Date
}

export interface SubmissionFileResource {
  id: string
  submissionId: string
  teamId: string
  submissionStatus: string
  isCurrentDraft: boolean
  isTeamMember: boolean
  isAssignedJudge: boolean
}

export interface FilesRepository {
  resolveScope(
    tx: PrismaTransactionClient,
    fileId: string,
    userId: string,
  ): Promise<{ organizationId: string; challengeId: string | null } | null>
  reserveUpload(
    tx: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string | null
      ownerUserId: string
      purpose: FilePurpose
      resourceType: string
      resourceId: string
      displayName: string
      objectKey: string
      contentType: string
      bytes: number
      expiresAt: Date
    },
  ): Promise<StoredObjectRow | null>
  findStoredObject(
    tx: PrismaTransactionClient,
    organizationId: string,
    storedObjectId: string,
  ): Promise<StoredObjectRow | null>
  findFileAsset(
    tx: PrismaTransactionClient,
    organizationId: string,
    fileId: string,
  ): Promise<(FileAssetRow & { storedObject: StoredObjectRow }) | null>
  cancelPendingUpload(
    tx: PrismaTransactionClient,
    organizationId: string,
    storedObjectId: string,
  ): Promise<StoredObjectRow | null>
  confirmPendingUpload(
    tx: PrismaTransactionClient,
    input: {
      organizationId: string
      storedObjectId: string
      purpose: FilePurpose
      resourceType: string
      resourceId: string
      displayName: string
      bytes: number
      contentType: string
      etag: string | null
      now: Date
    },
  ): Promise<{ file: FileAssetRow; created: boolean } | null>
  requestDeletion(
    tx: PrismaTransactionClient,
    organizationId: string,
    fileId: string,
  ): Promise<(FileAssetRow & { storedObject: StoredObjectRow }) | null>
  claimScan(
    tx: PrismaTransactionClient,
    organizationId: string,
    fileId: string,
  ): Promise<(FileAssetRow & { storedObject: StoredObjectRow }) | null>
  completeScan(
    tx: PrismaTransactionClient,
    organizationId: string,
    fileId: string,
    clean: boolean,
    detail: string | null,
  ): Promise<boolean>
  failScan(
    tx: PrismaTransactionClient,
    organizationId: string,
    fileId: string,
    detail: string,
    terminal: boolean,
  ): Promise<void>
  markDeleted(tx: PrismaTransactionClient, organizationId: string, fileId: string): Promise<boolean>
  markUnclaimedDeleted(
    tx: PrismaTransactionClient,
    organizationId: string,
    storedObjectId: string,
  ): Promise<boolean>
  findSubmissionResource(
    tx: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    versionId: string,
    actorUserId: string,
  ): Promise<SubmissionFileResource | null>
}

export function createFilesRepository(): FilesRepository {
  return {
    async resolveScope(tx, fileId, userId) {
      const rows = await tx.$queryRaw<
        Array<{ organizationId: string; challengeId: string | null }>
      >`
        select organization_id as "organizationId", challenge_id as "challengeId"
        from app_resolve_file_context(${fileId}::uuid, ${userId}::uuid)
      `
      return rows[0] ?? null
    },

    async reserveUpload(tx, input) {
      await tx.$queryRaw`select organization_id from organization_limit
        where organization_id = ${input.organizationId}::uuid for update`

      const limits = await tx.organizationLimit.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (limits === null) return null

      const reservedCount = await tx.storedObject.count({
        where: { organizationId: input.organizationId, status: { not: 'DELETED' } },
      })
      const requestedBytes = BigInt(input.bytes)
      if (
        reservedCount >= limits.maxFileCount ||
        limits.storedBytes + limits.reservedBytes + requestedBytes > limits.maxStoredBytes
      ) {
        return null
      }

      await tx.organizationLimit.update({
        where: { organizationId: input.organizationId },
        data: { reservedBytes: { increment: requestedBytes } },
      })
      return tx.storedObject.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          ownerUserId: input.ownerUserId,
          purpose: input.purpose,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          displayName: input.displayName,
          objectKey: input.objectKey,
          expectedContentType: input.contentType,
          expectedBytes: input.bytes,
          uploadExpiresAt: input.expiresAt,
        },
      }) as unknown as Promise<StoredObjectRow>
    },

    async findStoredObject(tx, organizationId, storedObjectId) {
      return tx.storedObject.findFirst({
        where: { id: storedObjectId, organizationId },
      }) as unknown as Promise<StoredObjectRow | null>
    },

    async findFileAsset(tx, organizationId, fileId) {
      return tx.fileAsset.findFirst({
        where: { id: fileId, organizationId },
        include: { storedObject: true },
      }) as unknown as Promise<(FileAssetRow & { storedObject: StoredObjectRow }) | null>
    },

    async cancelPendingUpload(tx, organizationId, storedObjectId) {
      const rows = await tx.$queryRaw<StoredObjectRow[]>`
        update stored_object
        set status = 'PENDING_DELETION', deletion_requested_at = now(), updated_at = now()
        where id = ${storedObjectId}::uuid
          and organization_id = ${organizationId}::uuid
          and status = 'PENDING_UPLOAD'
        returning id, organization_id as "organizationId", challenge_id as "challengeId",
          owner_user_id as "ownerUserId", object_key as "objectKey",
          purpose, resource_type as "resourceType", resource_id as "resourceId",
          display_name as "displayName",
          expected_content_type as "expectedContentType", expected_bytes as "expectedBytes",
          actual_content_type as "actualContentType", actual_bytes as "actualBytes", etag,
          status, scan_detail as "scanDetail", upload_expires_at as "uploadExpiresAt",
          uploaded_at as "uploadedAt", scan_started_at as "scanStartedAt",
          scanned_at as "scannedAt", deletion_requested_at as "deletionRequestedAt",
          deleted_at as "deletedAt", created_at as "createdAt", updated_at as "updatedAt"
      `
      const row = rows[0]
      if (row === undefined) return null
      await tx.organizationLimit.update({
        where: { organizationId },
        data: { reservedBytes: { decrement: BigInt(row.expectedBytes) } },
      })
      return row
    },

    async confirmPendingUpload(tx, input) {
      await tx.$queryRaw`select id from stored_object
        where id = ${input.storedObjectId}::uuid
          and organization_id = ${input.organizationId}::uuid for update`

      const object = await tx.storedObject.findFirst({
        where: { id: input.storedObjectId, organizationId: input.organizationId },
      })
      if (object === null || object.status !== 'PENDING_UPLOAD') {
        const existing = await tx.fileAsset.findUnique({
          where: { storedObjectId: input.storedObjectId },
        })
        return existing === null
          ? null
          : { file: existing as unknown as FileAssetRow, created: false }
      }

      if (input.now > object.uploadExpiresAt) return null

      const fileId = newId()
      const file = await tx.fileAsset.create({
        data: {
          id: fileId,
          organizationId: input.organizationId,
          challengeId: object.challengeId,
          storedObjectId: object.id,
          ownerUserId: object.ownerUserId,
          purpose: input.purpose,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          displayName: input.displayName,
        },
      })

      if (input.purpose === 'SUBMISSION_PRESENTATION') {
        await tx.submissionAsset.create({
          data: {
            id: newId(),
            organizationId: input.organizationId,
            challengeId: object.challengeId as string,
            submissionVersionId: input.resourceId,
            kind: 'PRESENTATION_FILE',
            fileAssetId: fileId,
            displayName: input.displayName,
          },
        })
      }

      await tx.storedObject.update({
        where: { id: object.id },
        data: {
          status: 'QUARANTINED',
          actualBytes: input.bytes,
          actualContentType: input.contentType,
          etag: input.etag,
          uploadedAt: input.now,
        },
      })
      await tx.organizationLimit.update({
        where: { organizationId: input.organizationId },
        data: {
          reservedBytes: { decrement: BigInt(object.expectedBytes) },
          storedBytes: { increment: BigInt(input.bytes) },
          activeFileCount: { increment: 1 },
        },
      })
      return { file: file as unknown as FileAssetRow, created: true }
    },

    async requestDeletion(tx, organizationId, fileId) {
      await tx.$queryRaw`select id from file_asset
        where id = ${fileId}::uuid and organization_id = ${organizationId}::uuid for update`
      const current = await tx.fileAsset.findFirst({
        where: { id: fileId, organizationId },
        include: { storedObject: true },
      })
      if (current === null || current.status !== 'ACTIVE') return null
      await tx.fileAsset.update({ where: { id: fileId }, data: { status: 'PENDING_DELETION' } })
      await tx.storedObject.updateMany({
        where: { id: current.storedObjectId, status: { not: 'DELETED' } },
        data: { status: 'PENDING_DELETION', deletionRequestedAt: new Date() },
      })
      return current as unknown as FileAssetRow & { storedObject: StoredObjectRow }
    },

    async claimScan(tx, organizationId, fileId) {
      const claimed = await tx.storedObject.updateMany({
        where: {
          fileAsset: { id: fileId, organizationId },
          status: 'QUARANTINED',
          OR: [
            { scanStartedAt: null },
            { scanStartedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
          ],
        },
        data: { scanStartedAt: new Date(), scanDetail: null },
      })
      if (claimed.count !== 1) return null
      return tx.fileAsset.findFirst({
        where: { id: fileId, organizationId },
        include: { storedObject: true },
      }) as unknown as Promise<(FileAssetRow & { storedObject: StoredObjectRow }) | null>
    },

    async completeScan(tx, organizationId, fileId, clean, detail) {
      const updated = await tx.storedObject.updateMany({
        where: { organizationId, fileAsset: { id: fileId }, status: 'QUARANTINED' },
        data: {
          status: clean ? 'CLEAN' : 'INFECTED',
          scanDetail: detail,
          scannedAt: new Date(),
        },
      })
      return updated.count === 1
    },

    async failScan(tx, organizationId, fileId, detail, terminal) {
      await tx.storedObject.updateMany({
        where: { organizationId, fileAsset: { id: fileId }, status: 'QUARANTINED' },
        data: {
          status: terminal ? 'FAILED' : 'QUARANTINED',
          scanDetail: detail.slice(0, 500),
          scanStartedAt: null,
          ...(terminal ? { scannedAt: new Date() } : {}),
        },
      })
    },

    async markDeleted(tx, organizationId, fileId) {
      await tx.$queryRaw`select id from file_asset
        where id = ${fileId}::uuid and organization_id = ${organizationId}::uuid for update`
      const file = await tx.fileAsset.findFirst({
        where: { id: fileId, organizationId },
        include: { storedObject: true },
      })
      if (file === null || file.status === 'DELETED') return false
      if (file.status !== 'PENDING_DELETION') return false

      await tx.fileAsset.update({ where: { id: fileId }, data: { status: 'DELETED' } })
      await tx.storedObject.update({
        where: { id: file.storedObjectId },
        data: { status: 'DELETED', deletedAt: new Date() },
      })
      await tx.organizationLimit.update({
        where: { organizationId },
        data: {
          storedBytes: { decrement: BigInt(file.storedObject.actualBytes ?? 0) },
          activeFileCount: { decrement: 1 },
        },
      })
      return true
    },

    async markUnclaimedDeleted(tx, organizationId, storedObjectId) {
      const updated = await tx.storedObject.updateMany({
        where: {
          id: storedObjectId,
          organizationId,
          status: 'PENDING_DELETION',
          fileAsset: null,
        },
        data: { status: 'DELETED', deletedAt: new Date() },
      })
      return updated.count === 1
    },

    async findSubmissionResource(tx, organizationId, challengeId, versionId, actorUserId) {
      const rows = await tx.$queryRaw<SubmissionFileResource[]>`
        select sv.id, s.id as "submissionId", s.team_id as "teamId",
          s.status::text as "submissionStatus", (s.draft_version_id = sv.id) as "isCurrentDraft",
          exists (
            select 1 from challenge_team_member tm
            where tm.organization_id = s.organization_id
              and tm.challenge_id = s.challenge_id and tm.team_id = s.team_id
              and tm.user_id = ${actorUserId}::uuid
          ) as "isTeamMember",
          exists (
            select 1 from judge_assignment ja
            join challenge_staff_assignment sa
              on sa.id = ja.staff_assignment_id
             and sa.organization_id = ja.organization_id
             and sa.challenge_id = ja.challenge_id
            where ja.organization_id = s.organization_id
              and ja.challenge_id = s.challenge_id and ja.submission_id = s.id
              and ja.status = 'ASSIGNED' and sa.status = 'ACTIVE'
              and sa.user_id = ${actorUserId}::uuid
          ) as "isAssignedJudge"
        from submission_version sv
        join submission s on s.id = sv.submission_id
          and s.organization_id = sv.organization_id and s.challenge_id = sv.challenge_id
        where sv.id = ${versionId}::uuid
          and sv.organization_id = ${organizationId}::uuid
          and sv.challenge_id = ${challengeId}::uuid
        limit 1
      `
      return rows[0] ?? null
    },
  }
}
