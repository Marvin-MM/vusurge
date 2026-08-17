import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import type { AuditSummaryRow } from '../audit/audit.repository'
import type { AuditService } from '../audit/audit.service'
import type {
  OrganizationRow,
  OrganizationsRepository,
} from '../organizations/organizations.repository'

/**
 * Platform-wide organization administration.
 *
 * There is no dedicated repository file here: every query this module needs
 * (cross-tenant listing, status transitions) already exists on
 * `OrganizationsRepository`, and this module's own contribution is the
 * platform-authorization and audit policy around calling it — not a new
 * persistence surface. Adding a pass-through repository that just forwards to
 * another module's would be ceremony, not structure (master prompt section
 * 47: DRY / no interface-for-every-class).
 */

const FRESH_SESSION_MAX_AGE_SECONDS = 900

export interface PlatformAdminService {
  listOrganizations(
    access: AccessContext,
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | undefined,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<OrganizationRow>>
  getOrganization(access: AccessContext, organizationId: string): Promise<OrganizationRow>
  suspend(access: AccessContext, organizationId: string, reason: string): Promise<void>
  reinstate(access: AccessContext, organizationId: string, reason: string): Promise<void>
  archive(access: AccessContext, organizationId: string, reason: string): Promise<void>
  getAuditSummary(access: AccessContext, organizationId: string): Promise<AuditSummaryRow>
}

export function createPlatformAdminService(
  organizationsRepository: OrganizationsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  limits: PaginationLimits,
  auditService: AuditService,
): PlatformAdminService {
  return {
    async listOrganizations(access, status, query) {
      authorize(access, Permission.PlatformManageOrganizations)
      const page = toPageRequest(query, limits)
      return transactions.withPlatformAccess(
        (tx) => organizationsRepository.listAllForPlatform(tx, status, page),
        {
          purpose: 'platform organization administration: list',
          actorUserId: access.actor?.userId,
        },
      )
    },

    async getOrganization(access, organizationId) {
      authorize(access, Permission.PlatformManageOrganizations)
      const organization = await transactions.withPlatformAccess(
        (tx) => organizationsRepository.findById(tx, organizationId),
        { purpose: 'platform organization administration: get', actorUserId: access.actor?.userId },
      )
      if (organization === null) throw notFound('Organization not found.')
      return organization
    },

    async suspend(access, organizationId, reason) {
      authorize(access, Permission.PlatformManageOrganizations, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
      })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const organization = await organizationsRepository.findById(tx, organizationId)
          if (organization === null) throw notFound('Organization not found.')
          if (organization.status === 'SUSPENDED') {
            throw conflict(
              ErrorCode.ORGANIZATION_SUSPENDED,
              'This organization is already suspended.',
            )
          }
          if (organization.status === 'ARCHIVED') {
            throw conflict(
              ErrorCode.ORGANIZATION_ARCHIVED,
              'An archived organization cannot be suspended.',
            )
          }

          await organizationsRepository.setStatus(tx, organizationId, 'SUSPENDED', {
            suspendedReason: reason,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.OrganizationSuspended,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: 'Suspended the organization.',
            reason,
          })
        },
        { actorUserId },
      )
    },

    async reinstate(access, organizationId, reason) {
      authorize(access, Permission.PlatformManageOrganizations, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
        allowSuspendedOrganization: true,
      })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const organization = await organizationsRepository.findById(tx, organizationId)
          if (organization === null) throw notFound('Organization not found.')
          if (organization.status !== 'SUSPENDED') {
            throw conflict(ErrorCode.CONFLICT, 'Only a suspended organization can be reinstated.')
          }

          await organizationsRepository.setStatus(tx, organizationId, 'ACTIVE', {})

          await audit.write(tx, {
            organizationId,
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.OrganizationReinstated,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: 'Reinstated the organization.',
            reason,
          })
        },
        { actorUserId },
      )
    },

    async archive(access, organizationId, reason) {
      authorize(access, Permission.PlatformManageOrganizations, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
        allowSuspendedOrganization: true,
      })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const organization = await organizationsRepository.findById(tx, organizationId)
          if (organization === null) throw notFound('Organization not found.')
          if (organization.status === 'ARCHIVED') {
            throw conflict(
              ErrorCode.ORGANIZATION_ARCHIVED,
              'This organization is already archived.',
            )
          }

          await organizationsRepository.setStatus(tx, organizationId, 'ARCHIVED', {})

          await audit.write(tx, {
            organizationId,
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.OrganizationArchived,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: 'Archived the organization (platform action).',
            reason,
          })
        },
        { actorUserId },
      )
    },

    async getAuditSummary(access, organizationId) {
      // Nested under organization administration for discoverability, but
      // deliberately not a bypass: this delegates straight to the audit
      // module's own Permission.PlatformViewAudit gate and self-auditing
      // withPlatformAccess call, the same control every other platform audit
      // read goes through (master prompt section 34.35).
      authorize(access, Permission.PlatformManageOrganizations)
      const organization = await transactions.withPlatformAccess(
        (tx) => organizationsRepository.findById(tx, organizationId),
        {
          purpose: 'platform organization administration: audit summary lookup',
          actorUserId: access.actor?.userId,
        },
      )
      if (organization === null) throw notFound('Organization not found.')

      return auditService.getSummaryForOrganization(access, organizationId)
    },
  }
}
