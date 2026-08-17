import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type ExportType =
  | 'ORGANIZATION_MEMBERS'
  | 'ORGANIZATION_SUBMISSIONS'
  | 'ORGANIZATION_PARTICIPATION'
  | 'CHALLENGE_RESULTS'

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface ExportFilters {
  challengeId?: string
}

export interface DataExportRow {
  id: string
  organizationId: string
  requestedByUserId: string
  exportType: ExportType
  filters: ExportFilters
  status: ExportStatus
  storageKey: string | null
  fileSizeBytes: number | null
  rowCount: number | null
  failureReason: string | null
  expiresAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface CreateExportInput {
  id: string
  organizationId: string
  requestedByUserId: string
  exportType: ExportType
  filters: ExportFilters
}

export interface MemberExportRow {
  userId: string
  name: string
  email: string
  role: string
  status: string
  joinedAt: string
}

export interface ParticipationExportRow {
  userId: string
  name: string
  email: string
  challengeTitle: string
  status: string
  appliedAt: string
  decidedAt: string
}

export interface SubmissionExportRow {
  submissionId: string
  challengeTitle: string
  teamName: string
  trackName: string
  status: string
  finalizedAt: string
}

export interface ChallengeResultExportRow {
  submissionId: string
  teamName: string
  trackName: string
  rank: string
  rankLabel: string
  aggregateScore: string
}

export interface ExportsRepository {
  create(tx: PrismaTransactionClient, input: CreateExportInput): Promise<DataExportRow>
  findById(
    tx: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<DataExportRow | null>
  list(
    tx: PrismaTransactionClient,
    organizationId: string,
    page: PageRequest,
  ): Promise<Page<DataExportRow>>
  markProcessing(tx: PrismaTransactionClient, id: string): Promise<void>
  markCompleted(
    tx: PrismaTransactionClient,
    id: string,
    input: { storageKey: string; fileSizeBytes: number; rowCount: number; expiresAt: Date },
  ): Promise<void>
  markFailed(tx: PrismaTransactionClient, id: string, failureReason: string): Promise<void>
  delete(tx: PrismaTransactionClient, organizationId: string, id: string): Promise<void>

  fetchMembers(tx: PrismaTransactionClient, organizationId: string): Promise<MemberExportRow[]>
  fetchParticipation(
    tx: PrismaTransactionClient,
    organizationId: string,
    challengeId: string | undefined,
  ): Promise<ParticipationExportRow[]>
  fetchSubmissions(
    tx: PrismaTransactionClient,
    organizationId: string,
    challengeId: string | undefined,
  ): Promise<SubmissionExportRow[]>
  fetchChallengeResults(
    tx: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeResultExportRow[]>
}

function toRow(row: {
  id: string
  organizationId: string
  requestedByUserId: string
  exportType: string
  filters: unknown
  status: string
  storageKey: string | null
  fileSizeBytes: number | null
  rowCount: number | null
  failureReason: string | null
  expiresAt: Date | null
  completedAt: Date | null
  createdAt: Date
}): DataExportRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestedByUserId: row.requestedByUserId,
    exportType: row.exportType as ExportType,
    filters: (row.filters ?? {}) as ExportFilters,
    status: row.status as ExportStatus,
    storageKey: row.storageKey,
    fileSizeBytes: row.fileSizeBytes,
    rowCount: row.rowCount,
    failureReason: row.failureReason,
    expiresAt: row.expiresAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  }
}

export function createExportsRepository(): ExportsRepository {
  return {
    async create(tx, input) {
      const row = await tx.dataExport.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          requestedByUserId: input.requestedByUserId,
          exportType: input.exportType,
          filters: input.filters as never,
        },
      })
      return toRow(row)
    },

    async findById(tx, organizationId, id) {
      const row = await tx.dataExport.findFirst({ where: { id, organizationId } })
      return row === null ? null : toRow(row)
    },

    async list(tx, organizationId, page) {
      const rows = await tx.dataExport.findMany({
        where: {
          organizationId,
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows.map(toRow), page, (row) => ({
        at: row.createdAt.toISOString(),
        id: row.id,
      }))
    },

    async markProcessing(tx, id) {
      await tx.dataExport.update({ where: { id }, data: { status: 'PROCESSING' } })
    },

    async markCompleted(tx, id, input) {
      await tx.dataExport.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          storageKey: input.storageKey,
          fileSizeBytes: input.fileSizeBytes,
          rowCount: input.rowCount,
          expiresAt: input.expiresAt,
          completedAt: new Date(),
        },
      })
    },

    async markFailed(tx, id, failureReason) {
      await tx.dataExport.update({
        where: { id },
        data: { status: 'FAILED', failureReason: failureReason.slice(0, 1000) },
      })
    },

    async delete(tx, organizationId, id) {
      await tx.dataExport.deleteMany({ where: { id, organizationId } })
    },

    async fetchMembers(tx, organizationId) {
      return tx.$queryRaw<MemberExportRow[]>`
        select om.user_id as "userId", u.name, u.email, om.role, om.status,
               om.created_at::text as "joinedAt"
        from organization_membership om
        join "user" u on u.id = om.user_id
        where om.organization_id = ${organizationId}::uuid
        order by om.created_at asc
      `
    },

    async fetchParticipation(tx, organizationId, challengeId) {
      return challengeId
        ? tx.$queryRaw<ParticipationExportRow[]>`
            select cp.user_id as "userId", u.name, u.email, c.title as "challengeTitle",
                   cp.status, cp.applied_at::text as "appliedAt",
                   coalesce(cp.decided_at::text, '') as "decidedAt"
            from challenge_participation cp
            join "user" u on u.id = cp.user_id
            join challenge c on c.id = cp.challenge_id
            where cp.organization_id = ${organizationId}::uuid and cp.challenge_id = ${challengeId}::uuid
            order by cp.applied_at asc
          `
        : tx.$queryRaw<ParticipationExportRow[]>`
            select cp.user_id as "userId", u.name, u.email, c.title as "challengeTitle",
                   cp.status, cp.applied_at::text as "appliedAt",
                   coalesce(cp.decided_at::text, '') as "decidedAt"
            from challenge_participation cp
            join "user" u on u.id = cp.user_id
            join challenge c on c.id = cp.challenge_id
            where cp.organization_id = ${organizationId}::uuid
            order by cp.applied_at asc
          `
    },

    async fetchSubmissions(tx, organizationId, challengeId) {
      return challengeId
        ? tx.$queryRaw<SubmissionExportRow[]>`
            select s.id as "submissionId", c.title as "challengeTitle", t.name as "teamName",
                   coalesce(tr.name, '') as "trackName", s.status,
                   coalesce(sv.created_at::text, '') as "finalizedAt"
            from submission s
            join challenge c on c.id = s.challenge_id
            join challenge_team t on t.id = s.team_id
            left join challenge_track tr on tr.id = s.track_id
            left join submission_version sv on sv.id = s.final_version_id
            where s.organization_id = ${organizationId}::uuid and s.challenge_id = ${challengeId}::uuid
            order by s.created_at asc
          `
        : tx.$queryRaw<SubmissionExportRow[]>`
            select s.id as "submissionId", c.title as "challengeTitle", t.name as "teamName",
                   coalesce(tr.name, '') as "trackName", s.status,
                   coalesce(sv.created_at::text, '') as "finalizedAt"
            from submission s
            join challenge c on c.id = s.challenge_id
            join challenge_team t on t.id = s.team_id
            left join challenge_track tr on tr.id = s.track_id
            left join submission_version sv on sv.id = s.final_version_id
            where s.organization_id = ${organizationId}::uuid
            order by s.created_at asc
          `
    },

    async fetchChallengeResults(tx, organizationId, challengeId) {
      return tx.$queryRaw<ChallengeResultExportRow[]>`
        select sr.submission_id as "submissionId", t.name as "teamName",
               coalesce(tr.name, '') as "trackName",
               coalesce(sr.rank::text, '') as "rank",
               coalesce(sr.rank_label, '') as "rankLabel",
               coalesce(sr.aggregate_score::text, '') as "aggregateScore"
        from submission_result sr
        join submission s on s.id = sr.submission_id
        join challenge_team t on t.id = s.team_id
        left join challenge_track tr on tr.id = sr.track_id
        where sr.organization_id = ${organizationId}::uuid and sr.challenge_id = ${challengeId}::uuid
        order by sr.rank asc nulls last
      `
    },
  }
}
