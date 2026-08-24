import type {
  ChallengeStatus,
  ChallengeVisibility,
  PlatformRole,
} from '../../generated/prisma/enums'
import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { OrganizationRow } from '../organizations/organizations.repository'
import type { PlatformChallengeRow, PlatformUserRow } from './platform-admin.repository'
import type { PlatformAdminService } from './platform-admin.service'

function serialize(row: OrganizationRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    organizationType: row.organizationType,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeUser(row: PlatformUserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    twoFactorEnabled: row.twoFactorEnabled,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    platformRoles: row.platformRoles.map((assignment) => ({
      id: assignment.id,
      role: assignment.role,
      grantedAt: assignment.grantedAt.toISOString(),
    })),
  }
}

function serializeChallenge(row: PlatformChallengeRow) {
  return {
    ...row,
    moderationHiddenAt: row.moderationHiddenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createPlatformAdminController(service: PlatformAdminService) {
  return {
    async listOrganizations(
      access: AccessContext,
      status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | undefined,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.listOrganizations(access, status, query)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async getOrganization(access: AccessContext, organizationId: string) {
      requireActor(access)
      return serialize(await service.getOrganization(access, organizationId))
    },

    async suspend(access: AccessContext, organizationId: string, reason: string) {
      requireActor(access)
      await service.suspend(access, organizationId, reason)
    },

    async reinstate(access: AccessContext, organizationId: string, reason: string) {
      requireActor(access)
      await service.reinstate(access, organizationId, reason)
    },

    async archive(access: AccessContext, organizationId: string, reason: string) {
      requireActor(access)
      await service.archive(access, organizationId, reason)
    },

    async getAuditSummary(access: AccessContext, organizationId: string) {
      requireActor(access)
      const summary = await service.getAuditSummary(access, organizationId)
      return {
        totalEvents: summary.totalEvents,
        firstEventAt: summary.firstEventAt?.toISOString() ?? null,
        lastEventAt: summary.lastEventAt?.toISOString() ?? null,
        topActions: summary.topActions,
      }
    },

    async listUsers(
      access: AccessContext,
      filters: { search?: string; role?: PlatformRole },
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.listUsers(access, filters, query)
      return {
        items: page.items.map(serializeUser),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async grantRole(access: AccessContext, userId: string, role: PlatformRole, reason: string) {
      requireActor(access)
      return serializeUser(await service.grantRole(access, userId, role, reason))
    },

    async revokeRole(access: AccessContext, userId: string, role: PlatformRole, reason: string) {
      requireActor(access)
      return serializeUser(await service.revokeRole(access, userId, role, reason))
    },

    async listChallenges(
      access: AccessContext,
      filters: { search?: string; status?: ChallengeStatus; visibility?: ChallengeVisibility },
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.listChallenges(access, filters, query)
      return {
        items: page.items.map(serializeChallenge),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async analyticsSummary(access: AccessContext) {
      requireActor(access)
      return { ...(await service.analyticsSummary(access)), generatedAt: new Date().toISOString() }
    },

    async getSettings(access: AccessContext) {
      requireActor(access)
      return service.getSettings(access)
    },
  }
}

export type PlatformAdminController = ReturnType<typeof createPlatformAdminController>
