import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { JoinRequestRow, JoinRequestStatus } from './join-requests.repository'
import type { JoinRequestsService } from './join-requests.service'

function serialize(row: JoinRequestRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    status: row.status,
    message: row.message,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    decisionReason: row.decisionReason,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createJoinRequestsController(service: JoinRequestsService) {
  return {
    async create(access: AccessContext, organizationId: string, message: string | undefined) {
      requireActor(access)
      return serialize(await service.create(access, organizationId, message))
    },

    async listMine(access: AccessContext, query: { limit?: number; cursor?: string }) {
      requireActor(access)
      const page = await service.listMine(access, query)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async withdraw(access: AccessContext, organizationId: string, id: string) {
      requireActor(access)
      await service.withdraw(access, organizationId, id)
    },

    async list(
      access: AccessContext,
      organizationId: string,
      status: JoinRequestStatus | undefined,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.list(access, organizationId, status, query)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async get(access: AccessContext, organizationId: string, id: string) {
      requireActor(access)
      return serialize(await service.get(access, organizationId, id))
    },

    async approve(access: AccessContext, organizationId: string, id: string) {
      requireActor(access)
      await service.approve(access, organizationId, id)
    },

    async reject(
      access: AccessContext,
      organizationId: string,
      id: string,
      reason: string,
      internalNotes: string | undefined,
    ) {
      requireActor(access)
      await service.reject(access, organizationId, id, reason, internalNotes)
    },
  }
}

export type JoinRequestsController = ReturnType<typeof createJoinRequestsController>
