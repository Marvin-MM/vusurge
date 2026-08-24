import type {
  ChallengeStatus,
  ChallengeVisibility,
  PlatformRole,
} from '../../generated/prisma/enums'
import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { AppConfig } from '../../shared/config'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { AuditSummaryRow } from '../audit/audit.repository'
import type { AuditService } from '../audit/audit.service'
import type {
  OrganizationRow,
  OrganizationsRepository,
} from '../organizations/organizations.repository'
import type {
  PlatformAdminRepository,
  PlatformAnalyticsSummary,
  PlatformChallengeRow,
  PlatformUserRow,
} from './platform-admin.repository'

/** Platform-wide administration with explicit cross-tenant authorization and auditing. */

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
  listUsers(
    access: AccessContext,
    filters: { search?: string; role?: PlatformRole },
    query: { limit?: number; cursor?: string },
  ): Promise<Page<PlatformUserRow>>
  grantRole(
    access: AccessContext,
    userId: string,
    role: PlatformRole,
    reason: string,
  ): Promise<PlatformUserRow>
  revokeRole(
    access: AccessContext,
    userId: string,
    role: PlatformRole,
    reason: string,
  ): Promise<PlatformUserRow>
  listChallenges(
    access: AccessContext,
    filters: { search?: string; status?: ChallengeStatus; visibility?: ChallengeVisibility },
    query: { limit?: number; cursor?: string },
  ): Promise<Page<PlatformChallengeRow>>
  analyticsSummary(access: AccessContext): Promise<PlatformAnalyticsSummary>
  getSettings(access: AccessContext): Promise<{
    environment: string
    serviceVersion: string
    featureFlags: Record<string, boolean>
    security: {
      sessionExpiresInSeconds: number
      freshSessionMaxAgeSeconds: number
      rateLimitingEnabled: boolean
      failClosedOnHighRisk: boolean
      accountDeletionGraceDays: number
    }
    limits: {
      maxRequestBodyBytes: number
      maxImageBytes: number
      maxDocumentBytes: number
      maxSubmissionScreenshots: number
    }
  }>
}

export function createPlatformAdminService(
  organizationsRepository: OrganizationsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  limits: PaginationLimits,
  auditService: AuditService,
  platformRepository: PlatformAdminRepository,
  config: AppConfig,
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

    async listUsers(access, filters, query) {
      authorize(access, Permission.PlatformManageRoles)
      const page = toPageRequest(query, limits)
      return transactions.withPlatformAccess(
        (tx) => platformRepository.listUsers(tx, filters, page),
        {
          purpose: 'platform user directory: list',
          actorUserId: access.actor?.userId,
        },
      )
    },

    async grantRole(access, userId, role, reason) {
      authorize(access, Permission.PlatformManageRoles, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
      })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withPlatformAccess(
        async (tx) => {
          const target = await platformRepository.findUser(tx, userId)
          if (target === null || target.deletedAt !== null) throw notFound('User not found.')
          if (role === 'PLATFORM_SUPERADMIN' && !target.twoFactorEnabled) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Two-factor authentication must be enabled before granting superadmin access.',
            )
          }
          const created = await platformRepository.grantRole(tx, {
            id: newId(),
            userId,
            role,
            actorUserId,
            reason,
          })
          if (!created) {
            throw conflict(ErrorCode.CONFLICT, 'This user already holds that platform role.')
          }
          await audit.write(tx, {
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.PlatformRoleGranted,
            resourceType: 'user',
            resourceId: userId,
            summary: `Granted ${role} platform access.`,
            changes: { role },
            reason,
          })
          const updatedTarget = await platformRepository.findUser(tx, userId)
          if (updatedTarget === null) throw notFound('User not found.')
          return updatedTarget
        },
        {
          purpose: 'platform role administration: grant',
          actorUserId,
          isolationLevel: 'Serializable',
        },
      )
    },

    async revokeRole(access, userId, role, reason) {
      authorize(access, Permission.PlatformManageRoles, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
      })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withPlatformAccess(
        async (tx) => {
          const assignment = await platformRepository.findActiveRole(tx, userId, role)
          if (assignment === null) throw notFound('Active platform role not found.')
          if (
            role === 'PLATFORM_SUPERADMIN' &&
            (await platformRepository.countActiveRole(tx, 'PLATFORM_SUPERADMIN')) <= 1
          ) {
            throw conflict(ErrorCode.CONFLICT, 'The final platform superadmin cannot be revoked.')
          }
          const revoked = await platformRepository.revokeRole(tx, assignment.id, actorUserId)
          if (!revoked) throw conflict(ErrorCode.CONFLICT, 'This role has already been revoked.')
          await audit.write(tx, {
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.PlatformRoleRevoked,
            resourceType: 'user',
            resourceId: userId,
            summary: `Revoked ${role} platform access.`,
            changes: { role },
            reason,
          })
          const target = await platformRepository.findUser(tx, userId)
          if (target === null) throw notFound('User not found.')
          return target
        },
        {
          purpose: 'platform role administration: revoke',
          actorUserId,
          isolationLevel: 'Serializable',
        },
      )
    },

    async listChallenges(access, filters, query) {
      authorize(access, Permission.PlatformManageOrganizations)
      const page = toPageRequest(query, limits)
      return transactions.withPlatformAccess(
        (tx) => platformRepository.listChallenges(tx, filters, page),
        {
          purpose: 'platform challenge oversight: list',
          actorUserId: access.actor?.userId,
        },
      )
    },

    async analyticsSummary(access) {
      authorize(access, Permission.PlatformManageOrganizations)
      return transactions.withPlatformAccess((tx) => platformRepository.analyticsSummary(tx), {
        purpose: 'platform analytics summary: read',
        actorUserId: access.actor?.userId,
      })
    },

    async getSettings(access) {
      authorize(access, Permission.PlatformManageFeatureFlags)
      return {
        environment: config.app.environment,
        serviceVersion: config.app.version,
        featureFlags: { ...config.features },
        security: {
          sessionExpiresInSeconds: config.auth.sessionExpiresInSeconds,
          freshSessionMaxAgeSeconds: config.auth.freshSessionMaxAgeSeconds,
          rateLimitingEnabled: config.rateLimit.enabled,
          failClosedOnHighRisk: config.rateLimit.failClosedOnHighRisk,
          accountDeletionGraceDays: config.retention.accountDeletionGraceDays,
        },
        limits: {
          maxRequestBodyBytes: config.app.maxRequestBodyBytes,
          maxImageBytes: config.uploads.maxImageBytes,
          maxDocumentBytes: config.uploads.maxDocumentBytes,
          maxSubmissionScreenshots: config.uploads.maxSubmissionScreenshots,
        },
      }
    },
  }
}
