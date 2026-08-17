import { t } from 'elysia'
import { PageOf, Uuid } from '../../shared/http'

export const ExportType = t.Union([
  t.Literal('ORGANIZATION_MEMBERS'),
  t.Literal('ORGANIZATION_SUBMISSIONS'),
  t.Literal('ORGANIZATION_PARTICIPATION'),
  t.Literal('CHALLENGE_RESULTS'),
])

export const ExportStatus = t.Union([
  t.Literal('PENDING'),
  t.Literal('PROCESSING'),
  t.Literal('COMPLETED'),
  t.Literal('FAILED'),
])

export const CreateExportBody = t.Object({
  exportType: ExportType,
  filters: t.Optional(t.Object({ challengeId: t.Optional(Uuid) })),
})

export const DataExportResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  requestedByUserId: Uuid,
  exportType: ExportType,
  filters: t.Object({ challengeId: t.Optional(Uuid) }),
  status: ExportStatus,
  storageKey: t.Union([t.String(), t.Null()]),
  fileSizeBytes: t.Union([t.Integer(), t.Null()]),
  rowCount: t.Union([t.Integer(), t.Null()]),
  failureReason: t.Union([t.String(), t.Null()]),
  expiresAt: t.Union([t.String(), t.Null()]),
  completedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const DataExportListResponse = PageOf(DataExportResponse)

export const DownloadUrlResponse = t.Object({
  downloadUrl: t.String(),
  expiresAt: t.String(),
})
