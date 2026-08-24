import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { notFound } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import type {
  AuditEventRow,
  AuditEventWithActorRow,
  AuditRepository,
  AuditSummaryRow,
  PlatformAuditFilters,
} from './audit.repository'

/**
 * Read-only audit access (master prompt section 34.32). No update/delete
 * endpoint exists — matching the database grants themselves, which permit
 * the runtime role only INSERT/SELECT on `audit_event`.
 *
 * Platform-wide audit access is itself audited: every `listForPlatform`/
 * `getForPlatform` call goes through `withPlatformAccess`, which requires a
 * purpose string and writes its own `platform.audit_accessed` entry — a
 * superadmin reading the audit trail leaves the same kind of record as any
 * other platform-administrative action.
 */
export interface AuditService {
  listForOrganization(
    access: AccessContext,
    organizationId: string,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<AuditEventWithActorRow>>
  getForOrganization(
    access: AccessContext,
    organizationId: string,
    auditEventId: string,
  ): Promise<AuditEventRow>
  listForPlatform(
    access: AccessContext,
    filters: PlatformAuditFilters,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<AuditEventWithActorRow>>
  getForPlatform(access: AccessContext, auditEventId: string): Promise<AuditEventRow>
  getSummaryForOrganization(access: AccessContext, organizationId: string): Promise<AuditSummaryRow>
}

export function createAuditService(
  repository: AuditRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  limits: PaginationLimits,
): AuditService {
  return {
    async listForOrganization(access, organizationId, query) {
      authorize(access, Permission.OrganizationViewAudit)
      const page = toPageRequest(query, limits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listForOrganization(tx, organizationId, page),
      )
    },

    async getForOrganization(access, organizationId, auditEventId) {
      authorize(access, Permission.OrganizationViewAudit)
      const event = await transactions.withTenant(organizationId, (tx) =>
        repository.findForOrganization(tx, organizationId, auditEventId),
      )
      if (event === null) throw notFound('Audit event not found.')
      return event
    },

    async listForPlatform(access, filters, query) {
      authorize(access, Permission.PlatformViewAudit)
      const page = toPageRequest(query, limits)
      const actorUserId = access.actor?.userId

      return transactions.withPlatformAccess(
        async (tx) => {
          const result = await repository.listForPlatform(tx, filters, page)

          await audit.write(tx, {
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.PlatformAuditAccessed,
            resourceType: 'audit_event',
            summary: 'Listed platform-wide audit events.',
          })

          return result
        },
        { purpose: 'platform audit: list', actorUserId },
      )
    },

    async getForPlatform(access, auditEventId) {
      authorize(access, Permission.PlatformViewAudit)
      const actorUserId = access.actor?.userId

      return transactions.withPlatformAccess(
        async (tx) => {
          const event = await repository.findForPlatform(tx, auditEventId)
          if (event === null) throw notFound('Audit event not found.')

          await audit.write(tx, {
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.PlatformAuditAccessed,
            resourceType: 'audit_event',
            resourceId: auditEventId,
            summary: 'Viewed a single platform audit event.',
          })

          return event
        },
        { purpose: 'platform audit: get', actorUserId },
      )
    },

    async getSummaryForOrganization(access, organizationId) {
      authorize(access, Permission.PlatformViewAudit)
      const actorUserId = access.actor?.userId

      return transactions.withPlatformAccess(
        async (tx) => {
          const summary = await repository.summarizeForOrganization(tx, organizationId)

          await audit.write(tx, {
            organizationId,
            actorType: 'PLATFORM_ADMIN',
            actorUserId,
            action: AuditAction.PlatformAuditAccessed,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: "Viewed an organization's audit summary.",
          })

          return summary
        },
        { purpose: 'platform audit: organization summary', actorUserId },
      )
    },
  }
}
