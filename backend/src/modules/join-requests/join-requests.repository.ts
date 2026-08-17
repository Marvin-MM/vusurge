import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface JoinRequestRow {
  id: string
  organizationId: string
  userId: string
  status: JoinRequestStatus
  message: string | null
  reviewedByUserId: string | null
  reviewedAt: Date | null
  decisionReason: string | null
  createdAt: Date
}

export interface JoinRequestsRepository {
  create(
    client: PrismaTransactionClient,
    input: { id: string; organizationId: string; userId: string; message?: string },
  ): Promise<JoinRequestRow>
  findById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<JoinRequestRow | null>
  hasPending(
    client: PrismaTransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<boolean>
  listMine(
    client: PrismaTransactionClient,
    userId: string,
    page: PageRequest,
  ): Promise<Page<JoinRequestRow>>
  list(
    client: PrismaTransactionClient,
    organizationId: string,
    status: JoinRequestStatus | undefined,
    page: PageRequest,
  ): Promise<Page<JoinRequestRow>>
  withdraw(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<boolean>
  approve(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    reviewerId: string,
    now: Date,
  ): Promise<boolean>
  reject(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    reviewerId: string,
    reason: string,
    internalNotes: string | undefined,
    now: Date,
  ): Promise<boolean>
}

export function createJoinRequestsRepository(): JoinRequestsRepository {
  return {
    async create(client, input) {
      return client.organizationJoinRequest.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          userId: input.userId,
          message: input.message,
          status: 'PENDING',
        },
      })
    },

    async findById(client, organizationId, id) {
      return client.organizationJoinRequest.findFirst({ where: { id, organizationId } })
    },

    async hasPending(client, organizationId, userId) {
      const existing = await client.organizationJoinRequest.findFirst({
        where: { organizationId, userId, status: 'PENDING' },
        select: { id: true },
      })
      return existing !== null
    },

    async listMine(client, userId, page) {
      const rows = await client.$queryRaw<JoinRequestRow[]>`
        select id, organization_id as "organizationId", user_id as "userId",
               request_status as status, message, reviewed_by_user_id as "reviewedByUserId",
               reviewed_at as "reviewedAt", decision_reason as "decisionReason",
               created_at as "createdAt"
        from app_list_my_join_requests(
          ${userId}::uuid,
          ${page.cursor === undefined ? null : new Date(page.cursor.at)}::timestamptz,
          ${page.cursor?.id ?? null}::uuid,
          ${page.limit + 1}
        )
      `
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async list(client, organizationId, status, page) {
      const rows = await client.organizationJoinRequest.findMany({
        where: {
          organizationId,
          ...(status ? { status } : {}),
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

    async withdraw(client, organizationId, id, userId) {
      const result = await client.organizationJoinRequest.updateMany({
        where: { id, organizationId, userId, status: 'PENDING' },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      })
      return result.count > 0
    },

    async approve(client, organizationId, id, reviewerId, now) {
      const result = await client.organizationJoinRequest.updateMany({
        where: { id, organizationId, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedByUserId: reviewerId, reviewedAt: now },
      })
      return result.count > 0
    },

    async reject(client, organizationId, id, reviewerId, reason, internalNotes, now) {
      const result = await client.organizationJoinRequest.updateMany({
        where: { id, organizationId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedByUserId: reviewerId,
          reviewedAt: now,
          decisionReason: reason,
          internalNotes,
        },
      })
      return result.count > 0
    },
  }
}
