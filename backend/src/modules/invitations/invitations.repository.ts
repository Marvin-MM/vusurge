import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'
import type { OrgRole } from '../memberships/memberships.repository'

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'

export interface InvitationRow {
  id: string
  organizationId: string
  email: string | null
  role: OrgRole
  status: InvitationStatus
  expiresAt: Date
  createdByUserId: string
  acceptedByUserId: string | null
  acceptedAt: Date | null
  revokedAt: Date | null
  resendCount: number
  createdAt: Date
}

export interface CreateInvitationInput {
  id: string
  organizationId: string
  tokenHash: string
  email?: string
  role: OrgRole
  expiresAt: Date
  createdByUserId: string
}

export interface InvitationsRepository {
  create(client: PrismaTransactionClient, input: CreateInvitationInput): Promise<InvitationRow>
  findById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<InvitationRow | null>
  /** Not tenant-scoped: acceptance is reached via the token alone. */
  findByTokenHash(client: PrismaTransactionClient, tokenHash: string): Promise<InvitationRow | null>
  list(
    client: PrismaTransactionClient,
    organizationId: string,
    page: PageRequest,
  ): Promise<Page<InvitationRow>>
  revoke(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    revokedByUserId: string,
  ): Promise<boolean>
  markResent(client: PrismaTransactionClient, organizationId: string, id: string): Promise<void>
  markAccepted(
    client: PrismaTransactionClient,
    id: string,
    acceptedByUserId: string,
    now: Date,
  ): Promise<void>
}

export function createInvitationsRepository(): InvitationsRepository {
  return {
    async create(client, input) {
      return client.organizationInvitation.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          tokenHash: input.tokenHash,
          email: input.email,
          role: input.role,
          status: 'PENDING',
          expiresAt: input.expiresAt,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findById(client, organizationId, id) {
      return client.organizationInvitation.findFirst({ where: { id, organizationId } })
    },

    async findByTokenHash(client, tokenHash) {
      return client.organizationInvitation.findUnique({ where: { tokenHash } })
    },

    async list(client, organizationId, page) {
      const rows = await client.organizationInvitation.findMany({
        where: {
          organizationId,
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async revoke(client, organizationId, id, revokedByUserId) {
      const result = await client.organizationInvitation.updateMany({
        where: { id, organizationId, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date(), revokedByUserId },
      })
      return result.count > 0
    },

    async markResent(client, organizationId, id) {
      await client.organizationInvitation.updateMany({
        where: { id, organizationId },
        data: { resendCount: { increment: 1 }, lastSentAt: new Date() },
      })
    },

    async markAccepted(client, id, acceptedByUserId, now) {
      await client.organizationInvitation.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedByUserId, acceptedAt: now },
      })
    },
  }
}
