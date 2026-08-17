import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type OrgRole = 'ORG_OWNER' | 'ORG_ADMIN' | 'CHALLENGE_MANAGER' | 'MEMBER'

export interface MembershipRow {
  id: string
  organizationId: string
  userId: string
  role: OrgRole
  status: 'ACTIVE' | 'INACTIVE'
  source: string
  joinedAt: Date
  removedAt: Date | null
}

export interface MemberListRow extends MembershipRow {
  userEmail: string
  displayName: string | null
}

export interface CreateMembershipInput {
  id: string
  organizationId: string
  userId: string
  role: OrgRole
  source: string
}

export interface MembershipsRepository {
  find(
    client: PrismaTransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<MembershipRow | null>
  /** Same row shape the list endpoint returns, for the single-member GET. */
  findForList(
    client: PrismaTransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<MemberListRow | null>
  create(client: PrismaTransactionClient, input: CreateMembershipInput): Promise<MembershipRow>
  /** Reactivates a previously removed membership row rather than duplicating it. */
  reactivate(
    client: PrismaTransactionClient,
    organizationId: string,
    userId: string,
    role: OrgRole,
    source: string,
  ): Promise<MembershipRow>
  /**
   * Change a member's role.
   *
   * Atomic and race-safe for the dangerous case (demoting the last owner):
   * the UPDATE's WHERE clause re-evaluates the active-owner count against the
   * database at the moment it acquires the row lock, so two concurrent
   * demotions of the same sole owner cannot both succeed — the second sees
   * the reduced count and affects zero rows (master prompt sections 32, 41.4).
   * Returns false when the change was refused to protect the last owner.
   */
  updateRole(
    client: PrismaTransactionClient,
    organizationId: string,
    userId: string,
    role: OrgRole,
  ): Promise<boolean>
  /** Same last-owner guard as `updateRole`, applied to removal. */
  remove(
    client: PrismaTransactionClient,
    organizationId: string,
    userId: string,
    removedByUserId: string,
  ): Promise<boolean>
  /** Count of ACTIVE owners, used to enforce the last-owner invariant. */
  countActiveOwners(client: PrismaTransactionClient, organizationId: string): Promise<number>
  list(
    client: PrismaTransactionClient,
    organizationId: string,
    filters: { role?: OrgRole; status?: 'ACTIVE' | 'INACTIVE' },
    page: PageRequest,
  ): Promise<Page<MemberListRow>>
}

export function createMembershipsRepository(): MembershipsRepository {
  return {
    async find(client, organizationId, userId) {
      return client.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      })
    },

    async findForList(client, organizationId, userId) {
      const row = await client.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          role: true,
          status: true,
          source: true,
          joinedAt: true,
          removedAt: true,
          user: { select: { email: true, profile: { select: { displayName: true } } } },
        },
      })
      if (row === null) return null
      return {
        id: row.id,
        organizationId: row.organizationId,
        userId: row.userId,
        role: row.role,
        status: row.status,
        source: row.source,
        joinedAt: row.joinedAt,
        removedAt: row.removedAt,
        userEmail: row.user.email,
        displayName: row.user.profile?.displayName ?? null,
      }
    },

    async create(client, input) {
      return client.organizationMembership.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          userId: input.userId,
          role: input.role,
          status: 'ACTIVE',
          source: input.source,
        },
      })
    },

    async reactivate(client, organizationId, userId, role, source) {
      return client.organizationMembership.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: {
          status: 'ACTIVE',
          role,
          source,
          joinedAt: new Date(),
          removedAt: null,
          removedByUserId: null,
        },
      })
    },

    async updateRole(client, organizationId, userId, role) {
      // The guard only matters when leaving ORG_OWNER; the subquery is cheap
      // and always correct to include, so it is not special-cased away.
      const affected = await client.$executeRaw`
        update organization_membership
        set role = ${role}::"OrganizationRole", updated_at = now()
        where organization_id = ${organizationId}::uuid
          and user_id = ${userId}::uuid
          and status = 'ACTIVE'
          and (
            role <> 'ORG_OWNER'
            or role = ${role}::"OrganizationRole"
            or (
              select count(*) from organization_membership
              where organization_id = ${organizationId}::uuid
                and role = 'ORG_OWNER'
                and status = 'ACTIVE'
            ) > 1
          )
      `
      return affected > 0
    },

    async remove(client, organizationId, userId, removedByUserId) {
      const affected = await client.$executeRaw`
        update organization_membership
        set status = 'INACTIVE', removed_at = now(), removed_by_user_id = ${removedByUserId}::uuid,
            updated_at = now()
        where organization_id = ${organizationId}::uuid
          and user_id = ${userId}::uuid
          and status = 'ACTIVE'
          and (
            role <> 'ORG_OWNER'
            or (
              select count(*) from organization_membership
              where organization_id = ${organizationId}::uuid
                and role = 'ORG_OWNER'
                and status = 'ACTIVE'
            ) > 1
          )
      `
      return affected > 0
    },

    async countActiveOwners(client, organizationId) {
      return client.organizationMembership.count({
        where: { organizationId, role: 'ORG_OWNER', status: 'ACTIVE' },
      })
    },

    async list(client, organizationId, filters, page) {
      const rows = await client.organizationMembership.findMany({
        where: {
          organizationId,
          ...(filters.role ? { role: filters.role } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(page.cursor
            ? {
                OR: [
                  { joinedAt: { lt: new Date(page.cursor.at) } },
                  { joinedAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          role: true,
          status: true,
          source: true,
          joinedAt: true,
          removedAt: true,
          user: { select: { email: true, profile: { select: { displayName: true } } } },
        },
        orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })

      const mapped = rows.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        userId: row.userId,
        role: row.role,
        status: row.status,
        source: row.source,
        joinedAt: row.joinedAt,
        removedAt: row.removedAt,
        userEmail: row.user.email,
        displayName: row.user.profile?.displayName ?? null,
      }))

      return buildPage(mapped, page, (row) => ({ at: row.joinedAt.toISOString(), id: row.id }))
    },
  }
}
