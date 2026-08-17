import { createExportsRepository } from '../../modules/exports/exports.repository'
import { describeError } from '../../shared/logging'
import type { JobHandler } from '../job-router'

interface ExportRequestedPayload {
  exportId: string
  organizationId: string
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function toCsv(headers: readonly string[], rows: readonly Record<string, string>[]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? '')).join(','))
  }
  return lines.join('\r\n')
}

const repository = createExportsRepository()

/**
 * Generates the CSV for a requested export and uploads it to private object
 * storage (master prompt section 24.1). The storage key is deterministic
 * (`exports/{organizationId}/{exportId}.csv`), so a retried delivery
 * overwrites the same object rather than accumulating duplicates — the
 * upload itself is naturally idempotent, and the PENDING-status guard below
 * skips a delivery that already completed.
 */
export const handleExportRequested: JobHandler = async (context) => {
  const payload = context.payload as unknown as ExportRequestedPayload
  const { transactions, objectStorage, config } = context.infrastructure

  const shouldProcess = await transactions.withTenant(payload.organizationId, async (tx) => {
    const exportRow = await tx.dataExport.findUnique({ where: { id: payload.exportId } })
    if (exportRow === null || exportRow.status !== 'PENDING') return false
    await tx.dataExport.update({ where: { id: payload.exportId }, data: { status: 'PROCESSING' } })
    return true
  })
  if (!shouldProcess) return

  try {
    const { headers, rows } = await transactions.withTenant(payload.organizationId, async (tx) => {
      const exportRow = await tx.dataExport.findUniqueOrThrow({ where: { id: payload.exportId } })
      const filters = (exportRow.filters ?? {}) as { challengeId?: string }

      switch (exportRow.exportType) {
        case 'ORGANIZATION_MEMBERS': {
          const data = await repository.fetchMembers(tx, payload.organizationId)
          return {
            headers: ['userId', 'name', 'email', 'role', 'status', 'joinedAt'],
            rows: data as unknown as Record<string, string>[],
          }
        }
        case 'ORGANIZATION_PARTICIPATION': {
          const data = await repository.fetchParticipation(
            tx,
            payload.organizationId,
            filters.challengeId,
          )
          return {
            headers: [
              'userId',
              'name',
              'email',
              'challengeTitle',
              'status',
              'appliedAt',
              'decidedAt',
            ],
            rows: data as unknown as Record<string, string>[],
          }
        }
        case 'ORGANIZATION_SUBMISSIONS': {
          const data = await repository.fetchSubmissions(
            tx,
            payload.organizationId,
            filters.challengeId,
          )
          return {
            headers: [
              'submissionId',
              'challengeTitle',
              'teamName',
              'trackName',
              'status',
              'finalizedAt',
            ],
            rows: data as unknown as Record<string, string>[],
          }
        }
        case 'CHALLENGE_RESULTS': {
          if (filters.challengeId === undefined) {
            throw new Error('CHALLENGE_RESULTS export is missing its required challengeId filter.')
          }
          const data = await repository.fetchChallengeResults(
            tx,
            payload.organizationId,
            filters.challengeId,
          )
          return {
            headers: [
              'submissionId',
              'teamName',
              'trackName',
              'rank',
              'rankLabel',
              'aggregateScore',
            ],
            rows: data as unknown as Record<string, string>[],
          }
        }
        default:
          throw new Error(`Unknown export type: ${exportRow.exportType}`)
      }
    })

    const csv = toCsv(headers, rows)
    const storageKey = `exports/${payload.organizationId}/${payload.exportId}.csv`
    const { bytes } = await objectStorage.putObject(storageKey, csv, 'text/csv')
    const expiresAt = new Date(Date.now() + config.retention.exportFileDays * 24 * 60 * 60 * 1000)

    await transactions.withTenant(payload.organizationId, (tx) =>
      tx.dataExport.update({
        where: { id: payload.exportId },
        data: {
          status: 'COMPLETED',
          storageKey,
          fileSizeBytes: bytes,
          rowCount: rows.length,
          expiresAt,
          completedAt: new Date(),
        },
      }),
    )
  } catch (error) {
    context.infrastructure.logger.error(
      { err: describeError(error), exportId: payload.exportId },
      'Failed to generate a data export',
    )
    const message = error instanceof Error ? error.message : String(error)
    await transactions.withTenant(payload.organizationId, (tx) =>
      tx.dataExport.update({
        where: { id: payload.exportId },
        data: { status: 'FAILED', failureReason: message.slice(0, 1000) },
      }),
    )
    throw error
  }
}
