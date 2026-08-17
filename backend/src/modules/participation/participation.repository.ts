import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type ParticipationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'DISQUALIFIED'

export interface ParticipationRow {
  id: string
  organizationId: string
  challengeId: string
  userId: string
  status: ParticipationStatus
  termsVersionId: string | null
  acceptedTermsAt: Date | null
  formResponseId: string | null
  appliedAt: Date
  decidedByUserId: string | null
  decidedAt: Date | null
  decisionReason: string | null
  internalNotes: string | null
  withdrawnAt: Date | null
  createdAt: Date
}

export interface RegisterInput {
  id: string
  organizationId: string
  challengeId: string
  userId: string
  status: ParticipationStatus
  termsVersionId?: string
  acceptedTermsAt?: Date
  formResponseId?: string
}

export interface ParticipationRepository {
  findByChallengeAndUser(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    userId: string,
  ): Promise<ParticipationRow | null>
  findById(
    client: PrismaTransactionClient,
    organizationId: string,
    participationId: string,
  ): Promise<ParticipationRow | null>
  create(client: PrismaTransactionClient, input: RegisterInput): Promise<ParticipationRow>
  reRegister(
    client: PrismaTransactionClient,
    organizationId: string,
    participationId: string,
    input: {
      status: ParticipationStatus
      termsVersionId?: string
      acceptedTermsAt?: Date
      formResponseId?: string
    },
  ): Promise<ParticipationRow>
  decide(
    client: PrismaTransactionClient,
    organizationId: string,
    participationId: string,
    input: {
      status: 'APPROVED' | 'REJECTED'
      decidedByUserId: string
      decisionReason?: string
      internalNotes?: string
    },
  ): Promise<ParticipationRow>
  withdraw(
    client: PrismaTransactionClient,
    organizationId: string,
    participationId: string,
  ): Promise<ParticipationRow>
  setStatus(
    client: PrismaTransactionClient,
    organizationId: string,
    participationId: string,
    status: 'DISQUALIFIED' | 'APPROVED',
    input: { decidedByUserId: string; decisionReason?: string },
  ): Promise<ParticipationRow>
  list(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    status: ParticipationStatus | undefined,
    page: PageRequest,
  ): Promise<Page<ParticipationRow>>
  countByStatus(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    status: ParticipationStatus,
  ): Promise<number>
  recordConsent(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      userId: string
      termsVersionId: string
      context: string
    },
  ): Promise<void>
}

export function createParticipationRepository(): ParticipationRepository {
  return {
    async findByChallengeAndUser(client, organizationId, challengeId, userId) {
      return client.challengeParticipation.findFirst({
        where: { organizationId, challengeId, userId },
      })
    },

    async findById(client, organizationId, participationId) {
      return client.challengeParticipation.findFirst({
        where: { id: participationId, organizationId },
      })
    },

    async create(client, input) {
      return client.challengeParticipation.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          userId: input.userId,
          status: input.status,
          termsVersionId: input.termsVersionId,
          acceptedTermsAt: input.acceptedTermsAt,
          formResponseId: input.formResponseId,
        },
      })
    },

    async reRegister(client, organizationId, participationId, input) {
      return client.challengeParticipation.update({
        where: { id: participationId, organizationId },
        data: {
          status: input.status,
          termsVersionId: input.termsVersionId,
          acceptedTermsAt: input.acceptedTermsAt,
          formResponseId: input.formResponseId,
          appliedAt: new Date(),
          decidedByUserId: null,
          decidedAt: null,
          decisionReason: null,
          withdrawnAt: null,
        },
      })
    },

    async decide(client, organizationId, participationId, input) {
      return client.challengeParticipation.update({
        where: { id: participationId, organizationId },
        data: {
          status: input.status,
          decidedByUserId: input.decidedByUserId,
          decidedAt: new Date(),
          decisionReason: input.decisionReason,
          internalNotes: input.internalNotes,
        },
      })
    },

    async withdraw(client, organizationId, participationId) {
      return client.challengeParticipation.update({
        where: { id: participationId, organizationId },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      })
    },

    async setStatus(client, organizationId, participationId, status, input) {
      return client.challengeParticipation.update({
        where: { id: participationId, organizationId },
        data: {
          status,
          decidedByUserId: input.decidedByUserId,
          decidedAt: new Date(),
          decisionReason: input.decisionReason,
        },
      })
    },

    async list(client, organizationId, challengeId, status, page) {
      const rows = await client.challengeParticipation.findMany({
        where: {
          organizationId,
          challengeId,
          ...(status ? { status } : {}),
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

    async countByStatus(client, organizationId, challengeId, status) {
      return client.challengeParticipation.count({ where: { organizationId, challengeId, status } })
    },

    async recordConsent(client, input) {
      await client.consentRecord.createMany({
        data: [
          {
            id: input.id,
            organizationId: input.organizationId,
            userId: input.userId,
            termsVersionId: input.termsVersionId,
            context: input.context,
          },
        ],
        skipDuplicates: true,
      })
    },
  }
}
