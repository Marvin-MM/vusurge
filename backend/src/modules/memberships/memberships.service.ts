import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, canAssignRole, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import type { PaginationLimits } from '../../shared/http'
import { type Page, toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { MemberListRow, MembershipsRepository, OrgRole } from './memberships.repository'

/**
 * Membership lifecycle rules.
 *
 * The single invariant every path here is built around: an active
 * organization must always have at least one active owner. Removal and
 * demotion of the last owner are refused, and the refusal is race-safe under
 * concurrent requests because the repository enforces it as a single atomic
 * UPDATE with the owner count re-checked at lock time — not a separate
 * check-then-write pair (master prompt sections 8, 32, 41.4).
 */

export interface MembershipsService {
  list(
    access: AccessContext,
    organizationId: string,
    filters: { role?: OrgRole; status?: 'ACTIVE' | 'INACTIVE' },
    query: { limit?: number; cursor?: string },
  ): Promise<Page<MemberListRow>>
  get(access: AccessContext, organizationId: string, targetUserId: string): Promise<MemberListRow>
  changeRole(
    access: AccessContext,
    organizationId: string,
    targetUserId: string,
    newRole: OrgRole,
  ): Promise<void>
  remove(access: AccessContext, organizationId: string, targetUserId: string): Promise<void>
  reactivate(
    access: AccessContext,
    organizationId: string,
    targetUserId: string,
    role: OrgRole | undefined,
  ): Promise<void>
}

export function createMembershipsService(
  repository: MembershipsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  limits: PaginationLimits,
): MembershipsService {
  return {
    async list(access, organizationId, filters, query) {
      authorize(access, Permission.OrganizationManageMembers)
      const page = toPageRequest(query, limits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.list(tx, organizationId, filters, page),
      )
    },

    async get(access, organizationId, targetUserId) {
      authorize(access, Permission.OrganizationManageMembers)
      const found = await transactions.withTenant(organizationId, (tx) =>
        repository.findForList(tx, organizationId, targetUserId),
      )
      if (found === null) throw notFound('Membership not found.')
      return found
    },

    async changeRole(access, organizationId, targetUserId, newRole) {
      authorize(access, Permission.OrganizationManageRoles, { requireFreshSession: true })
      const actorRole = access.organization?.role
      if (actorRole === null || actorRole === undefined) {
        throw forbidden('You do not have a role in this organization.')
      }

      // A role holder may never grant a role above their own, or the check
      // above degenerates into "any admin can mint an owner".
      if (!canAssignRole(actorRole, newRole)) {
        throw forbidden(
          'You cannot assign a role higher than your own.',
          ErrorCode.INSUFFICIENT_ROLE,
        )
      }

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const existing = await repository.find(tx, organizationId, targetUserId)
          if (existing === null || existing.status !== 'ACTIVE') {
            throw notFound('Membership not found.')
          }
          if (!canAssignRole(actorRole, existing.role)) {
            // Also refuse changing the role of someone who outranks the actor.
            throw forbidden(
              'You cannot change the role of a member who outranks you.',
              ErrorCode.INSUFFICIENT_ROLE,
            )
          }

          const applied = await repository.updateRole(tx, organizationId, targetUserId, newRole)
          if (!applied) {
            throw conflict(
              ErrorCode.LAST_OWNER_PROTECTED,
              'Every active organization must retain at least one active owner.',
            )
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.MembershipRoleChanged,
            resourceType: 'organization_membership',
            resourceId: existing.id,
            summary: `Changed ${targetUserId}'s role from ${existing.role} to ${newRole}.`,
            changes: { before: { role: existing.role }, after: { role: newRole } },
          })
        },
        { actorUserId: access.actor?.userId },
      )
    },

    async remove(access, organizationId, targetUserId) {
      authorize(access, Permission.OrganizationManageMembers, { requireFreshSession: true })

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const existing = await repository.find(tx, organizationId, targetUserId)
          if (existing === null || existing.status !== 'ACTIVE') {
            throw notFound('Membership not found.')
          }

          const actorRole = access.organization?.role
          if (
            existing.role === 'ORG_OWNER' &&
            (actorRole === null ||
              actorRole === undefined ||
              !canAssignRole(actorRole, 'ORG_OWNER'))
          ) {
            throw forbidden('Only an owner may remove another owner.', ErrorCode.INSUFFICIENT_ROLE)
          }

          const applied = await repository.remove(
            tx,
            organizationId,
            targetUserId,
            access.actor?.userId ?? targetUserId,
          )
          if (!applied) {
            throw conflict(
              ErrorCode.LAST_OWNER_PROTECTED,
              'Every active organization must retain at least one active owner.',
            )
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.MembershipRemoved,
            resourceType: 'organization_membership',
            resourceId: existing.id,
            summary: `Removed ${targetUserId} from the organization.`,
            changes: { before: { role: existing.role, status: 'ACTIVE' } },
          })
        },
        { actorUserId: access.actor?.userId },
      )
    },

    async reactivate(access, organizationId, targetUserId, role) {
      authorize(access, Permission.OrganizationManageMembers, { requireFreshSession: true })

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const existing = await repository.find(tx, organizationId, targetUserId)
          if (existing === null) throw notFound('Membership not found.')
          if (existing.status === 'ACTIVE') {
            throw conflict(ErrorCode.ALREADY_A_MEMBER, 'This user is already an active member.')
          }

          const actorRole = access.organization?.role
          const effectiveRole = role ?? existing.role
          if (
            actorRole === null ||
            actorRole === undefined ||
            !canAssignRole(actorRole, effectiveRole)
          ) {
            throw forbidden(
              'You cannot assign a role higher than your own.',
              ErrorCode.INSUFFICIENT_ROLE,
            )
          }

          await repository.reactivate(
            tx,
            organizationId,
            targetUserId,
            effectiveRole,
            'REACTIVATION',
          )

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.MembershipReactivated,
            resourceType: 'organization_membership',
            resourceId: existing.id,
            summary: `Reactivated ${targetUserId}'s membership as ${effectiveRole}.`,
          })
        },
        { actorUserId: access.actor?.userId },
      )
    },
  }
}

/**
 * Create the first membership of a brand-new organization (ORG_OWNER).
 *
 * Exported standalone rather than as a service method: it is invoked from the
 * organization-applications approval transaction, which already holds the
 * tenant transaction for the organization it is creating, and must not open a
 * second one.
 */
export async function createOwnerMembership(
  repository: MembershipsRepository,
  tx: Parameters<MembershipsRepository['create']>[0],
  organizationId: string,
  userId: string,
): Promise<void> {
  await repository.create(tx, {
    id: newId(),
    organizationId,
    userId,
    role: 'ORG_OWNER',
    source: 'ORGANIZATION_APPROVAL',
  })
}
