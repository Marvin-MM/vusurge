import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { OrgRole } from './memberships.repository'
import type { MembershipsService } from './memberships.service'

function serializeMember(row: {
  id: string
  organizationId: string
  userId: string
  role: OrgRole
  status: 'ACTIVE' | 'INACTIVE'
  joinedAt: Date
  removedAt: Date | null
  userEmail: string
  displayName: string | null
}) {
  return {
    userId: row.userId,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    removedAt: row.removedAt?.toISOString() ?? null,
  }
}

export function createMembershipsController(service: MembershipsService) {
  return {
    async list(
      access: AccessContext,
      organizationId: string,
      query: { role?: OrgRole; status?: 'ACTIVE' | 'INACTIVE'; limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.list(
        access,
        organizationId,
        { role: query.role, status: query.status },
        { limit: query.limit, cursor: query.cursor },
      )
      return {
        items: page.items.map(serializeMember),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async get(access: AccessContext, organizationId: string, targetUserId: string) {
      requireActor(access)
      const row = await service.get(access, organizationId, targetUserId)
      return serializeMember(row)
    },

    async changeRole(
      access: AccessContext,
      organizationId: string,
      targetUserId: string,
      role: OrgRole,
    ) {
      requireActor(access)
      await service.changeRole(access, organizationId, targetUserId, role)
    },

    async remove(access: AccessContext, organizationId: string, targetUserId: string) {
      requireActor(access)
      await service.remove(access, organizationId, targetUserId)
    },

    async reactivate(
      access: AccessContext,
      organizationId: string,
      targetUserId: string,
      role: OrgRole | undefined,
    ) {
      requireActor(access)
      await service.reactivate(access, organizationId, targetUserId, role)
    },
  }
}

export type MembershipsController = ReturnType<typeof createMembershipsController>
