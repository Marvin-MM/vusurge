import type { Page } from '../../shared/http'
import type {
  PublicAnnouncementRow,
  PublicChallengeRow,
  PublicChallengeTrackRow,
  PublicFaqRow,
  PublicInnovationRow,
  PublicOrganizationRow,
  PublicProjectRow,
  PublicSubmissionResultRow,
} from './public.repository'
import type { PublicService } from './public.service'

export function serialize(row: PublicOrganizationRow) {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

export function serializeChallenge(row: PublicChallengeRow) {
  return {
    id: row.id,
    organizationSlug: row.organizationSlug,
    organizationName: row.organizationName,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    coverAssetId: row.coverAssetId,
    status: row.status,
    publishedAt: row.publishedAt.toISOString(),
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
    participationPolicy: row.participationPolicy,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeChallengePage(page: Page<PublicChallengeRow>) {
  return {
    items: page.items.map(serializeChallenge),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export function serializeInnovation(row: PublicInnovationRow) {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

function serializeInnovationPage(page: Page<PublicInnovationRow>) {
  return {
    items: page.items.map(serializeInnovation),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export function serializeTrack(row: PublicChallengeTrackRow) {
  return { ...row, archivedAt: row.archivedAt?.toISOString() ?? null }
}

export function serializeAnnouncement(row: PublicAnnouncementRow) {
  return { ...row, publishedAt: row.publishedAt?.toISOString() ?? null }
}

export function serializeFaq(row: PublicFaqRow) {
  return row
}

export function serializeResult(row: PublicSubmissionResultRow) {
  return row
}

export function serializeProject(row: PublicProjectRow) {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

function serializeProjectPage(page: Page<PublicProjectRow>) {
  return {
    items: page.items.map(serializeProject),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export function createPublicController(service: PublicService) {
  return {
    async listOrganizations(
      query: { q?: string; limit?: number; cursor?: string },
      ipAddress: string | undefined,
    ) {
      const page = await service.listOrganizations(query, ipAddress)
      return {
        items: page.items.map(serialize),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }
    },

    async getOrganization(slug: string) {
      return serialize(await service.getOrganization(slug))
    },

    async listChallenges(
      query: { q?: string; limit?: number; cursor?: string },
      ipAddress: string | undefined,
    ) {
      return serializeChallengePage(await service.listChallenges(query, ipAddress))
    },

    async listChallengesForOrganization(
      orgSlug: string,
      query: { limit?: number; cursor?: string },
      ipAddress: string | undefined,
    ) {
      return serializeChallengePage(
        await service.listChallengesForOrganization(orgSlug, query, ipAddress),
      )
    },

    async getChallenge(orgSlug: string, challengeSlug: string) {
      return serializeChallenge(await service.getChallenge(orgSlug, challengeSlug))
    },

    async listInnovationsForOrganization(
      orgSlug: string,
      query: { limit?: number; cursor?: string },
      ipAddress: string | undefined,
    ) {
      return serializeInnovationPage(
        await service.listInnovationsForOrganization(orgSlug, query, ipAddress),
      )
    },

    async listTracks(orgSlug: string, challengeSlug: string) {
      return (await service.listTracks(orgSlug, challengeSlug)).map(serializeTrack)
    },

    async listAnnouncements(orgSlug: string, challengeSlug: string) {
      return (await service.listAnnouncements(orgSlug, challengeSlug)).map(serializeAnnouncement)
    },

    async listFaqs(orgSlug: string, challengeSlug: string) {
      return (await service.listFaqs(orgSlug, challengeSlug)).map(serializeFaq)
    },

    async listResults(orgSlug: string, challengeSlug: string) {
      return (await service.listResults(orgSlug, challengeSlug)).map(serializeResult)
    },

    async listProjectsForOrganization(
      orgSlug: string,
      query: { limit?: number; cursor?: string },
      ipAddress: string | undefined,
    ) {
      return serializeProjectPage(
        await service.listProjectsForOrganization(orgSlug, query, ipAddress),
      )
    },
  }
}

export type PublicController = ReturnType<typeof createPublicController>
