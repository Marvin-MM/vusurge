import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type AuditActorType = 'USER' | 'SYSTEM' | 'PLATFORM_ADMIN'

export interface AuditEventRow {
  id: string
  organizationId: string | null
  actorType: AuditActorType
  actorUserId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  summary: string
  changes: unknown
  reason: string | null
  requestId: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface PlatformAuditFilters {
  organizationId?: string
}

export interface AuditSummaryRow {
  totalEvents: number
  firstEventAt: Date | null
  lastEventAt: Date | null
  topActions: { action: string; count: number }[]
}

export interface AuditRepository {
  listForOrganization(
    tx: PrismaTransactionClient,
    organizationId: string,
    page: PageRequest,
  ): Promise<Page<AuditEventRow>>
  findForOrganization(
    tx: PrismaTransactionClient,
    organizationId: string,
    auditEventId: string,
  ): Promise<AuditEventRow | null>
  listForPlatform(
    tx: PrismaTransactionClient,
    filters: PlatformAuditFilters,
    page: PageRequest,
  ): Promise<Page<AuditEventRow>>
  findForPlatform(tx: PrismaTransactionClient, auditEventId: string): Promise<AuditEventRow | null>
  summarizeForOrganization(
    tx: PrismaTransactionClient,
    organizationId: string,
  ): Promise<AuditSummaryRow>
}

function toRow(row: {
  id: string
  organizationId: string | null
  actorType: string
  actorUserId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  summary: string
  changes: unknown
  reason: string | null
  requestId: string | null
  ipAddress: unknown
  userAgent: string | null
  createdAt: Date
}): AuditEventRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorType: row.actorType as AuditActorType,
    actorUserId: row.actorUserId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    summary: row.summary,
    changes: row.changes,
    reason: row.reason,
    requestId: row.requestId,
    ipAddress: row.ipAddress === null ? null : String(row.ipAddress),
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  }
}

export function createAuditRepository(): AuditRepository {
  return {
    async listForOrganization(tx, organizationId, page) {
      const rows = await tx.auditEvent.findMany({
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

    async findForOrganization(tx, organizationId, auditEventId) {
      const row = await tx.auditEvent.findFirst({ where: { id: auditEventId, organizationId } })
      return row === null ? null : toRow(row)
    },

    async listForPlatform(tx, filters, page) {
      const rows = await tx.auditEvent.findMany({
        where: {
          ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
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

    async findForPlatform(tx, auditEventId) {
      const row = await tx.auditEvent.findUnique({ where: { id: auditEventId } })
      return row === null ? null : toRow(row)
    },

    async summarizeForOrganization(tx, organizationId) {
      const [aggregate, topActions] = await Promise.all([
        tx.auditEvent.aggregate({
          where: { organizationId },
          _count: { _all: true },
          _min: { createdAt: true },
          _max: { createdAt: true },
        }),
        tx.auditEvent.groupBy({
          by: ['action'],
          where: { organizationId },
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } },
          take: 10,
        }),
      ])

      return {
        totalEvents: aggregate._count._all,
        firstEventAt: aggregate._min.createdAt,
        lastEventAt: aggregate._max.createdAt,
        topActions: topActions.map((row) => ({ action: row.action, count: row._count.action })),
      }
    },
  }
}
