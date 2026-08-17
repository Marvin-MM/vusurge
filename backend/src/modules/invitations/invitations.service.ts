import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import {
  authorize,
  canAssignRole,
  Permission,
  requireVerifiedActor,
} from '../../shared/authorization'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound, unprocessable } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import { generateSecureToken, hashToken } from '../../shared/security'
import { addDays } from '../../shared/time'
import type { MembershipsRepository, OrgRole } from '../memberships/memberships.repository'
import type { OrganizationsRepository } from '../organizations/organizations.repository'
import type { InvitationRow, InvitationsRepository } from './invitations.repository'

const INVITATION_VALIDITY_DAYS = 14

export interface InvitationsService {
  prepareCreate(access: AccessContext, organizationId: string, role: OrgRole): Promise<void>
  create(
    access: AccessContext,
    organizationId: string,
    email: string | undefined,
    role: OrgRole,
    transaction?: PrismaTransactionClient,
  ): Promise<InvitationRow>
  list(
    access: AccessContext,
    organizationId: string,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<InvitationRow>>
  get(access: AccessContext, organizationId: string, id: string): Promise<InvitationRow>
  revoke(access: AccessContext, organizationId: string, id: string): Promise<void>
  resend(access: AccessContext, organizationId: string, id: string): Promise<void>
  accept(
    access: AccessContext,
    token: string,
  ): Promise<{ organizationId: string; organizationSlug: string }>
  decline(access: AccessContext, token: string): Promise<void>
}

export function createInvitationsService(
  repository: InvitationsRepository,
  organizationsRepository: OrganizationsRepository,
  membershipsRepository: MembershipsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  rateLimiter: RateLimiter,
  limits: PaginationLimits,
): InvitationsService {
  function authorizeCreate(access: AccessContext, role: OrgRole): void {
    authorize(access, Permission.OrganizationManageInvitations, { requireVerifiedEmail: true })
    const actorRole = access.organization?.role
    if (actorRole === null || actorRole === undefined || !canAssignRole(actorRole, role)) {
      throw forbidden(
        'You cannot invite someone at a role above your own.',
        ErrorCode.INSUFFICIENT_ROLE,
      )
    }
  }

  return {
    async prepareCreate(access, organizationId, role) {
      authorizeCreate(access, role)
      await rateLimiter.enforce(RateLimitPolicies.InvitationCreation, {
        organizationId,
        userId: access.actor?.userId,
      })
    },

    async create(access, organizationId, email, role, transaction) {
      authorizeCreate(access, role)
      if (transaction === undefined) {
        await rateLimiter.enforce(RateLimitPolicies.InvitationCreation, {
          organizationId,
          userId: access.actor?.userId,
        })
      }

      const token = generateSecureToken()
      const tokenHash = hashToken(token)

      const execute = async (tx: PrismaTransactionClient) => {
        const now = await transactions.databaseNow(tx)
        const invitation = await repository.create(tx, {
          id: newId(),
          organizationId,
          tokenHash,
          email,
          role,
          expiresAt: addDays(now, INVITATION_VALIDITY_DAYS),
          createdByUserId: access.actor?.userId as string,
        })

        const organization = await organizationsRepository.findById(tx, organizationId)

        await audit.write(tx, {
          organizationId,
          actorType: 'USER',
          actorUserId: access.actor?.userId,
          action: AuditAction.InvitationCreated,
          resourceType: 'organization_invitation',
          resourceId: invitation.id,
          summary: `Created a ${role} invitation${email ? ` for ${email}` : ''}.`,
        })

        if (email !== undefined) {
          // The plaintext token is carried in the outbox payload only long
          // enough for the email worker to build the acceptance link; the
          // durable invitation row stores nothing but its hash (master
          // prompt section 9.1).
          await outbox.write(tx, {
            eventType: 'organization_invitation.created',
            queueName: QueueName.Email,
            aggregateType: 'organization_invitation',
            aggregateId: invitation.id,
            organizationId,
            dedupeKey: `organization-invitation-created:${invitation.id}`,
            payload: {
              email,
              token,
              role,
              organizationName: organization?.name ?? 'the organization',
            },
          })
        }

        return invitation
      }

      if (transaction !== undefined) return execute(transaction)
      return transactions.withTenant(organizationId, execute, {
        actorUserId: access.actor?.userId,
      })
    },

    async list(access, organizationId, query) {
      authorize(access, Permission.OrganizationManageInvitations)
      const page = toPageRequest(query, limits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.list(tx, organizationId, page),
      )
    },

    async get(access, organizationId, id) {
      authorize(access, Permission.OrganizationManageInvitations)
      const invitation = await transactions.withTenant(organizationId, (tx) =>
        repository.findById(tx, organizationId, id),
      )
      if (invitation === null) throw notFound('Invitation not found.')
      return invitation
    },

    async revoke(access, organizationId, id) {
      authorize(access, Permission.OrganizationManageInvitations)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const revoked = await repository.revoke(
            tx,
            organizationId,
            id,
            access.actor?.userId as string,
          )
          if (!revoked) {
            throw conflict(ErrorCode.INVITATION_INVALID, 'This invitation cannot be revoked.')
          }
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.InvitationRevoked,
            resourceType: 'organization_invitation',
            resourceId: id,
            summary: 'Revoked an organization invitation.',
          })
        },
        { actorUserId: access.actor?.userId },
      )
    },

    async resend(access, organizationId, id) {
      authorize(access, Permission.OrganizationManageInvitations)
      await rateLimiter.enforce(RateLimitPolicies.InvitationCreation, {
        organizationId,
        userId: access.actor?.userId,
      })

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const invitation = await repository.findById(tx, organizationId, id)
          if (invitation === null || invitation.status !== 'PENDING') {
            throw conflict(ErrorCode.INVITATION_INVALID, 'This invitation cannot be resent.')
          }
          if (invitation.email === null) {
            throw unprocessable(
              ErrorCode.INVITATION_INVALID,
              'This invitation has no bound email address to resend to.',
            )
          }

          // A fresh token is issued on resend: the original link stays dead,
          // which bounds how long a leaked invitation email remains useful.
          const token = generateSecureToken()
          await tx.organizationInvitation.update({
            where: { id },
            data: { tokenHash: hashToken(token) },
          })
          await repository.markResent(tx, organizationId, id)

          const organization = await organizationsRepository.findById(tx, organizationId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.InvitationResent,
            resourceType: 'organization_invitation',
            resourceId: id,
            summary: 'Resent an organization invitation.',
          })

          await outbox.write(tx, {
            eventType: 'organization_invitation.created',
            queueName: QueueName.Email,
            aggregateType: 'organization_invitation',
            aggregateId: id,
            organizationId,
            dedupeKey: `organization-invitation-resent:${id}:${invitation.resendCount + 1}`,
            payload: {
              email: invitation.email,
              token,
              role: invitation.role,
              organizationName: organization?.name ?? 'the organization',
            },
          })
        },
        { actorUserId: access.actor?.userId },
      )
    },

    async accept(access, token) {
      const { actor } = requireVerifiedActor(access)
      await rateLimiter.enforce(RateLimitPolicies.InvitationAcceptance, {
        userId: actor.userId,
        ipAddress: access.ipAddress,
      })

      const tokenHash = hashToken(token)

      // The organization is not known until the token resolves, so this
      // begins outside tenant context and switches into it once the
      // invitation's organization is known.
      const invitation = await transactions.withSecretLookup((tx) =>
        repository.findByTokenHash(tx, tokenHash),
      )
      if (invitation === null) {
        throw notFound('This invitation link is invalid.')
      }

      return transactions.withTenant(
        invitation.organizationId,
        async (tx) => {
          const now = await transactions.databaseNow(tx)

          if (
            invitation.status === 'EXPIRED' ||
            (invitation.status === 'PENDING' && invitation.expiresAt <= now)
          ) {
            throw conflict(ErrorCode.INVITATION_EXPIRED, 'This invitation has expired.')
          }
          if (invitation.status !== 'PENDING') {
            throw conflict(
              ErrorCode.INVITATION_ALREADY_USED,
              'This invitation has already been used.',
            )
          }
          if (invitation.expiresAt <= now) {
            throw conflict(ErrorCode.INVITATION_EXPIRED, 'This invitation has expired.')
          }

          const organization = await organizationsRepository.findById(tx, invitation.organizationId)
          if (organization === null || organization.status !== 'ACTIVE') {
            throw conflict(
              ErrorCode.ORGANIZATION_SUSPENDED,
              'This organization is not currently active.',
            )
          }

          if (
            invitation.email !== null &&
            invitation.email.toLowerCase() !== actor.email.toLowerCase()
          ) {
            throw forbidden(
              'This invitation was issued to a different email address.',
              ErrorCode.INVITATION_EMAIL_MISMATCH,
            )
          }

          const existingMembership = await membershipsRepository.find(
            tx,
            invitation.organizationId,
            actor.userId,
          )
          if (existingMembership !== null && existingMembership.status === 'ACTIVE') {
            throw conflict(
              ErrorCode.ALREADY_A_MEMBER,
              'You are already a member of this organization.',
            )
          }

          if (existingMembership !== null) {
            await membershipsRepository.reactivate(
              tx,
              invitation.organizationId,
              actor.userId,
              invitation.role,
              'INVITATION',
            )
          } else {
            await membershipsRepository.create(tx, {
              id: newId(),
              organizationId: invitation.organizationId,
              userId: actor.userId,
              role: invitation.role,
              source: 'INVITATION',
            })
          }

          await repository.markAccepted(tx, invitation.id, actor.userId, now)

          await audit.write(tx, {
            organizationId: invitation.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.InvitationAccepted,
            resourceType: 'organization_invitation',
            resourceId: invitation.id,
            summary: `Accepted an invitation and joined as ${invitation.role}.`,
          })

          return { organizationId: organization.id, organizationSlug: organization.slug }
        },
        { actorUserId: actor.userId },
      )
    },

    async decline(access, token) {
      const { actor } = requireVerifiedActor(access)
      const tokenHash = hashToken(token)

      const invitation = await transactions.withSecretLookup((tx) =>
        repository.findByTokenHash(tx, tokenHash),
      )
      if (invitation === null) {
        throw notFound('This invitation link is invalid.')
      }

      await transactions.withTenant(
        invitation.organizationId,
        async (tx) => {
          const result = await tx.organizationInvitation.updateMany({
            where: { id: invitation.id, status: 'PENDING' },
            data: { status: 'DECLINED' },
          })
          if (result.count === 0) {
            throw conflict(
              ErrorCode.INVITATION_ALREADY_USED,
              'This invitation is no longer pending.',
            )
          }

          await audit.write(tx, {
            organizationId: invitation.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.InvitationDeclined,
            resourceType: 'organization_invitation',
            resourceId: invitation.id,
            summary: 'Declined an organization invitation.',
          })
        },
        { actorUserId: actor.userId },
      )
    },
  }
}
