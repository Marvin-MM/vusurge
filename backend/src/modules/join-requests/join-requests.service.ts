import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import type { MembershipsRepository } from '../memberships/memberships.repository'
import type { OrganizationsRepository } from '../organizations/organizations.repository'
import type {
  JoinRequestRow,
  JoinRequestStatus,
  JoinRequestsRepository,
} from './join-requests.repository'

export interface JoinRequestsService {
  create(
    access: AccessContext,
    organizationId: string,
    message: string | undefined,
  ): Promise<JoinRequestRow>
  listMine(
    access: AccessContext,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<JoinRequestRow>>
  withdraw(access: AccessContext, organizationId: string, id: string): Promise<void>
  list(
    access: AccessContext,
    organizationId: string,
    status: JoinRequestStatus | undefined,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<JoinRequestRow>>
  get(access: AccessContext, organizationId: string, id: string): Promise<JoinRequestRow>
  approve(access: AccessContext, organizationId: string, id: string): Promise<void>
  reject(
    access: AccessContext,
    organizationId: string,
    id: string,
    reason: string,
    internalNotes: string | undefined,
  ): Promise<void>
}

export function createJoinRequestsService(
  repository: JoinRequestsRepository,
  organizationsRepository: OrganizationsRepository,
  membershipsRepository: MembershipsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  rateLimiter: RateLimiter,
  limits: PaginationLimits,
): JoinRequestsService {
  return {
    async create(access, organizationId, message) {
      const { actor } = requireVerifiedActor(access)
      await rateLimiter.enforce(RateLimitPolicies.JoinRequest, {
        organizationId,
        userId: actor.userId,
      })

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const settings = await organizationsRepository.getSettings(tx, organizationId)
          if (settings === null || settings.joinPolicy !== 'REQUEST_TO_JOIN') {
            throw forbidden(
              'This organization does not accept join requests.',
              ErrorCode.JOIN_POLICY_DISALLOWS,
            )
          }

          const existingMembership = await membershipsRepository.find(
            tx,
            organizationId,
            actor.userId,
          )
          if (existingMembership !== null && existingMembership.status === 'ACTIVE') {
            throw conflict(
              ErrorCode.ALREADY_A_MEMBER,
              'You are already a member of this organization.',
            )
          }

          const hasPending = await repository.hasPending(tx, organizationId, actor.userId)
          if (hasPending) {
            throw conflict(
              ErrorCode.JOIN_REQUEST_ALREADY_PENDING,
              'You already have a pending join request for this organization.',
            )
          }

          const created = await repository.create(tx, {
            id: newId(),
            organizationId,
            userId: actor.userId,
            message,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.JoinRequestSubmitted,
            resourceType: 'organization_join_request',
            resourceId: created.id,
            summary: 'Submitted a request to join the organization.',
          })

          return created
        },
        { actorUserId: actor.userId },
      )
    },

    async listMine(access, query) {
      const { actor } = requireVerifiedActor(access)
      const page = toPageRequest(query, limits)
      return transactions.withoutTenant((tx) => repository.listMine(tx, actor.userId, page))
    },

    async withdraw(access, organizationId, id) {
      const { actor } = requireVerifiedActor(access)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const request = await repository.findById(tx, organizationId, id)
          if (request === null || request.userId !== actor.userId) {
            throw notFound('Join request not found.')
          }

          const withdrawn = await repository.withdraw(tx, organizationId, id, actor.userId)
          if (!withdrawn) {
            throw conflict(ErrorCode.CONFLICT, 'This join request can no longer be withdrawn.')
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.JoinRequestWithdrawn,
            resourceType: 'organization_join_request',
            resourceId: id,
            summary: 'Withdrew a join request.',
          })
        },
        { actorUserId: actor.userId },
      )
    },

    async list(access, organizationId, status, query) {
      authorize(access, Permission.OrganizationReviewJoinRequests)
      const page = toPageRequest(query, limits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.list(tx, organizationId, status, page),
      )
    },

    async get(access, organizationId, id) {
      authorize(access, Permission.OrganizationReviewJoinRequests)
      const request = await transactions.withTenant(organizationId, (tx) =>
        repository.findById(tx, organizationId, id),
      )
      if (request === null) throw notFound('Join request not found.')
      return request
    },

    async approve(access, organizationId, id) {
      authorize(access, Permission.OrganizationReviewJoinRequests)
      const reviewerId = access.actor?.userId
      if (reviewerId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const request = await repository.findById(tx, organizationId, id)
          if (request === null) throw notFound('Join request not found.')

          const existing = await membershipsRepository.find(tx, organizationId, request.userId)
          if (existing !== null && existing.status === 'ACTIVE') {
            throw conflict(ErrorCode.ALREADY_A_MEMBER, 'This user is already an active member.')
          }

          const now = await transactions.databaseNow(tx)
          const approved = await repository.approve(tx, organizationId, id, reviewerId, now)
          if (!approved) {
            throw conflict(ErrorCode.CONFLICT, 'This join request has already been decided.')
          }

          if (existing !== null) {
            await membershipsRepository.reactivate(
              tx,
              organizationId,
              request.userId,
              'MEMBER',
              'JOIN_REQUEST',
            )
          } else {
            await membershipsRepository.create(tx, {
              id: newId(),
              organizationId,
              userId: request.userId,
              role: 'MEMBER',
              source: 'JOIN_REQUEST',
            })
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: reviewerId,
            action: AuditAction.JoinRequestApproved,
            resourceType: 'organization_join_request',
            resourceId: id,
            summary: `Approved a join request from ${request.userId}.`,
          })

          const organization = await organizationsRepository.findById(tx, organizationId)
          await outbox.write(tx, {
            eventType: 'organization_join_request.decided',
            queueName: QueueName.Email,
            aggregateType: 'organization_join_request',
            aggregateId: id,
            organizationId,
            dedupeKey: `organization-join-request-approved:${id}`,
            payload: {
              userId: request.userId,
              organizationName: organization?.name ?? 'the organization',
              approved: true,
            },
          })
        },
        { actorUserId: reviewerId },
      )
    },

    async reject(access, organizationId, id, reason, internalNotes) {
      authorize(access, Permission.OrganizationReviewJoinRequests)
      const reviewerId = access.actor?.userId
      if (reviewerId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const request = await repository.findById(tx, organizationId, id)
          if (request === null) throw notFound('Join request not found.')

          const now = await transactions.databaseNow(tx)
          const rejected = await repository.reject(
            tx,
            organizationId,
            id,
            reviewerId,
            reason,
            internalNotes,
            now,
          )
          if (!rejected) {
            throw conflict(ErrorCode.CONFLICT, 'This join request has already been decided.')
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: reviewerId,
            action: AuditAction.JoinRequestRejected,
            resourceType: 'organization_join_request',
            resourceId: id,
            summary: `Rejected a join request from ${request.userId}.`,
            reason,
          })

          const organization = await organizationsRepository.findById(tx, organizationId)
          await outbox.write(tx, {
            eventType: 'organization_join_request.decided',
            queueName: QueueName.Email,
            aggregateType: 'organization_join_request',
            aggregateId: id,
            organizationId,
            dedupeKey: `organization-join-request-rejected:${id}`,
            payload: {
              userId: request.userId,
              organizationName: organization?.name ?? 'the organization',
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
