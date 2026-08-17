import { t } from 'elysia'
import { Uuid } from '../../shared/http'

export const FilePurposeDto = t.Union([
  t.Literal('SUBMISSION_PRESENTATION'),
  t.Literal('SUPPORT_ATTACHMENT'),
  t.Literal('PORTFOLIO_EVIDENCE'),
])

export const FileUploadAuthorizationBody = t.Object({
  purpose: FilePurposeDto,
  organizationId: Uuid,
  challengeId: t.Optional(Uuid),
  resourceId: Uuid,
  fileName: t.String({ minLength: 1, maxLength: 255 }),
  contentType: t.String({ minLength: 1, maxLength: 120 }),
  bytes: t.Integer({ minimum: 1 }),
})

export const FileUploadAuthorizationResponse = t.Object({
  storedObjectId: Uuid,
  uploadUrl: t.String(),
  requiredHeaders: t.Record(t.String(), t.String()),
  expiresAt: t.String(),
})

export const ConfirmFileBody = t.Object({
  organizationId: Uuid,
  storedObjectId: Uuid,
})

export const FileAssetResponse = t.Object({
  id: Uuid,
  purpose: FilePurposeDto,
  resourceType: t.String(),
  resourceId: Uuid,
  displayName: t.String(),
  status: t.Union([t.Literal('ACTIVE'), t.Literal('PENDING_DELETION'), t.Literal('DELETED')]),
  scanStatus: t.Union([
    t.Literal('QUARANTINED'),
    t.Literal('CLEAN'),
    t.Literal('INFECTED'),
    t.Literal('FAILED'),
  ]),
  createdAt: t.String(),
})

export const FileDownloadResponse = t.Object({
  downloadUrl: t.String(),
  expiresAt: t.String(),
})
