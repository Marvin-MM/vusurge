import type { PrismaTransactionClient } from '../../shared/database'

export interface JoinCodeRow {
  id: string
  organizationId: string
  label: string | null
  // The service and repository both only ever create MEMBER-role codes
  // (master prompt section 9.2: "role granted, normally MEMBER only"); the
  // type reflects what this API actually produces.
  role: 'MEMBER'
  expiresAt: Date
  maxUses: number | null
  useCount: number
  allowedEmailDomains: string[]
  revokedAt: Date | null
  createdByUserId: string
  createdAt: Date
}

export interface CreateJoinCodeInput {
  id: string
  organizationId: string
  codeHash: string
  label?: string
  expiresAt: Date
  maxUses?: number
  allowedEmailDomains: string[]
  createdByUserId: string
}

export interface JoinCodesRepository {
  create(client: PrismaTransactionClient, input: CreateJoinCodeInput): Promise<JoinCodeRow>
  findById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<JoinCodeRow | null>
  list(client: PrismaTransactionClient, organizationId: string): Promise<JoinCodeRow[]>
  revoke(client: PrismaTransactionClient, organizationId: string, id: string): Promise<boolean>
  findActiveByCodeHash(
    client: PrismaTransactionClient,
    codeHash: string,
  ): Promise<JoinCodeRow | null>
  /**
   * Atomically redeem: increments use_count only if the code is still valid
   * (not revoked, not expired, under its use limit). Returns the redeemed row
   * or null if the guard rejected it — race-safe under concurrent redemption
   * of the same code (master prompt sections 9.2, 32, 41.4).
   */
  redeem(client: PrismaTransactionClient, codeHash: string): Promise<JoinCodeRow | null>
}

/**
 * This table's `role` column is the full organization-role enum at the
 * database level, but nothing in this API ever writes anything but MEMBER
 * (master prompt section 9.2). Narrowing here, with a runtime check, keeps
 * that invariant visible to callers instead of exposing the wider DB type.
 */
function toJoinCodeRow(row: {
  id: string
  organizationId: string
  label: string | null
  role: string
  expiresAt: Date
  maxUses: number | null
  useCount: number
  allowedEmailDomains: string[]
  revokedAt: Date | null
  createdByUserId: string
  createdAt: Date
}): JoinCodeRow {
  if (row.role !== 'MEMBER') {
    throw new Error(
      `Invariant violated: organization_join_code.role was "${row.role}", not MEMBER.`,
    )
  }
  return { ...row, role: 'MEMBER' }
}

export function createJoinCodesRepository(): JoinCodesRepository {
  return {
    async create(client, input) {
      const row = await client.organizationJoinCode.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          codeHash: input.codeHash,
          label: input.label,
          role: 'MEMBER',
          expiresAt: input.expiresAt,
          maxUses: input.maxUses,
          allowedEmailDomains: input.allowedEmailDomains,
          createdByUserId: input.createdByUserId,
        },
      })
      return toJoinCodeRow(row)
    },

    async findById(client, organizationId, id) {
      const row = await client.organizationJoinCode.findFirst({ where: { id, organizationId } })
      return row === null ? null : toJoinCodeRow(row)
    },

    async list(client, organizationId) {
      const rows = await client.organizationJoinCode.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      })
      return rows.map(toJoinCodeRow)
    },

    async revoke(client, organizationId, id) {
      const result = await client.organizationJoinCode.updateMany({
        where: { id, organizationId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      return result.count > 0
    },

    async findActiveByCodeHash(client, codeHash) {
      const row = await client.organizationJoinCode.findFirst({
        where: { codeHash, revokedAt: null, expiresAt: { gt: new Date() } },
      })
      return row === null ? null : toJoinCodeRow(row)
    },

    async redeem(client, codeHash) {
      const rows = await client.$queryRaw<
        {
          id: string
          organization_id: string
          label: string | null
          role: 'MEMBER'
          expires_at: Date
          max_uses: number | null
          use_count: number
          allowed_email_domains: string[]
          revoked_at: Date | null
          created_by_user_id: string
          created_at: Date
        }[]
      >`
        update organization_join_code
        set use_count = use_count + 1, last_used_at = now(), updated_at = now()
        where code_hash = ${codeHash}
          and revoked_at is null
          and expires_at > now()
          and (max_uses is null or use_count < max_uses)
        returning id, organization_id, label, role, expires_at, max_uses, use_count,
                  allowed_email_domains, revoked_at, created_by_user_id, created_at
      `

      const row = rows[0]
      if (row === undefined) return null

      return {
        id: row.id,
        organizationId: row.organization_id,
        label: row.label,
        role: row.role,
        expiresAt: row.expires_at,
        maxUses: row.max_uses,
        useCount: row.use_count,
        allowedEmailDomains: row.allowed_email_domains,
        revokedAt: row.revoked_at,
        createdByUserId: row.created_by_user_id,
        createdAt: row.created_at,
      }
    },
  }
}
