import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type ContentReportTargetType = 'ORGANIZATION' | 'CHALLENGE'
export type ContentReportCategory =
  | 'SPAM'
  | 'ABUSE'
  | 'INAPPROPRIATE_CONTENT'
  | 'INTELLECTUAL_PROPERTY'
  | 'SAFETY_CONCERN'
  | 'OTHER'
export type ContentReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'DISMISSED' | 'ACTION_TAKEN'

export interface ContentReportRow {
  id: string
  reporterUserId: string
  targetType: ContentReportTargetType
  targetId: string
  targetOrganizationId: string | null
  category: ContentReportCategory
  description: string
  status: ContentReportStatus
  reviewedByUserId: string | null
  reviewedAt: Date | null
  resolutionReason: string | null
  createdAt: Date
}

export interface CreateReportInput {
  id: string
  reporterUserId: string
  targetType: ContentReportTargetType
  targetId: string
  targetOrganizationId: string | null
  category: ContentReportCategory
  description: string
}

export interface ModerationRepository {
  create(tx: PrismaTransactionClient, input: CreateReportInput): Promise<ContentReportRow>
  findById(tx: PrismaTransactionClient, id: string): Promise<ContentReportRow | null>
  listForUser(
    tx: PrismaTransactionClient,
    userId: string,
    page: PageRequest,
  ): Promise<Page<ContentReportRow>>
  listForPlatform(
    tx: PrismaTransactionClient,
    filters: { status?: ContentReportStatus },
    page: PageRequest,
  ): Promise<Page<ContentReportRow>>
  markReviewed(
    tx: PrismaTransactionClient,
    id: string,
    input: { status: ContentReportStatus; reviewedByUserId: string; resolutionReason: string },
  ): Promise<ContentReportRow>
  /** True when the reporter holds any membership row (any status) in the organization. */
  hasMembership(
    tx: PrismaTransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<boolean>
  findPublicOrganizationId(
    tx: PrismaTransactionClient,
    organizationId: string,
  ): Promise<string | null>
  /** Resolves a public challenge's id and owning organization id by its own id. */
  findPublicChallengeOrganizationId(
    tx: PrismaTransactionClient,
    challengeId: string,
  ): Promise<string | null>
}

export function createModerationRepository(): ModerationRepository {
  return {
    async create(tx, input) {
      return tx.contentReport.create({
        data: {
          id: input.id,
          reporterUserId: input.reporterUserId,
          targetType: input.targetType,
          targetId: input.targetId,
          targetOrganizationId: input.targetOrganizationId,
          category: input.category,
          description: input.description,
        },
      })
    },

    async findById(tx, id) {
      return tx.contentReport.findUnique({ where: { id } })
    },

    async listForUser(tx, userId, page) {
      const rows = await tx.contentReport.findMany({
        where: {
          reporterUserId: userId,
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
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async listForPlatform(tx, filters, page) {
      const rows = await tx.contentReport.findMany({
        where: {
          ...(filters.status ? { status: filters.status } : {}),
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
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async markReviewed(tx, id, input) {
      return tx.contentReport.update({
        where: { id },
        data: {
          status: input.status,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          resolutionReason: input.resolutionReason,
        },
      })
    },

    async hasMembership(tx, userId, organizationId) {
      const rows = await tx.$queryRaw<{ member: boolean }[]>`
        select app_user_has_organization_membership(
          ${userId}::uuid,
          ${organizationId}::uuid
        ) as member
      `
      return rows[0]?.member ?? false
    },

    async findPublicOrganizationId(tx, organizationId) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        select id from public_organization_view where id = ${organizationId}::uuid limit 1
      `
      return rows[0]?.id ?? null
    },

    async findPublicChallengeOrganizationId(tx, challengeId) {
      const rows = await tx.$queryRaw<{ organization_id: string }[]>`
        select organization_id from public_challenge_view where id = ${challengeId}::uuid limit 1
      `
      return rows[0]?.organization_id ?? null
    },
  }
}
