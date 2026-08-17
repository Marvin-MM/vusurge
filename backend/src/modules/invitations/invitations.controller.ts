import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import { badRequest } from '../../shared/errors'
import type { IdempotencyStore } from '../../shared/idempotency'
import type { OrgRole } from '../memberships/memberships.repository'
import type { InvitationRow } from './invitations.repository'
import type { InvitationsService } from './invitations.service'

function serialize(row: InvitationRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    resendCount: row.resendCount,
  }
}

export function createInvitationsController(
  service: InvitationsService,
  idempotency: IdempotencyStore,
) {
  return {
    async create(
      access: AccessContext,
      organizationId: string,
      email: string | undefined,
      role: OrgRole,
      idempotencyKey: string | undefined,
    ) {
      const { actor } = requireActor(access)
      if (idempotencyKey === undefined) {
        throw badRequest('An Idempotency-Key header is required for this operation.')
      }
      await service.prepareCreate(access, organizationId, role)
      const result = await idempotency.run(
        {
          actorUserId: actor.userId,
          operation: 'organization_invitation.create',
          key: idempotencyKey,
          requestBody: { organizationId, email, role },
          organizationId,
        },
        async (tx) => ({
          status: 201,
          body: serialize(await service.create(access, organizationId, email, role, tx)),
        }),
      )
      return { status: result.status, body: result.value }
    },

    async list(
      access: AccessContext,
      organizationId: string,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.list(access, organizationId, query)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async get(access: AccessContext, organizationId: string, id: string) {
      requireActor(access)
      return serialize(await service.get(access, organizationId, id))
    },

    async revoke(access: AccessContext, organizationId: string, id: string) {
      requireActor(access)
      await service.revoke(access, organizationId, id)
    },

    async resend(access: AccessContext, organizationId: string, id: string) {
      requireActor(access)
      await service.resend(access, organizationId, id)
    },

    async accept(access: AccessContext, token: string) {
      return service.accept(access, token)
    },

    async decline(access: AccessContext, token: string) {
      await service.decline(access, token)
    },
  }
}

export type InvitationsController = ReturnType<typeof createInvitationsController>
