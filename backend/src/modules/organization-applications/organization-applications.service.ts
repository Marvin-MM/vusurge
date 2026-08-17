import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type { MembershipsRepository } from '../memberships/memberships.repository'
import { createOwnerMembership } from '../memberships/memberships.service'
import type { OrganizationsRepository } from '../organizations/organizations.repository'
import type {
  ApplicationEditableFields,
  ApplicationRow,
  ApplicationStatus,
  OrganizationApplicationsRepository,
} from './organization-applications.repository'

const FRESH_SESSION_MAX_AGE_SECONDS = 900

export interface CreateApplicationInput {
  name: string
  requestedSlug: string
  organizationType: string
  description: string
  websiteUrl?: string
  socialLinks?: string[]
  country?: string
  region?: string
  affiliatedInstitution?: string
  requesterRelationship: string
  requestedVisibility: 'PRIVATE' | 'PUBLIC'
  acceptedTermsVersion: string
}

export interface OrganizationApplicationsService {
  enforceCreateRateLimit(access: AccessContext): Promise<void>
  create(
    access: AccessContext,
    input: CreateApplicationInput,
    transaction?: PrismaTransactionClient,
  ): Promise<ApplicationRow>
  listMine(
    access: AccessContext,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<ApplicationRow>>
  get(access: AccessContext, id: string): Promise<ApplicationRow>
  update(
    access: AccessContext,
    id: string,
    patch: ApplicationEditableFields,
  ): Promise<ApplicationRow>
  resubmit(
    access: AccessContext,
    id: string,
    patch: ApplicationEditableFields,
  ): Promise<ApplicationRow>
  listForPlatform(
    access: AccessContext,
    status: ApplicationStatus | undefined,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<ApplicationRow>>
  getForPlatform(access: AccessContext, id: string): Promise<ApplicationRow>
  approve(
    access: AccessContext,
    id: string,
    notes: string | undefined,
  ): Promise<{ organizationId: string; organizationSlug: string }>
  reject(
    access: AccessContext,
    id: string,
    reason: string,
    internalNotes: string | undefined,
  ): Promise<void>
}

export function createOrganizationApplicationsService(
  repository: OrganizationApplicationsRepository,
  organizationsRepository: OrganizationsRepository,
  membershipsRepository: MembershipsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  rateLimiter: RateLimiter,
  limits: PaginationLimits,
): OrganizationApplicationsService {
  return {
    async enforceCreateRateLimit(access) {
      const { actor } = requireVerifiedActor(access)
      await rateLimiter.enforce(RateLimitPolicies.OrganizationApplication, {
        userId: actor.userId,
        ipAddress: access.ipAddress,
      })
    },

    async create(access, input, transaction) {
      const { actor } = requireVerifiedActor(access)
      // A controller that supplies the idempotency transaction performs this
      // Redis check before opening that transaction. Direct service callers
      // still receive the same abuse protection.
      if (transaction === undefined) {
        await rateLimiter.enforce(RateLimitPolicies.OrganizationApplication, {
          userId: actor.userId,
          ipAddress: access.ipAddress,
        })
      }

      const execute = async (tx: PrismaTransactionClient) => {
        const hasPending = await repository.hasPending(tx, actor.userId)
        if (hasPending) {
          throw conflict(
            ErrorCode.APPLICATION_ALREADY_PENDING,
            'You already have a pending organization application. Wait for a decision before submitting another.',
          )
        }

        const now = await transactions.databaseNow(tx)
        const created = await repository.create(tx, {
          id: newId(),
          requesterUserId: actor.userId,
          ...input,
          acceptedTermsAt: now,
        })

        await audit.write(tx, {
          actorType: 'USER',
          actorUserId: actor.userId,
          action: AuditAction.OrganizationApplicationSubmitted,
          resourceType: 'organization_application',
          resourceId: created.id,
          summary: `Submitted an application to create "${input.name}".`,
        })

        return created
      }

      if (transaction !== undefined) return execute(transaction)
      return transactions.withoutTenant(execute, { actorUserId: actor.userId })
    },

    async listMine(access, query) {
      const { actor } = requireVerifiedActor(access)
      const page = toPageRequest(query, limits)
      return transactions.withoutTenant((tx) => repository.listMine(tx, actor.userId, page))
    },

    async get(access, id) {
      const application = await transactions.withoutTenant((tx) => repository.findById(tx, id))
      if (application === null) throw notFound('Application not found.')

      const isOwner = access.actor?.userId === application.requesterUserId
      const isPlatformStaff = access.actor?.platformRoles.includes('PLATFORM_SUPERADMIN') ?? false
      if (!isOwner && !isPlatformStaff) {
        throw notFound('Application not found.')
      }
      return application
    },

    async update(access, id, patch) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(
        async (tx) => {
          const application = await repository.findById(tx, id)
          if (application === null || application.requesterUserId !== actor.userId) {
            throw notFound('Application not found.')
          }
          if (application.status !== 'PENDING_REVIEW') {
            throw conflict(
              ErrorCode.APPLICATION_NOT_EDITABLE,
              'This application can no longer be edited.',
            )
          }

          await repository.update(tx, id, patch)

          await audit.write(tx, {
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.OrganizationApplicationUpdated,
            resourceType: 'organization_application',
            resourceId: id,
            summary: 'Updated organization application.',
            changes: { after: patch },
          })

          const after = await repository.findById(tx, id)
          if (after === null) throw notFound('Application not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    async resubmit(access, id, patch) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withoutTenant(
        async (tx) => {
          const application = await repository.findById(tx, id)
          if (application === null || application.requesterUserId !== actor.userId) {
            throw notFound('Application not found.')
          }
          if (application.status !== 'REJECTED') {
            throw conflict(
              ErrorCode.APPLICATION_NOT_EDITABLE,
              'Only a rejected application can be resubmitted.',
            )
          }

          if (Object.keys(patch).length > 0) {
            await repository.update(tx, id, patch)
          }

          const now = await transactions.databaseNow(tx)
          await repository.markResubmitted(tx, id, now)

          await audit.write(tx, {
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.OrganizationApplicationResubmitted,
            resourceType: 'organization_application',
            resourceId: id,
            summary: 'Resubmitted a rejected organization application.',
          })

          const after = await repository.findById(tx, id)
          if (after === null) throw notFound('Application not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    async listForPlatform(access, status, query) {
      authorize(access, Permission.PlatformReviewApplications)
      const page = toPageRequest(query, limits)
      return transactions.withoutTenant((tx) => repository.listForPlatform(tx, status, page))
    },

    async getForPlatform(access, id) {
      authorize(access, Permission.PlatformReviewApplications)
      const application = await transactions.withoutTenant((tx) => repository.findById(tx, id))
      if (application === null) throw notFound('Application not found.')
      return application
    },

    async approve(access, id, notes) {
      authorize(access, Permission.PlatformReviewApplications, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
      })
      const reviewerId = access.actor?.userId
      if (reviewerId === undefined) throw forbidden()

      const application = await transactions.withoutTenant((tx) => repository.findById(tx, id))
      if (application === null) throw notFound('Application not found.')
      if (application.status !== 'PENDING_REVIEW') {
        throw conflict(
          ErrorCode.APPLICATION_ALREADY_DECIDED,
          'This application has already been decided.',
        )
      }

      const slugTaken = await transactions.withoutTenant((tx) =>
        organizationsRepository.isSlugTaken(tx, application.requestedSlug),
      )
      if (slugTaken) {
        throw conflict(
          ErrorCode.ORGANIZATION_SLUG_TAKEN,
          'The requested organization slug is no longer available. Ask the applicant to choose another.',
        )
      }

      const organizationId = newId()

      // The whole activation happens inside one transaction scoped to the
      // organization being created: organization, settings, the first owner
      // membership, the application's own status, the audit record, and the
      // outbox event all commit together or not at all.
      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const now = await transactions.databaseNow(tx)

          await organizationsRepository.create(tx, {
            id: organizationId,
            slug: application.requestedSlug,
            name: application.name,
            organizationType: application.organizationType,
            description: application.description,
            websiteUrl: application.websiteUrl ?? undefined,
            country: application.country ?? undefined,
            region: application.region ?? undefined,
            visibility: application.requestedVisibility,
          })

          await createOwnerMembership(
            membershipsRepository,
            tx,
            organizationId,
            application.requesterUserId,
          )

          await repository.markApproved(tx, id, { reviewerId, organizationId, notes, now })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: reviewerId,
            action: AuditAction.OrganizationApplicationApproved,
            resourceType: 'organization_application',
            resourceId: id,
            summary: `Approved the application and created "${application.name}".`,
            reason: notes,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: reviewerId,
            action: AuditAction.OrganizationCreated,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: `Organization "${application.name}" created via application approval.`,
          })

          await outbox.write(tx, {
            eventType: 'organization_application.decided',
            queueName: QueueName.Email,
            aggregateType: 'organization_application',
            aggregateId: id,
            organizationId,
            dedupeKey: `organization-application-approved:${id}`,
            payload: {
              applicantUserId: application.requesterUserId,
              organizationName: application.name,
              approved: true,
            },
          })
        },
        { actorUserId: reviewerId },
      )

      return { organizationId, organizationSlug: application.requestedSlug }
    },

    async reject(access, id, reason, internalNotes) {
      authorize(access, Permission.PlatformReviewApplications, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
      })
      const reviewerId = access.actor?.userId
      if (reviewerId === undefined) throw forbidden()

      await transactions.withoutTenant(
        async (tx) => {
          const application = await repository.findById(tx, id)
          if (application === null) throw notFound('Application not found.')
          if (application.status !== 'PENDING_REVIEW') {
            throw conflict(
              ErrorCode.APPLICATION_ALREADY_DECIDED,
              'This application has already been decided.',
            )
          }

          const now = await transactions.databaseNow(tx)
          await repository.markRejected(tx, id, { reviewerId, reason, internalNotes, now })

          await audit.write(tx, {
            actorType: 'USER',
            actorUserId: reviewerId,
            action: AuditAction.OrganizationApplicationRejected,
            resourceType: 'organization_application',
            resourceId: id,
            summary: `Rejected the application to create "${application.name}".`,
            reason,
          })

          await outbox.write(tx, {
            eventType: 'organization_application.decided',
            queueName: QueueName.Email,
            aggregateType: 'organization_application',
            aggregateId: id,
            dedupeKey: `organization-application-rejected:${id}`,
            payload: {
              applicantUserId: application.requesterUserId,
              organizationName: application.name,
              approved: false,
              reason,
            },
          })
        },
        { actorUserId: reviewerId },
      )
    },
  }
}
