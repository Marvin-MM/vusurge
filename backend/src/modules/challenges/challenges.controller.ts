import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type {
  ChallengePrizeRow,
  ChallengeRow,
  ChallengeSponsorRow,
  ChallengeStatus,
  ChallengeTermsVersionRow,
  ChallengeTrackRow,
  PrizePatch,
  SponsorPatch,
  TrackPatch,
} from './challenges.repository'
import type {
  ChallengesService,
  CreateChallengeInput,
  PrizeInput,
  RescheduleInput,
  SponsorInput,
  TrackInput,
  UpdateChallengeInput,
} from './challenges.service'

function serialize(row: ChallengeRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    coverAssetId: row.coverAssetId,
    visibility: row.visibility,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    registrationOpenAt: row.registrationOpenAt?.toISOString() ?? null,
    registrationCloseAt: row.registrationCloseAt?.toISOString() ?? null,
    submissionOpenAt: row.submissionOpenAt?.toISOString() ?? null,
    submissionDeadline: row.submissionDeadline?.toISOString() ?? null,
    judgingStartAt: row.judgingStartAt?.toISOString() ?? null,
    judgingEndAt: row.judgingEndAt?.toISOString() ?? null,
    resultsPublishedAt: row.resultsPublishedAt?.toISOString() ?? null,
    displayTimeZone: row.displayTimeZone,
    minTeamSize: row.minTeamSize,
    maxTeamSize: row.maxTeamSize,
    soloParticipationAllowed: row.soloParticipationAllowed,
    screeningRequired: row.screeningRequired,
    participationPolicy: row.participationPolicy,
    submissionRequirements: row.submissionRequirements,
    publicProjectPublicationEnabled: row.publicProjectPublicationEnabled,
    blindJudgingEnabled: row.blindJudgingEnabled,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializePage(page: Page<ChallengeRow>) {
  return { items: page.items.map(serialize), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

function serializeTrack(row: ChallengeTrackRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    name: row.name,
    description: row.description,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializePrize(row: ChallengePrizeRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    title: row.title,
    description: row.description,
    valueLabel: row.valueLabel,
    trackId: row.trackId,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeSponsor(row: ChallengeSponsorRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    name: row.name,
    websiteUrl: row.websiteUrl,
    logoAssetId: row.logoAssetId,
    tier: row.tier,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeTermsVersion(row: ChallengeTermsVersionRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    version: row.version,
    content: row.content,
    isActive: row.isActive,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createChallengesController(service: ChallengesService) {
  return {
    async create(access: AccessContext, organizationId: string, input: CreateChallengeInput) {
      requireActor(access)
      const row = await service.create(access, organizationId, input)
      return serialize(row)
    },

    async get(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const row = await service.get(access, organizationId, challengeId)
      return serialize(row)
    },

    async list(
      access: AccessContext,
      organizationId: string,
      status: ChallengeStatus | undefined,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const result = await service.list(access, organizationId, status, query)
      return serializePage(result)
    },

    async update(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      patch: UpdateChallengeInput,
    ) {
      requireActor(access)
      const row = await service.update(access, organizationId, challengeId, patch)
      return serialize(row)
    },

    async publish(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const row = await service.publish(access, organizationId, challengeId)
      return serialize(row)
    },

    async reschedule(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: RescheduleInput,
    ) {
      requireActor(access)
      const row = await service.reschedule(access, organizationId, challengeId, input)
      return serialize(row)
    },

    async extendDeadline(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      newDeadline: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.extendDeadline(
        access,
        organizationId,
        challengeId,
        newDeadline,
        reason,
      )
      return serialize(row)
    },

    async reopen(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      newDeadline: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.reopen(access, organizationId, challengeId, newDeadline, reason)
      return serialize(row)
    },

    async cancel(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.cancel(access, organizationId, challengeId, reason)
      return serialize(row)
    },

    async archive(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.archive(access, organizationId, challengeId, reason)
      return serialize(row)
    },

    async createTrack(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: TrackInput,
    ) {
      requireActor(access)
      const row = await service.createTrack(access, organizationId, challengeId, input)
      return serializeTrack(row)
    },

    async listTracks(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.listTracks(access, organizationId, challengeId)
      return rows.map(serializeTrack)
    },

    async getTrack(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      trackId: string,
    ) {
      requireActor(access)
      const row = await service.getTrack(access, organizationId, challengeId, trackId)
      return serializeTrack(row)
    },

    async updateTrack(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      trackId: string,
      patch: TrackPatch,
    ) {
      requireActor(access)
      const row = await service.updateTrack(access, organizationId, challengeId, trackId, patch)
      return serializeTrack(row)
    },

    async archiveTrack(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      trackId: string,
    ) {
      requireActor(access)
      await service.archiveTrack(access, organizationId, challengeId, trackId)
    },

    async createPrize(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: PrizeInput,
    ) {
      requireActor(access)
      const row = await service.createPrize(access, organizationId, challengeId, input)
      return serializePrize(row)
    },

    async listPrizes(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.listPrizes(access, organizationId, challengeId)
      return rows.map(serializePrize)
    },

    async updatePrize(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      prizeId: string,
      patch: PrizePatch,
    ) {
      requireActor(access)
      const row = await service.updatePrize(access, organizationId, challengeId, prizeId, patch)
      return serializePrize(row)
    },

    async deletePrize(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      prizeId: string,
    ) {
      requireActor(access)
      await service.deletePrize(access, organizationId, challengeId, prizeId)
    },

    async createSponsor(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: SponsorInput,
    ) {
      requireActor(access)
      const row = await service.createSponsor(access, organizationId, challengeId, input)
      return serializeSponsor(row)
    },

    async listSponsors(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.listSponsors(access, organizationId, challengeId)
      return rows.map(serializeSponsor)
    },

    async updateSponsor(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      sponsorId: string,
      patch: SponsorPatch,
    ) {
      requireActor(access)
      const row = await service.updateSponsor(access, organizationId, challengeId, sponsorId, patch)
      return serializeSponsor(row)
    },

    async deleteSponsor(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      sponsorId: string,
    ) {
      requireActor(access)
      await service.deleteSponsor(access, organizationId, challengeId, sponsorId)
    },

    async createTermsVersion(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      content: string,
    ) {
      requireActor(access)
      const row = await service.createTermsVersion(access, organizationId, challengeId, content)
      return serializeTermsVersion(row)
    },

    async listTermsVersions(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.listTermsVersions(access, organizationId, challengeId)
      return rows.map(serializeTermsVersion)
    },

    async activateTermsVersion(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      termsVersionId: string,
    ) {
      requireActor(access)
      const row = await service.activateTermsVersion(
        access,
        organizationId,
        challengeId,
        termsVersionId,
      )
      return serializeTermsVersion(row)
    },

    async getTermsVersion(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      termsVersionId: string,
    ) {
      requireActor(access)
      const row = await service.getTermsVersion(access, organizationId, challengeId, termsVersionId)
      return serializeTermsVersion(row)
    },

    async getCurrentTerms(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const row = await service.getCurrentTerms(access, organizationId, challengeId)
      return row === null ? null : serializeTermsVersion(row)
    },

    async acceptTerms(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      termsVersionId: string,
    ) {
      requireActor(access)
      return service.acceptTerms(access, organizationId, challengeId, termsVersionId)
    },
  }
}

export type ChallengesController = ReturnType<typeof createChallengesController>
