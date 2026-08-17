import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type ChallengeVisibility = 'ORG_MEMBERS' | 'PUBLIC' | 'UNLISTED'
export type ParticipationPolicy =
  | 'ORG_MEMBERS_ONLY'
  | 'APPROVED_CHALLENGE_PARTICIPANTS'
  | 'OPEN_AUTHENTICATED'
export type ChallengeStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'OPEN'
  | 'CLOSED'
  | 'JUDGING'
  | 'RESULTS_READY'
  | 'RESULTS_PUBLISHED'
  | 'ARCHIVED'
  | 'CANCELLED'

export interface ChallengeRow {
  id: string
  organizationId: string
  title: string
  slug: string
  summary: string | null
  description: string | null
  coverAssetId: string | null
  visibility: ChallengeVisibility
  status: ChallengeStatus
  publishedAt: Date | null
  registrationOpenAt: Date | null
  registrationCloseAt: Date | null
  submissionOpenAt: Date | null
  submissionDeadline: Date | null
  judgingStartAt: Date | null
  judgingEndAt: Date | null
  resultsPublishedAt: Date | null
  judgingFinalizedAt: Date | null
  resultsFinalizedAt: Date | null
  resultsRetractedAt: Date | null
  feedbackReleasedAt: Date | null
  displayTimeZone: string
  minTeamSize: number
  maxTeamSize: number
  soloParticipationAllowed: boolean
  screeningRequired: boolean
  participationPolicy: ParticipationPolicy
  submissionRequirements: string | null
  publicProjectPublicationEnabled: boolean
  blindJudgingEnabled: boolean
  createdByUserId: string
  version: number
  createdAt: Date
}

export interface SubmissionRequirementVersionRow {
  id: string
  organizationId: string
  challengeId: string
  version: number
  guidance: string | null
  requireTitle: boolean
  requireTagline: boolean
  requireProblemStatement: boolean
  requireSolutionDescription: boolean
  requireImpactBeneficiaries: boolean
  requireTechnologyTags: boolean
  requireRepositoryUrl: boolean
  requireDemoUrl: boolean
  requirePitchVideoUrl: boolean
  requirePresentationAsset: boolean
  requireSupportingLinks: boolean
  requirePublicationConsent: boolean
  minScreenshots: number
  maxScreenshots: number
  isActive: boolean
  lockedAt: Date | null
  createdByUserId: string
  createdAt: Date
}

export interface CreateChallengeInput {
  id: string
  organizationId: string
  title: string
  slug: string
  summary?: string
  description?: string
  visibility?: ChallengeVisibility
  displayTimeZone?: string
  minTeamSize?: number
  maxTeamSize?: number
  soloParticipationAllowed?: boolean
  screeningRequired?: boolean
  participationPolicy?: ParticipationPolicy
  submissionRequirements?: string
  publicProjectPublicationEnabled?: boolean
  blindJudgingEnabled?: boolean
  createdByUserId: string
}

export type ChallengeProfilePatch = Partial<
  Pick<
    ChallengeRow,
    | 'title'
    | 'summary'
    | 'description'
    | 'coverAssetId'
    | 'visibility'
    | 'displayTimeZone'
    | 'minTeamSize'
    | 'maxTeamSize'
    | 'soloParticipationAllowed'
    | 'screeningRequired'
    | 'participationPolicy'
    | 'submissionRequirements'
    | 'publicProjectPublicationEnabled'
    | 'blindJudgingEnabled'
  >
>

export interface ScheduleFields {
  registrationOpenAt?: Date | null
  registrationCloseAt?: Date | null
  submissionOpenAt?: Date | null
  submissionDeadline?: Date | null
  judgingStartAt?: Date | null
  judgingEndAt?: Date | null
}

export interface ScheduleChangeRow {
  field: string
  previousValue: Date | null
  newValue: Date | null
}

export interface ChallengeTrackRow {
  id: string
  organizationId: string
  challengeId: string
  name: string
  description: string | null
  archivedAt: Date | null
  displayOrder: number
  createdAt: Date
}

export interface ChallengePrizeRow {
  id: string
  organizationId: string
  challengeId: string
  title: string
  description: string | null
  valueLabel: string | null
  trackId: string | null
  displayOrder: number
  createdAt: Date
}

export interface ChallengeSponsorRow {
  id: string
  organizationId: string
  challengeId: string
  name: string
  websiteUrl: string | null
  logoAssetId: string | null
  tier: string | null
  displayOrder: number
  createdAt: Date
}

