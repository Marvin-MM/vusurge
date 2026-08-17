import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { JoinCodeRow } from './join-codes.repository'
import type { CreateJoinCodeInput, JoinCodesService } from './join-codes.service'

function serialize(row: JoinCodeRow) {
  return {
    id: row.id,
    label: row.label,
    role: row.role,
    expiresAt: row.expiresAt.toISOString(),
    maxUses: row.maxUses,
    useCount: row.useCount,
    allowedEmailDomains: row.allowedEmailDomains,
    revoked: row.revokedAt !== null,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createJoinCodesController(service: JoinCodesService) {
  return {
    async create(access: AccessContext, organizationId: string, input: CreateJoinCodeInput) {
      requireActor(access)
      const { code, plaintextCode } = await service.create(access, organizationId, input)
      return { ...serialize(code), plaintextCode }
    },

    async list(access: AccessContext, organizationId: string) {
      requireActor(access)
      const rows = await service.list(access, organizationId)
      return rows.map(serialize)
    },

    async revoke(access: AccessContext, organizationId: string, id: string) {
      requireActor(access)
      await service.revoke(access, organizationId, id)
    },

    async redeem(access: AccessContext, code: string) {
      return service.redeem(access, code)
    },
  }
}

export type JoinCodesController = ReturnType<typeof createJoinCodesController>
