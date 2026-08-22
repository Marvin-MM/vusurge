import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext, AccessContextResolver } from '../../shared/authorization'
import {
  checkPermission,
  Permission,
  requireFreshActor,
  requireVerifiedActor,
} from '../../shared/authorization'
import type { AppConfig } from '../../shared/config/config.schema'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import {
  badRequest,
  conflict,
  ErrorCode,
  featureDisabled,
  forbidden,
  notFound,
} from '../../shared/errors'
import type { FileScanner } from '../../shared/file-scanning'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type { ObjectStorage } from '../../shared/storage'
import type {
  FileAssetRow,
  FilePurpose,
  FilesRepository,
  StoredObjectRow,
} from './files.repository'

const RESOURCE_TYPE: Readonly<Record<FilePurpose, string>> = {
  SUBMISSION_PRESENTATION: 'submission_version',
  SUPPORT_ATTACHMENT: 'support_ticket',
  PORTFOLIO_EVIDENCE: 'innovation',
  FORM_ATTACHMENT: 'form_definition',
}

const EXTENSIONS_BY_MIME: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/csv': ['.csv'],
}

export interface FileUploadAuthorizationInput {
  purpose: FilePurpose
  organizationId: string
  challengeId?: string
  resourceId: string
  fileName: string
  contentType: string
  bytes: number
}

export interface FileUploadAuthorizationResult {
  storedObjectId: string
  uploadUrl: string
  requiredHeaders: Readonly<Record<string, string>>
  expiresAt: Date
}

export interface FileConfirmationInput {
  organizationId: string
  storedObjectId: string
}

export interface ConfirmedFile {
  file: FileAssetRow
  scanStatus: 'QUARANTINED' | 'CLEAN' | 'INFECTED' | 'FAILED'
}

export interface FilesService {
  createUploadAuthorization(
    access: AccessContext,
    input: FileUploadAuthorizationInput,
  ): Promise<FileUploadAuthorizationResult>
  confirm(access: AccessContext, input: FileConfirmationInput): Promise<ConfirmedFile>
  getDownloadUrl(
    access: AccessContext,
    fileId: string,
  ): Promise<{ downloadUrl: string; expiresAt: Date }>
  remove(access: AccessContext, fileId: string): Promise<void>
}

function cleanFileName(value: string): string {
  const name = value
    .normalize('NFC')
    .split('')
    .map((character) => {
      const codePoint = character.charCodeAt(0)
      return character === '/' || character === '\\' || codePoint < 32 || codePoint === 127
        ? '_'
        : character
    })
    .join('')
    .trim()
  if (name.length === 0 || name.length > 255 || name === '.' || name === '..') {
    throw badRequest('A valid file name of at most 255 characters is required.')
  }
  return name
}

function validateDocument(input: FileUploadAuthorizationInput, config: AppConfig): string {
  if (input.bytes < 1 || input.bytes > config.uploads.maxDocumentBytes) {
    throw badRequest(`The file must be between 1 and ${config.uploads.maxDocumentBytes} bytes.`)
  }
  if (!config.uploads.allowedDocumentMimeTypes.includes(input.contentType)) {
    throw badRequest('This document type is not allowed.')
  }
  const fileName = cleanFileName(input.fileName)
  const extensions = EXTENSIONS_BY_MIME[input.contentType]
  if (
    extensions === undefined ||
    !extensions.some((extension) => fileName.toLowerCase().endsWith(extension))
  ) {
    throw badRequest('The file extension does not match the declared document type.')
  }
  if (input.purpose === 'SUBMISSION_PRESENTATION' && input.challengeId === undefined) {
    throw badRequest('A submission presentation requires a challenge context.')
  }
  return fileName
}

function permission(access: AccessContext, requested: Permission): boolean {
  return checkPermission(access, requested).allowed
}

