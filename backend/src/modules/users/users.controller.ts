import type { AccessContext } from '../../shared/authorization'
import { requireActor, requireFreshActor } from '../../shared/authorization'
import { badRequest } from '../../shared/errors'
import type { IdempotencyStore } from '../../shared/idempotency'
import { isUuid } from '../../shared/ids'
import { createCsrfToken } from '../../shared/security'
import type { ProfilePatch } from './users.repository'
import type { UsersService } from './users.service'

/**
 * Converts validated HTTP context into service calls. No business rules, no
 * Prisma access — only actor extraction and error-shape translation.
 */
export function createUsersController(
  service: UsersService,
  authSecret: string,
  idempotency: IdempotencyStore,
) {
  return {
    async me(access: AccessContext) {
      const { actor } = requireActor(access)
      return service.getMe(actor.userId)
    },

    csrfToken(access: AccessContext) {
      const { actor } = requireActor(access)
      return {
        csrfToken: createCsrfToken(authSecret, actor.sessionId, actor.mfaVerifiedAt),
      }
    },

    async updateProfile(access: AccessContext, body: ProfilePatch) {
      const { actor } = requireActor(access)
      return service.updateProfile(actor.userId, body)
    },

    async updateSkills(access: AccessContext, body: { skillIds: string[]; customNames: string[] }) {
      const { actor } = requireActor(access)
      return service.updateSkills(actor.userId, body.skillIds, body.customNames)
    },

    async myOrganizations(access: AccessContext) {
      const { actor } = requireActor(access)
      const memberships = await service.listMyOrganizations(actor.userId)
      return memberships.map((membership) => ({
        ...membership,
        joinedAt: membership.joinedAt.toISOString(),
      }))
    },

    async myChallengeParticipations(access: AccessContext) {
      const { actor } = requireActor(access)
      const rows = await service.listMyChallengeParticipations(actor.userId)
      return rows.map((row) => ({ ...row, appliedAt: row.appliedAt.toISOString() }))
    },

    async myTeamInvitations(access: AccessContext) {
      const { actor } = requireActor(access)
      const rows = await service.listMyTeamInvitations(actor.userId)
      return rows.map((row) => ({
        ...row,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      }))
    },

    async myChallengeStaffInvitations(access: AccessContext) {
      const { actor } = requireActor(access)
      const rows = await service.listMyChallengeStaffInvitations(actor.email)
      return rows.map((row) => ({
        ...row,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      }))
    },

    async publicProfile(access: AccessContext, userId: string) {
      if (!isUuid(userId)) throw badRequest('Invalid user identifier.')
      return service.getPublicProfile(userId, access.actor?.userId ?? null)
    },

    async getPendingAccountDeletion(access: AccessContext) {
      const { actor } = requireActor(access)
      const request = await service.getPendingAccountDeletion(actor.userId)
      return request === null
        ? null
        : {
            ...request,
            requestedAt: request.requestedAt.toISOString(),
            eligibleAt: request.eligibleAt.toISOString(),
          }
    },

    async requestAccountDeletion(
      access: AccessContext,
      reason: string | undefined,
      idempotencyKey: string | undefined,
    ) {
      const { actor } = requireFreshActor(access)
      if (idempotencyKey === undefined) {
        throw badRequest('An Idempotency-Key header is required for this operation.')
      }
      const result = await idempotency.run(
        {
          actorUserId: actor.userId,
          operation: 'account_deletion.request',
          key: idempotencyKey,
          requestBody: { reason: reason ?? null },
        },
        async (tx) => {
          const row = await service.requestAccountDeletion(actor.userId, reason, tx)
          return {
            status: 200,
            body: {
              id: row.id,
              status: row.status,
              requestedAt: row.requestedAt.toISOString(),
              eligibleAt: row.eligibleAt.toISOString(),
            },
          }
        },
      )
      return { status: result.status, body: result.value }
    },

    async cancelAccountDeletion(access: AccessContext) {
      const { actor } = requireFreshActor(access)
      await service.cancelAccountDeletion(actor.userId)
    },
  }
}

export type UsersController = ReturnType<typeof createUsersController>