export interface ChallengeTermsVersionRow {
  id: string
  organizationId: string
  challengeId: string
  version: number
  content: string
  isActive: boolean
  createdByUserId: string
  activatedAt: Date | null
  createdAt: Date
}

export interface CreateTrackInput {
  id: string
  organizationId: string
  challengeId: string
  name: string
  description?: string
  displayOrder?: number
}

export type TrackPatch = Partial<Pick<ChallengeTrackRow, 'name' | 'description' | 'displayOrder'>>

export interface CreatePrizeInput {
  id: string
  organizationId: string
  challengeId: string
  title: string
  description?: string
  valueLabel?: string
  trackId?: string
  displayOrder?: number
}

export type PrizePatch = Partial<
  Pick<ChallengePrizeRow, 'title' | 'description' | 'valueLabel' | 'trackId' | 'displayOrder'>
>

export interface CreateSponsorInput {
  id: string
  organizationId: string
  challengeId: string
  name: string
  websiteUrl?: string
  tier?: string
  displayOrder?: number
}

export type SponsorPatch = Partial<
  Pick<ChallengeSponsorRow, 'name' | 'websiteUrl' | 'logoAssetId' | 'tier' | 'displayOrder'>
>

export interface ChallengesRepository {
  create(client: PrismaTransactionClient, input: CreateChallengeInput): Promise<ChallengeRow>
  findById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<ChallengeRow | null>
  isSlugTaken(
    client: PrismaTransactionClient,
    organizationId: string,
    slug: string,
  ): Promise<boolean>
  list(
    client: PrismaTransactionClient,
    organizationId: string,
    status: ChallengeStatus | undefined,
    page: PageRequest,
  ): Promise<Page<ChallengeRow>>
  updateProfile(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    patch: ChallengeProfilePatch,
    expectedVersion: number,
  ): Promise<boolean>
  updateSchedule(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    patch: ScheduleFields,
    expectedVersion: number,
  ): Promise<boolean>
  setStatus(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    status: ChallengeStatus,
    fields: { publishedAt?: Date },
    expectedVersion: number,
  ): Promise<boolean>
  recordScheduleChange(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      field: string
      previousValue: Date | null
      newValue: Date | null
      reason: string
      actorUserId: string
      requestId?: string
    },
  ): Promise<void>
  hasAnyParticipation(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<boolean>
  createSubmissionRequirementVersion(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      guidance?: string
      createdByUserId: string
    },
  ): Promise<SubmissionRequirementVersionRow>
  findActiveSubmissionRequirementVersion(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<SubmissionRequirementVersionRow | null>
  deactivateSubmissionRequirementVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<void>
  lockActiveSubmissionRequirementVersion(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    lockedAt: Date,
  ): Promise<void>

  createTrack(client: PrismaTransactionClient, input: CreateTrackInput): Promise<ChallengeTrackRow>
  listTracks(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeTrackRow[]>
  findTrackById(
    client: PrismaTransactionClient,
    organizationId: string,
    trackId: string,
  ): Promise<ChallengeTrackRow | null>
  updateTrack(
    client: PrismaTransactionClient,
    organizationId: string,
    trackId: string,
    patch: TrackPatch,
  ): Promise<void>
  archiveTrack(
    client: PrismaTransactionClient,
    organizationId: string,
    trackId: string,
  ): Promise<void>

  createPrize(client: PrismaTransactionClient, input: CreatePrizeInput): Promise<ChallengePrizeRow>
  listPrizes(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengePrizeRow[]>
  findPrizeById(
    client: PrismaTransactionClient,
    organizationId: string,
    prizeId: string,
  ): Promise<ChallengePrizeRow | null>
  updatePrize(
    client: PrismaTransactionClient,
    organizationId: string,
    prizeId: string,
    patch: PrizePatch,
  ): Promise<void>
  deletePrize(
    client: PrismaTransactionClient,
    organizationId: string,
    prizeId: string,
  ): Promise<void>

  createSponsor(
    client: PrismaTransactionClient,
    input: CreateSponsorInput,
  ): Promise<ChallengeSponsorRow>
  listSponsors(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeSponsorRow[]>
  findSponsorById(
    client: PrismaTransactionClient,
    organizationId: string,
    sponsorId: string,
  ): Promise<ChallengeSponsorRow | null>
  updateSponsor(
    client: PrismaTransactionClient,
    organizationId: string,
    sponsorId: string,
    patch: SponsorPatch,
  ): Promise<void>
  deleteSponsor(
    client: PrismaTransactionClient,
    organizationId: string,
    sponsorId: string,
  ): Promise<void>

  createTermsVersion(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      content: string
      createdByUserId: string
    },
  ): Promise<ChallengeTermsVersionRow>
  listTermsVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeTermsVersionRow[]>
  findTermsVersionById(
    client: PrismaTransactionClient,
    organizationId: string,
    termsVersionId: string,
  ): Promise<ChallengeTermsVersionRow | null>
  findActiveTermsVersion(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeTermsVersionRow | null>
  deactivateAllTermsVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<void>
  activateTermsVersion(
    client: PrismaTransactionClient,
    organizationId: string,
    termsVersionId: string,
  ): Promise<void>
  findConsent(
    client: PrismaTransactionClient,
    userId: string,
    termsVersionId: string,
  ): Promise<{ acceptedAt: Date } | null>
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

export function createChallengesRepository(): ChallengesRepository {
  return {
    async create(client, input) {
      return client.challenge.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          title: input.title,
          slug: input.slug,
          summary: input.summary,
          description: input.description,
          visibility: input.visibility ?? 'ORG_MEMBERS',
          displayTimeZone: input.displayTimeZone ?? 'UTC',
          minTeamSize: input.minTeamSize ?? 1,
          maxTeamSize: input.maxTeamSize ?? 1,
          soloParticipationAllowed: input.soloParticipationAllowed ?? true,
          screeningRequired: input.screeningRequired ?? false,
          participationPolicy: input.participationPolicy ?? 'ORG_MEMBERS_ONLY',
          submissionRequirements: input.submissionRequirements,
          publicProjectPublicationEnabled: input.publicProjectPublicationEnabled ?? false,
          blindJudgingEnabled: input.blindJudgingEnabled ?? false,
          createdByUserId: input.createdByUserId,
          status: 'DRAFT',
        },
      })
    },

    async findById(client, organizationId, id) {
      return client.challenge.findFirst({ where: { id, organizationId } })
    },

    async isSlugTaken(client, organizationId, slug) {
      const existing = await client.challenge.findFirst({
        where: { organizationId, slug: { equals: slug, mode: 'insensitive' } },
        select: { id: true },
      })
      return existing !== null
    },

    async list(client, organizationId, status, page) {
      const rows = await client.challenge.findMany({
        where: {
          organizationId,
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

    async updateProfile(client, organizationId, id, patch, expectedVersion) {
      const result = await client.challenge.updateMany({
        where: { id, organizationId, version: expectedVersion },
        data: { ...patch, version: { increment: 1 } },
      })
      return result.count > 0
    },

    async updateSchedule(client, organizationId, id, patch, expectedVersion) {
      const result = await client.challenge.updateMany({
        where: { id, organizationId, version: expectedVersion },
        data: { ...patch, version: { increment: 1 } },
      })
      return result.count > 0
    },

    async setStatus(client, organizationId, id, status, fields, expectedVersion) {
      const result = await client.challenge.updateMany({
        where: { id, organizationId, version: expectedVersion },
        data: { status, ...fields, version: { increment: 1 } },
      })
      return result.count > 0
    },

    async recordScheduleChange(client, input) {
      await client.challengeScheduleChange.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          field: input.field,
          previousValue: input.previousValue,
          newValue: input.newValue,
          reason: input.reason,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
        },
      })
    },

    async hasAnyParticipation(client, organizationId, challengeId) {
      const existing = await client.challengeParticipation.findFirst({
        where: { organizationId, challengeId },
        select: { id: true },
      })
      return existing !== null
    },

    async createSubmissionRequirementVersion(client, input) {
      const latest = await client.challengeSubmissionRequirementVersion.findFirst({
        where: { organizationId: input.organizationId, challengeId: input.challengeId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      return client.challengeSubmissionRequirementVersion.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          version: (latest?.version ?? 0) + 1,
          guidance: input.guidance,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findActiveSubmissionRequirementVersion(client, organizationId, challengeId) {
      return client.challengeSubmissionRequirementVersion.findFirst({
        where: { organizationId, challengeId, isActive: true },
      })
    },

    async deactivateSubmissionRequirementVersions(client, organizationId, challengeId) {
      await client.challengeSubmissionRequirementVersion.updateMany({
        where: { organizationId, challengeId, isActive: true },
        data: { isActive: false },
      })
    },

    async lockActiveSubmissionRequirementVersion(client, organizationId, challengeId, lockedAt) {
      await client.challengeSubmissionRequirementVersion.updateMany({
        where: { organizationId, challengeId, isActive: true, lockedAt: null },
        data: { lockedAt },
      })
    },

    async createTrack(client, input) {
      return client.challengeTrack.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          name: input.name,
          description: input.description,
          displayOrder: input.displayOrder ?? 0,
        },
      })
    },

    async listTracks(client, organizationId, challengeId) {
      return client.challengeTrack.findMany({
        where: { organizationId, challengeId },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    },

    async findTrackById(client, organizationId, trackId) {
      return client.challengeTrack.findFirst({ where: { id: trackId, organizationId } })
    },

    async updateTrack(client, organizationId, trackId, patch) {
      await client.challengeTrack.updateMany({
        where: { id: trackId, organizationId },
        data: patch,
      })
    },

    async archiveTrack(client, organizationId, trackId) {
      await client.challengeTrack.updateMany({
        where: { id: trackId, organizationId },
        data: { archivedAt: new Date() },
      })
    },

    async createPrize(client, input) {
      return client.challengePrize.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          title: input.title,
          description: input.description,
          valueLabel: input.valueLabel,
          trackId: input.trackId,
          displayOrder: input.displayOrder ?? 0,
        },
      })
    },

    async listPrizes(client, organizationId, challengeId) {
      return client.challengePrize.findMany({
        where: { organizationId, challengeId },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    },

    async findPrizeById(client, organizationId, prizeId) {
      return client.challengePrize.findFirst({ where: { id: prizeId, organizationId } })
    },

    async updatePrize(client, organizationId, prizeId, patch) {
      await client.challengePrize.updateMany({
        where: { id: prizeId, organizationId },
        data: patch,
      })
    },

    async deletePrize(client, organizationId, prizeId) {
      await client.challengePrize.deleteMany({ where: { id: prizeId, organizationId } })
    },

    async createSponsor(client, input) {
      return client.challengeSponsor.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          name: input.name,
          websiteUrl: input.websiteUrl,
          tier: input.tier,
          displayOrder: input.displayOrder ?? 0,
        },
      })
    },

    async listSponsors(client, organizationId, challengeId) {
      return client.challengeSponsor.findMany({
        where: { organizationId, challengeId },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    },

    async findSponsorById(client, organizationId, sponsorId) {
      return client.challengeSponsor.findFirst({ where: { id: sponsorId, organizationId } })
    },

    async updateSponsor(client, organizationId, sponsorId, patch) {
      await client.challengeSponsor.updateMany({
        where: { id: sponsorId, organizationId },
        data: patch,
      })
    },

    async deleteSponsor(client, organizationId, sponsorId) {
      await client.challengeSponsor.deleteMany({ where: { id: sponsorId, organizationId } })
    },

    async createTermsVersion(client, input) {
      const latest = await client.challengeTermsVersion.findFirst({
        where: { organizationId: input.organizationId, challengeId: input.challengeId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      return client.challengeTermsVersion.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          version: (latest?.version ?? 0) + 1,
          content: input.content,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async listTermsVersions(client, organizationId, challengeId) {
      return client.challengeTermsVersion.findMany({
        where: { organizationId, challengeId },
        orderBy: { version: 'desc' },
      })
    },

    async findTermsVersionById(client, organizationId, termsVersionId) {
      return client.challengeTermsVersion.findFirst({
        where: { id: termsVersionId, organizationId },
      })
    },

    async findActiveTermsVersion(client, organizationId, challengeId) {
      return client.challengeTermsVersion.findFirst({
        where: { organizationId, challengeId, isActive: true },
      })
    },

    async deactivateAllTermsVersions(client, organizationId, challengeId) {
      await client.challengeTermsVersion.updateMany({
        where: { organizationId, challengeId, isActive: true },
        data: { isActive: false },
      })
    },

    async activateTermsVersion(client, organizationId, termsVersionId) {
      await client.challengeTermsVersion.updateMany({
        where: { id: termsVersionId, organizationId },
        data: { isActive: true, activatedAt: new Date() },
      })
    },

    async findConsent(client, userId, termsVersionId) {
      return client.consentRecord.findUnique({
        where: { userId_termsVersionId: { userId, termsVersionId } },
        select: { acceptedAt: true },
      })
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
