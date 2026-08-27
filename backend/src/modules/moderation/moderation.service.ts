import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, notFound, unprocessable } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type { PlatformAdminService } from '../platform-admin/platform-admin.service'
import type {
  ContentReportCategory,
  ContentReportRow,
  ContentReportStatus,
  ContentReportTargetType,
  ModerationRepository,
} from './moderation.repository'

/**
 * Moderation and abuse (master prompt section 28).
 *
 * A challenge report only resolves against `public_challenge_view` — the
 * same restriction the master prompt states explicitly ("public challenge"),
 * so a user can only report a challenge they could actually see. An
 * organization report resolves either through the reporter's own membership
 * (a member reporting internal abuse a stranger could never see) or through
 * `public_organization_view` for a public organization — a report against
 * an ID that resolves through neither path gets exactly the 404 a
 * non-existent ID would, never a hint about which case failed.
 */

const TERMINAL_REPORT_STATUSES: ReadonlySet<ContentReportStatus> = new Set([
  'DISMISSED',
  'ACTION_TAKEN',
])

export interface CreateReportInput {
  targetType: ContentReportTargetType
  targetId: string
  category: ContentReportCategory
  description: string
}

export interface ModerationService {
  create(access: AccessContext, input: CreateReportInput): Promise<ContentReportRow>
  listMine(
    access: AccessContext,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<ContentReportRow>>

  listForPlatform(
    access: AccessContext,
    filters: { status?: ContentReportStatus },
    query: { limit?: number; cursor?: string },
  ): Promise<Page<ContentReportRow>>
  getForPlatform(access: AccessContext, reportId: string): Promise<ContentReportRow>
  dismiss(access: AccessContext, reportId: string, reason: string): Promise<ContentReportRow>
  hideContent(access: AccessContext, reportId: string, reason: string): Promise<ContentReportRow>
  restoreContent(access: AccessContext, reportId: string, reason: string): Promise<ContentReportRow>
  suspendOrganization(
    access: AccessContext,
    reportId: string,
    reason: string,
  ): Promise<ContentReportRow>
}

export function createModerationService(
  repository: ModerationRepository,
  platformAdminService: PlatformAdminService,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  rateLimiter: RateLimiter,
  limits: PaginationLimits,
): ModerationService {
  async function loadOrThrow(tx: Parameters<ModerationRepository['findById']>[0], id: string) {
    const report = await repository.findById(tx, id)
    if (report === null) throw notFound('Report not found.')
    return report
  }

  function assertReviewable(report: ContentReportRow): void {
    if (TERMINAL_REPORT_STATUSES.has(report.status)) {
      throw conflict(ErrorCode.CONFLICT, 'This report has already been resolved.')
    }
  }

  return {
    async create(access, input) {
      const { actor } = requireVerifiedActor(access)
      await rateLimiter.enforce(RateLimitPolicies.ContentReportCreation, { userId: actor.userId })

      // Resolve the report target through the reporter's own visibility. The
      // membership check and the public-view lookups read across tenants, so
      // they run in a public-projection transaction; the report row and its
      // audit record are then written separately with no such bypass.
      const targetOrganizationId = await transactions.withPublicProjection(
        async (tx) => {
          if (input.targetType === 'ORGANIZATION') {
            const isMember = await repository.hasMembership(tx, actor.userId, input.targetId)
            const resolved = isMember
              ? input.targetId
              : await repository.findPublicOrganizationId(tx, input.targetId)
            if (resolved === null) throw notFound('Organization not found.')
            return resolved
          }
          const resolved = await repository.findPublicChallengeOrganizationId(tx, input.targetId)
          if (resolved === null) throw notFound('Challenge not found.')
          return resolved
        },
        { actorUserId: actor.userId },
      )

      return transactions.withoutTenant(
        async (tx) => {
          const report = await repository.create(tx, {
            id: newId(),
            reporterUserId: actor.userId,
            targetType: input.targetType,
            targetId: input.targetId,
            targetOrganizationId,
            category: input.category,
            description: input.description,
          })

          await audit.write(tx, {
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.ContentReported,
            resourceType: 'content_report',
            resourceId: report.id,
            summary: `Reported a ${input.targetType.toLowerCase()} for ${input.category}.`,
          })

          return report
        },
        { actorUserId: actor.userId },
      )
    },

    async listMine(access, query) {
      const { actor } = requireVerifiedActor(access)
      const page = toPageRequest(query, limits)
      return transactions.withoutTenant((tx) => repository.listForUser(tx, actor.userId, page))
    },

    async listForPlatform(access, filters, query) {
      authorize(access, Permission.PlatformModerate)
      const page = toPageRequest(query, limits)
      return transactions.withoutTenant((tx) => repository.listForPlatform(tx, filters, page))
    },

    async getForPlatform(access, reportId) {
      authorize(access, Permission.PlatformModerate)
      return transactions.withoutTenant((tx) => loadOrThrow(tx, reportId))
    },

    async dismiss(access, reportId, reason) {
      authorize(access, Permission.PlatformModerate)
      const { actor } = requireVerifiedActor(access)

      return transactions.withPlatformAccess(
        async (tx) => {
          const report = await loadOrThrow(tx, reportId)
          assertReviewable(report)

          const updated = await repository.markReviewed(tx, reportId, {
            status: 'DISMISSED',
            reviewedByUserId: actor.userId,
            resolutionReason: reason,
          })

          await audit.write(tx, {
            organizationId: report.targetOrganizationId ?? undefined,
            actorType: 'PLATFORM_ADMIN',
            actorUserId: actor.userId,
            action: AuditAction.ContentReportDismissed,
            resourceType: 'content_report',
            resourceId: reportId,
            summary: 'Dismissed a content report.',
            reason,
          })

          return updated
        },
        { purpose: 'moderation: dismiss a content report', actorUserId: actor.userId },
      )
    },

    async hideContent(access, reportId, reason) {
      authorize(access, Permission.PlatformModerate, { requireFreshSession: true })
      const { actor } = requireVerifiedActor(access)

      const report = await transactions.withoutTenant((tx) => loadOrThrow(tx, reportId))
      assertReviewable(report)
      if (report.targetType !== 'CHALLENGE') {
        throw unprocessable(
          ErrorCode.VALIDATION_FAILED,
          'Only a challenge report can be actioned with hide-content.',
        )
      }

      return transactions.withPlatformAccess(
        async (tx) => {
          await tx.challenge.update({
            where: { id: report.targetId },
            data: { moderationHiddenAt: new Date(), moderationHiddenReason: reason },
          })

          const updated = await repository.markReviewed(tx, reportId, {
            status: 'ACTION_TAKEN',
            reviewedByUserId: actor.userId,
            resolutionReason: reason,
          })

          await audit.write(tx, {
            organizationId: report.targetOrganizationId ?? undefined,
            actorType: 'PLATFORM_ADMIN',
            actorUserId: actor.userId,
            action: AuditAction.ContentHidden,
            resourceType: 'challenge',
            resourceId: report.targetId,
            summary: 'Hid a challenge from public view following a content report.',
            reason,
          })

          return updated
        },
        { purpose: 'moderation: hide reported challenge content', actorUserId: actor.userId },
      )
    },

    async restoreContent(access, reportId, reason) {
      authorize(access, Permission.PlatformModerate, { requireFreshSession: true })
      const { actor } = requireVerifiedActor(access)

      const report = await transactions.withoutTenant((tx) => loadOrThrow(tx, reportId))
      if (report.targetType !== 'CHALLENGE') {
        throw unprocessable(
          ErrorCode.VALIDATION_FAILED,
          'Only a challenge report can be actioned with restore-content.',
        )
      }

      return transactions.withPlatformAccess(
        async (tx) => {
          await tx.challenge.update({
            where: { id: report.targetId },
            data: { moderationHiddenAt: null, moderationHiddenReason: null },
          })

          const updated = await repository.markReviewed(tx, reportId, {
            status: 'ACTION_TAKEN',
            reviewedByUserId: actor.userId,
            resolutionReason: reason,
          })

          await audit.write(tx, {
            organizationId: report.targetOrganizationId ?? undefined,
            actorType: 'PLATFORM_ADMIN',
            actorUserId: actor.userId,
            action: AuditAction.ContentRestored,
            resourceType: 'challenge',
            resourceId: report.targetId,
            summary: 'Restored a previously hidden challenge to public view.',
            reason,
          })

          return updated
        },
        { purpose: 'moderation: restore reported challenge content', actorUserId: actor.userId },
      )
    },

    async suspendOrganization(access, reportId, reason) {
      authorize(access, Permission.PlatformModerate, { requireFreshSession: true })
      const { actor } = requireVerifiedActor(access)

      const report = await transactions.withoutTenant((tx) => loadOrThrow(tx, reportId))
      assertReviewable(report)
      if (report.targetType !== 'ORGANIZATION') {
        throw unprocessable(
          ErrorCode.VALIDATION_FAILED,
          'Only an organization report can be actioned with suspend-organization.',
        )
      }

      // Delegated rather than duplicated (master prompt section 47: no
      // parallel implementation of an action that already exists). This
      // additionally requires Permission.PlatformManageOrganizations, which
      // `platformAdminService.suspend` enforces itself — moderation staff
      // alone cannot suspend an organization; suspension needs the
      // organization-management authorization too ("where authorized").
      // The suspension and the report's own status update are two
      // transactions rather than one: platformAdminService owns its own
      // transaction boundary, and re-entering it here would either nest
      // transactions or duplicate its authorization/audit logic. If the
      // report update below fails after a successful suspension, the
      // suspension itself — the actual protective effect — still stands;
      // only the report's own bookkeeping would need a manual follow-up.
      await platformAdminService.suspend(access, report.targetId, reason)

      return transactions.withPlatformAccess(
        async (tx) => {
          const updated = await repository.markReviewed(tx, reportId, {
            status: 'ACTION_TAKEN',
            reviewedByUserId: actor.userId,
            resolutionReason: reason,
          })

          await audit.write(tx, {
            organizationId: report.targetOrganizationId ?? undefined,
            actorType: 'PLATFORM_ADMIN',
            actorUserId: actor.userId,
            action: AuditAction.ContentReportActionTaken,
            resourceType: 'content_report',
            resourceId: reportId,
            summary: 'Suspended the reported organization and closed the report.',
            reason,
          })

          return updated
        },
        {
          purpose: 'moderation: close a report after organization suspension',
          actorUserId: actor.userId,
        },
      )
    },
  }
}
