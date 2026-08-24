import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type {
  ParticipationListRow,
  ParticipationRow,
  ParticipationStatus,
} from './participation.repository'
import type { ParticipationService, RegisterInput } from './participation.service'

function serializeSelf(row: ParticipationRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    status: row.status,
    termsVersionId: row.termsVersionId,
    acceptedTermsAt: row.acceptedTermsAt?.toISOString() ?? null,
    appliedAt: row.appliedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisionReason: row.decisionReason,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeOrganizer(row: ParticipationRow) {
  return {
    ...serializeSelf(row),
    userId: row.userId,
    decidedByUserId: row.decidedByUserId,
    internalNotes: row.internalNotes,
  }
}

function serializeOrganizerPage(page: Page<ParticipationListRow>) {
  return {
    items: page.items.map((row) => ({
      ...serializeOrganizer(row),
      displayName: row.displayName,
      email: row.email,
    })),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

export function createParticipationController(service: ParticipationService) {
  return {
    async register(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: RegisterInput,
    ) {
      requireActor(access)
      const row = await service.register(access, organizationId, challengeId, input)
      return serializeSelf(row)
    },

    async getApplicationForm(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      return service.getApplicationForm(access, organizationId, challengeId)
    },

    async saveApplication(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      responseData: Record<string, unknown>,
    ) {
      requireActor(access)
      const row = await service.saveApplication(access, organizationId, challengeId, responseData)
      return {
        id: row.id,
        formVersionId: row.formVersionId,
        responseData: row.responseData as Record<string, unknown>,
        updatedAt: row.updatedAt.toISOString(),
      }
    },

    async submitApplication(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      responseData: Record<string, unknown>,
      acceptTermsVersionId: string | undefined,
    ) {
      requireActor(access)
      const row = await service.submitApplication(
        access,
        organizationId,
        challengeId,
        responseData,
        acceptTermsVersionId,
      )
      return serializeSelf(row)
    },

    async getMine(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const row = await service.getMine(access, organizationId, challengeId)
      return row === null ? null : serializeSelf(row)
    },

    async withdraw(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const row = await service.withdraw(access, organizationId, challengeId)
      return serializeSelf(row)
    },

    async get(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      participationId: string,
    ) {
      requireActor(access)
      const row = await service.get(access, organizationId, challengeId, participationId)
      return serializeOrganizer(row)
    },

    async list(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      status: ParticipationStatus | undefined,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.list(access, organizationId, challengeId, status, query)
      return serializeOrganizerPage(page)
    },

    async approve(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      participationId: string,
      reason: string | undefined,
    ) {
      requireActor(access)
      const row = await service.approve(
        access,
        organizationId,
        challengeId,
        participationId,
        reason,
      )
      return serializeOrganizer(row)
    },

    async reject(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      participationId: string,
      reason: string,
      internalNotes: string | undefined,
    ) {
      requireActor(access)
      const row = await service.reject(
        access,
        organizationId,
        challengeId,
        participationId,
        reason,
        internalNotes,
      )
      return serializeOrganizer(row)
    },

    async disqualify(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      participationId: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.disqualify(
        access,
        organizationId,
        challengeId,
        participationId,
        reason,
      )
      return serializeOrganizer(row)
    },

    async reinstate(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      participationId: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.reinstate(
        access,
        organizationId,
        challengeId,
        participationId,
        reason,
      )
      return serializeOrganizer(row)
    },
  }
}

export type ParticipationController = ReturnType<typeof createParticipationController>