export function createFilesService(
  repository: FilesRepository,
  resolver: AccessContextResolver,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  objectStorage: ObjectStorage,
  scanner: FileScanner,
  rateLimiter: RateLimiter,
  config: AppConfig,
): FilesService {
  async function scopedAccess(
    access: AccessContext,
    organizationId: string,
    challengeId?: string | null,
  ): Promise<AccessContext> {
    const actor = requireVerifiedActor(access).actor
    const organization = await resolver.resolveOrganization(organizationId, actor.userId)
    if (organization === null) throw notFound()
    if (challengeId === undefined || challengeId === null) return { ...access, organization }
    const challenge = await resolver.resolveChallenge(challengeId, organizationId, actor.userId)
    if (challenge === null) throw notFound()
    return { ...access, organization, challenge }
  }

  async function authorizeResource(
    tx: PrismaTransactionClient,
    access: AccessContext,
    purpose: FilePurpose,
    organizationId: string,
    challengeId: string | null,
    resourceId: string,
    operation: 'manage' | 'download',
  ): Promise<void> {
    const actor = requireVerifiedActor(access).actor

    if (purpose === 'SUBMISSION_PRESENTATION') {
      if (challengeId === null) throw notFound()
      const resource = await repository.findSubmissionResource(
        tx,
        organizationId,
        challengeId,
        resourceId,
        actor.userId,
      )
      if (resource === null) throw notFound()

      if (operation === 'manage') {
        const teamMayEdit =
          resource.isTeamMember && permission(access, Permission.SubmissionEditOwn)
        const organizerMayEdit = permission(access, Permission.ChallengeEdit)
        if (
          !resource.isCurrentDraft ||
          resource.submissionStatus !== 'DRAFT' ||
          (!teamMayEdit && !organizerMayEdit)
        ) {
          throw forbidden('This presentation file cannot be changed in the current state.')
        }
        return
      }

      const mayDownload =
        resource.isTeamMember ||
        permission(access, Permission.SubmissionViewAll) ||
        (resource.isAssignedJudge && permission(access, Permission.JudgingViewAssigned))
      if (!mayDownload) throw notFound()
      return
    }

    if (purpose === 'SUPPORT_ATTACHMENT') {
      const ticket = await tx.supportTicket.findUnique({ where: { id: resourceId } })
      if (
        ticket === null ||
        ticket.organizationId !== organizationId ||
        (challengeId !== null && ticket.challengeId !== challengeId)
      ) {
        throw notFound()
      }
      const mayAccess =
        ticket.userId === actor.userId ||
        ticket.assignedToUserId === actor.userId ||
        permission(access, Permission.PlatformSupport)
      if (!mayAccess) throw notFound()
      return
    }

    if (purpose === 'FORM_ATTACHMENT') {
      const form = await tx.formDefinition.findFirst({
        where: { id: resourceId, organizationId },
      })
      if (form === null || (challengeId !== null && form.challengeId !== challengeId)) {
        throw notFound()
      }
      if (operation === 'manage') {
        // Attaching a file while filling out a response needs the same
        // access as submitting the response itself (any active member) —
        // see forms.service.ts's submitResponse.
        if (!permission(access, Permission.OrganizationViewPrivate)) throw notFound()
        return
      }
      // Downloading is deliberately staff-only: this generic resource-level
      // authorizer only knows the form (shared by every respondent), not
      // which specific response/file belongs to the requesting user, so
      // there is no safe way here to let a respondent re-download only
      // their own attachment without leaking access to everyone else's.
      if (!permission(access, Permission.OrganizationManageForms)) throw notFound()
      return
    }

    const innovation = await tx.innovation.findFirst({
      where: { id: resourceId, organizationId },
    })
    if (
      innovation === null ||
      (challengeId !== null && innovation.sourceChallengeId !== challengeId)
    ) {
      throw notFound()
    }
    const manages =
      innovation.createdByUserId === actor.userId ||
      innovation.ownerUserId === actor.userId ||
      permission(access, Permission.InnovationManage)
    if (
      operation === 'manage' ? !manages : !manages && !permission(access, Permission.InnovationView)
    ) {
      throw notFound()
    }
  }

  async function enqueueDeletion(
    tx: PrismaTransactionClient,
    object: StoredObjectRow,
    fileId?: string,
  ): Promise<void> {
    await outbox.write(tx, {
      eventType: 'file.deletion_requested',
      queueName: QueueName.MediaCleanup,
      aggregateType: fileId === undefined ? 'stored_object' : 'file_asset',
      aggregateId: fileId ?? object.id,
      organizationId: object.organizationId,
      payload: {
        organizationId: object.organizationId,
        storedObjectId: object.id,
        ...(fileId === undefined ? {} : { fileId }),
      },
      dedupeKey: `file.deletion_requested:${fileId ?? object.id}`,
    })
  }

  return {
    async createUploadAuthorization(access, input) {
      if (!config.features.documentUploads || !config.objectStorage.enabled || !scanner.available) {
        throw featureDisabled('document_uploads')
      }
      if (!(await scanner.healthCheck())) throw featureDisabled('document_uploads')

      const actor = requireVerifiedActor(access).actor
      const fileName = validateDocument(input, config)
      const context = await scopedAccess(access, input.organizationId, input.challengeId)

      await Promise.all([
        rateLimiter.enforce(RateLimitPolicies.FileUploadAuthorization, {
          userId: actor.userId,
        }),
        rateLimiter.enforce(RateLimitPolicies.FileUploadAuthorizationOrganization, {
          organizationId: input.organizationId,
        }),
      ])

      const storedObjectId = newId()
      const resourceType = RESOURCE_TYPE[input.purpose]
      const expiresAt = new Date(Date.now() + config.objectStorage.uploadUrlTtlSeconds * 1000)
      const objectKey = `uploads/${input.organizationId}/${input.purpose.toLowerCase()}/${storedObjectId}`

      await transactions.withTenant(
        input.organizationId,
        async (tx) => {
          await authorizeResource(
            tx,
            context,
            input.purpose,
            input.organizationId,
            input.challengeId ?? null,
            input.resourceId,
            'manage',
          )
          const reserved = await repository.reserveUpload(tx, {
            id: storedObjectId,
            organizationId: input.organizationId,
            challengeId: input.challengeId ?? null,
            ownerUserId: actor.userId,
            purpose: input.purpose,
            resourceType,
            resourceId: input.resourceId,
            displayName: fileName,
            objectKey,
            contentType: input.contentType,
            bytes: input.bytes,
            expiresAt,
          })
          if (reserved === null) {
            throw conflict(ErrorCode.CONFLICT, 'The organization file quota has been reached.')
          }
        },
        { actorUserId: actor.userId, isolationLevel: 'Serializable' },
      )

      try {
        const authorization = await objectStorage.presignUploadUrl(
          objectKey,
          input.contentType,
          config.objectStorage.uploadUrlTtlSeconds,
          {
            'stored-object-id': storedObjectId,
            'organization-id': input.organizationId,
            'resource-type': resourceType,
            'resource-id': input.resourceId,
          },
        )
        return {
          storedObjectId,
          uploadUrl: authorization.url,
          requiredHeaders: authorization.requiredHeaders,
          expiresAt,
        }
      } catch (error) {
        await transactions.withTenant(input.organizationId, async (tx) => {
          const cancelled = await repository.cancelPendingUpload(
            tx,
            input.organizationId,
            storedObjectId,
          )
          if (cancelled !== null) await enqueueDeletion(tx, cancelled)
        })
        throw error
      }
    },

    async confirm(access, input) {
      const actor = requireVerifiedActor(access).actor
      const pending = await transactions.withTenant(input.organizationId, (tx) =>
        repository.findStoredObject(tx, input.organizationId, input.storedObjectId),
      )
      if (pending === null || pending.ownerUserId !== actor.userId) throw notFound()
      const context = await scopedAccess(access, input.organizationId, pending.challengeId)

      await transactions.withTenant(input.organizationId, (tx) =>
        authorizeResource(
          tx,
          context,
          pending.purpose,
          pending.organizationId,
          pending.challengeId,
          pending.resourceId,
          'manage',
        ),
      )

      if (pending.status !== 'PENDING_UPLOAD') {
        const existing = await transactions.withTenant(input.organizationId, (tx) =>
          tx.fileAsset.findUnique({
            where: { storedObjectId: pending.id },
            include: { storedObject: true },
          }),
        )
        if (existing !== null) {
          const scanStatus = existing.storedObject.status
          if (!['QUARANTINED', 'CLEAN', 'INFECTED', 'FAILED'].includes(scanStatus)) {
            throw conflict(ErrorCode.CONFLICT, 'This upload is no longer confirmable.')
          }
          return {
            file: existing as unknown as FileAssetRow,
            scanStatus: scanStatus as ConfirmedFile['scanStatus'],
          }
        }
        throw conflict(ErrorCode.CONFLICT, 'This upload is no longer confirmable.')
      }

      const metadata = await objectStorage.inspectObject(pending.objectKey)
      const validMetadata =
        metadata.metadata['stored-object-id'] === pending.id &&
        metadata.metadata['organization-id'] === pending.organizationId &&
        metadata.metadata['resource-type'] === pending.resourceType &&
        metadata.metadata['resource-id'] === pending.resourceId
      if (
        metadata.bytes < 1 ||
        metadata.bytes > pending.expectedBytes ||
        metadata.bytes > config.uploads.maxDocumentBytes ||
        metadata.contentType !== pending.expectedContentType ||
        !validMetadata
      ) {
        await transactions.withTenant(input.organizationId, async (tx) => {
          const cancelled = await repository.cancelPendingUpload(
            tx,
            input.organizationId,
            pending.id,
          )
          if (cancelled !== null) await enqueueDeletion(tx, cancelled)
        })
        throw conflict(
          ErrorCode.MEDIA_VERIFICATION_FAILED,
          'The stored object does not match its upload authorization.',
        )
      }

      const result = await transactions.withTenant(
        input.organizationId,
        async (tx) => {
          await authorizeResource(
            tx,
            context,
            pending.purpose,
            pending.organizationId,
            pending.challengeId,
            pending.resourceId,
            'manage',
          )
          const now = await transactions.databaseNow(tx)
          const confirmed = await repository.confirmPendingUpload(tx, {
            organizationId: input.organizationId,
            storedObjectId: pending.id,
            purpose: pending.purpose,
            resourceType: pending.resourceType,
            resourceId: pending.resourceId,
            displayName: pending.displayName,
            bytes: metadata.bytes,
            contentType: pending.expectedContentType,
            etag: metadata.etag,
            now,
          })
          if (confirmed === null) {
            throw conflict(ErrorCode.CONFLICT, 'This upload is no longer confirmable.')
          }
          if (!confirmed.created) return confirmed.file

          await audit.write(tx, {
            organizationId: input.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.FileQuarantined,
            resourceType: 'file_asset',
            resourceId: confirmed.file.id,
            summary: 'Confirmed a private file upload and placed it in malware quarantine.',
          })
          await outbox.write(tx, {
            eventType: 'file.scan_requested',
            queueName: QueueName.MediaCleanup,
            aggregateType: 'file_asset',
            aggregateId: confirmed.file.id,
            organizationId: input.organizationId,
            payload: { organizationId: input.organizationId, fileId: confirmed.file.id },
            dedupeKey: `file.scan_requested:${confirmed.file.id}`,
          })
          return confirmed.file
        },
        { actorUserId: actor.userId, isolationLevel: 'Serializable' },
      )
      return { file: result, scanStatus: 'QUARANTINED' }
    },

    async getDownloadUrl(access, fileId) {
      const actor = requireVerifiedActor(access).actor
      const scope = await transactions.withoutTenant((tx) =>
        repository.resolveScope(tx, fileId, actor.userId),
      )
      if (scope === null) throw notFound()
      const context = await scopedAccess(access, scope.organizationId, scope.challengeId)
      const file = await transactions.withTenant(scope.organizationId, async (tx) => {
        const row = await repository.findFileAsset(tx, scope.organizationId, fileId)
        if (row === null || row.status !== 'ACTIVE') throw notFound()
        await authorizeResource(
          tx,
          context,
          row.purpose,
          row.organizationId,
          row.challengeId,
          row.resourceId,
          'download',
        )
        return row
      })

      if (file.storedObject.status !== 'CLEAN') {
        if (file.storedObject.status === 'INFECTED') {
          throw conflict(ErrorCode.FILE_QUARANTINED, 'This file failed malware scanning.')
        }
        throw conflict(
          ErrorCode.FILE_SCAN_PENDING,
          'This file is not available until scanning completes.',
        )
      }
      const ttlSeconds = config.objectStorage.downloadUrlTtlSeconds
      return {
        downloadUrl: await objectStorage.presignDownloadUrl(
          file.storedObject.objectKey,
          ttlSeconds,
        ),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      }
    },

    async remove(access, fileId) {
      const actor = requireFreshActor(access).actor
      const scope = await transactions.withoutTenant((tx) =>
        repository.resolveScope(tx, fileId, actor.userId),
      )
      if (scope === null) throw notFound()
      const context = await scopedAccess(access, scope.organizationId, scope.challengeId)

      await transactions.withTenant(
        scope.organizationId,
        async (tx) => {
          const current = await repository.findFileAsset(tx, scope.organizationId, fileId)
          if (current === null || current.status === 'DELETED') throw notFound()
          if (current.status === 'PENDING_DELETION') return
          await authorizeResource(
            tx,
            context,
            current.purpose,
            current.organizationId,
            current.challengeId,
            current.resourceId,
            'manage',
          )
          const pending = await repository.requestDeletion(tx, scope.organizationId, fileId)
          if (pending === null) return
          await audit.write(tx, {
            organizationId: scope.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.FileDeletionRequested,
            resourceType: 'file_asset',
            resourceId: fileId,
            summary: 'Requested asynchronous deletion of a private file.',
          })
          await enqueueDeletion(tx, pending.storedObject, fileId)
        },
        { actorUserId: actor.userId, isolationLevel: 'Serializable' },
      )
    },
  }
}
