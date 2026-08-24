import type {
  ChallengeStatus,
  ChallengeVisibility,
  PlatformRole,
} from '../../generated/prisma/enums'
import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export interface PlatformUserRow {
  id: string
  name: string
  email: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  deletedAt: Date | null
  createdAt: Date
  platformRoles: { id: string; role: PlatformRole; grantedAt: Date }[]
}

export interface PlatformChallengeRow {
  id: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  title: string
  slug: string
  status: ChallengeStatus
  visibility: ChallengeVisibility
  moderationHiddenAt: Date | null
  createdAt: Date
}

export interface PlatformAnalyticsSummary {
  users: number
  verifiedUsers: number
  usersWithTwoFactor: number
  activeOrganizations: number
  suspendedOrganizations: number
  challenges: number
  publicChallenges: number
  activeParticipations: number
  finalizedSubmissions: number
  openReports: number
  openSupportTickets: number
}

export interface PlatformAdminRepository {
  listUsers(
    tx: PrismaTransactionClient,
    filters: { search?: string; role?: PlatformRole },
    page: PageRequest,
  ): Promise<Page<PlatformUserRow>>
  findUser(tx: PrismaTransactionClient, userId: string): Promise<PlatformUserRow | null>
  grantRole(
    tx: PrismaTransactionClient,
    input: { id: string; userId: string; role: PlatformRole; actorUserId: string; reason: string },
  ): Promise<boolean>
  findActiveRole(
    tx: PrismaTransactionClient,
    userId: string,
    role: PlatformRole,
  ): Promise<{ id: string } | null>
  countActiveRole(tx: PrismaTransactionClient, role: PlatformRole): Promise<number>
  revokeRole(tx: PrismaTransactionClient, id: string, actorUserId: string): Promise<boolean>
  listChallenges(
    tx: PrismaTransactionClient,
    filters: { search?: string; status?: ChallengeStatus; visibility?: ChallengeVisibility },
    page: PageRequest,
  ): Promise<Page<PlatformChallengeRow>>
  analyticsSummary(tx: PrismaTransactionClient): Promise<PlatformAnalyticsSummary>
}

export function createPlatformAdminRepository(): PlatformAdminRepository {
  return {
    async listUsers(tx, filters, page) {
      const rows = await tx.user.findMany({
        where: {
          AND: [
            ...(filters.search
              ? [
                  {
                    OR: [
                      { name: { contains: filters.search, mode: 'insensitive' as const } },
                      { email: { contains: filters.search, mode: 'insensitive' as const } },
                    ],
                  },
                ]
              : []),
            ...(page.cursor
              ? [
                  {
                    OR: [
                      { createdAt: { lt: new Date(page.cursor.at) } },
                      { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                    ],
                  },
                ]
              : []),
          ],
          ...(filters.role
            ? { platformRoles: { some: { role: filters.role, revokedAt: null } } }
            : {}),
        },
        include: {
          platformRoles: {
            where: { revokedAt: null },
            select: { id: true, role: true, grantedAt: true },
            orderBy: { grantedAt: 'asc' },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async findUser(tx, userId) {
      return tx.user.findUnique({
        where: { id: userId },
        include: {
          platformRoles: {
            where: { revokedAt: null },
            select: { id: true, role: true, grantedAt: true },
            orderBy: { grantedAt: 'asc' },
          },
        },
      })
    },

    async grantRole(tx, input) {
      const result = await tx.platformRoleAssignment.createMany({
        data: [
          {
            id: input.id,
            userId: input.userId,
            role: input.role,
            grantedBy: input.actorUserId,
            reason: input.reason,
          },
        ],
        skipDuplicates: true,
      })
      return result.count === 1
    },

    async findActiveRole(tx, userId, role) {
      return tx.platformRoleAssignment.findFirst({
        where: { userId, role, revokedAt: null },
        select: { id: true },
      })
    },

    async countActiveRole(tx, role) {
      return tx.platformRoleAssignment.count({ where: { role, revokedAt: null } })
    },

    async revokeRole(tx, id, actorUserId) {
      const result = await tx.platformRoleAssignment.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date(), revokedBy: actorUserId },
      })
      return result.count === 1
    },

    async listChallenges(tx, filters, page) {
      const matchingOrganizations = filters.search
        ? await tx.organization.findMany({
            where: { name: { contains: filters.search, mode: 'insensitive' } },
            select: { id: true },
          })
        : []
      const rows = await tx.challenge.findMany({
        where: {
          AND: [
            ...(filters.search
              ? [
                  {
                    OR: [
                      { title: { contains: filters.search, mode: 'insensitive' as const } },
                      { organizationId: { in: matchingOrganizations.map((item) => item.id) } },
                    ],
                  },
                ]
              : []),
            ...(page.cursor
              ? [
                  {
                    OR: [
                      { createdAt: { lt: new Date(page.cursor.at) } },
                      { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                    ],
                  },
                ]
              : []),
          ],
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.visibility ? { visibility: filters.visibility } : {}),
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          slug: true,
          status: true,
          visibility: true,
          moderationHiddenAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      const organizations = await tx.organization.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.organizationId))] } },
        select: { id: true, name: true, slug: true },
      })
      const organizationById = new Map(
        organizations.map((organization) => [organization.id, organization]),
      )
      const mapped = rows.map((row) => {
        const organization = organizationById.get(row.organizationId)
        if (organization === undefined) {
          throw new Error(`Challenge ${row.id} references a missing organization.`)
        }
        return {
          ...row,
          organizationName: organization.name,
          organizationSlug: organization.slug,
        }
      })
      return buildPage(mapped, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async analyticsSummary(tx) {
      const [
        users,
        verifiedUsers,
        usersWithTwoFactor,
        activeOrganizations,
        suspendedOrganizations,
        challenges,
        publicChallenges,
        activeParticipations,
        finalizedSubmissions,
        openReports,
        openSupportTickets,
      ] = await Promise.all([
        tx.user.count({ where: { deletedAt: null } }),
        tx.user.count({ where: { deletedAt: null, emailVerified: true } }),
        tx.user.count({ where: { deletedAt: null, twoFactorEnabled: true } }),
        tx.organization.count({ where: { status: 'ACTIVE' } }),
        tx.organization.count({ where: { status: 'SUSPENDED' } }),
        tx.challenge.count(),
        tx.challenge.count({ where: { visibility: 'PUBLIC', moderationHiddenAt: null } }),
        tx.challengeParticipation.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } }),
        tx.submission.count({ where: { status: 'FINALIZED' } }),
        tx.contentReport.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
        tx.supportTicket.count({
          where: { status: { in: ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'WAITING_USER'] } },
        }),
      ])
      return {
        users,
        verifiedUsers,
        usersWithTwoFactor,
        activeOrganizations,
        suspendedOrganizations,
        challenges,
        publicChallenges,
        activeParticipations,
        finalizedSubmissions,
        openReports,
        openSupportTickets,
      }
    },
  }
}
