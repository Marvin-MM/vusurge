import type { PrismaTransactionClient } from '../../shared/database'
import { badRequest } from '../../shared/errors'
import { buildPage, type Page, type PageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'

export type SubmissionStatus = 'DRAFT' | 'FINALIZED' | 'DISQUALIFIED'

export interface SubmissionRow {
  id: string
  organizationId: string
  challengeId: string
  teamId: string
  trackId: string | null
  status: SubmissionStatus
  draftVersionId: string | null
  finalVersionId: string | null
  finalizedAt: Date | null
  disqualifiedAt: Date | null
  disqualifiedByUserId: string | null
  disqualificationReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SupportingLink {
  label: string
  url: string
}

export interface SubmissionVersionRow {
  id: string
  organizationId: string
  submissionId: string
  challengeId: string
  versionNumber: number
  isFinal: boolean
  title: string | null
  tagline: string | null
  problemStatement: string | null
  solutionDescription: string | null
  impactBeneficiaries: string | null
  technologyTags: string[]
  repositoryUrl: string | null
  demoUrl: string | null
  pitchVideoUrl: string | null
  presentationUrl: string | null
  supportingLinks: SupportingLink[]
  publicationConsent: boolean
  termsVersionId: string | null
  createdByUserId: string
  createdAt: Date
}

export interface SubmissionScreenshotRow {
  id: string
  organizationId: string
  challengeId: string
  submissionVersionId: string
  slot: number
  mediaAssetId: string
  createdAt: Date
}

export type SubmissionVersionInput = Partial<
  Pick<
    SubmissionVersionRow,
    | 'title'
    | 'tagline'
    | 'problemStatement'
    | 'solutionDescription'
    | 'impactBeneficiaries'
    | 'technologyTags'
    | 'repositoryUrl'
    | 'demoUrl'
    | 'pitchVideoUrl'
    | 'presentationUrl'
    | 'supportingLinks'
    | 'publicationConsent'
    | 'termsVersionId'
  >
>

export interface SubmissionsRepository {
  createSubmission(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      teamId: string
      trackId?: string
    },
  ): Promise<SubmissionRow>
  findById(
    client: PrismaTransactionClient,
    organizationId: string,
    submissionId: string,
  ): Promise<SubmissionRow | null>
  /** Row lock so two concurrent finalize attempts on the same submission serialize. */
  lockSubmissionForUpdate(
    client: PrismaTransactionClient,
    organizationId: string,
    submissionId: string,
  ): Promise<SubmissionRow | null>
  findByChallengeAndTeam(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    teamId: string,
  ): Promise<SubmissionRow | null>
  listByChallenge(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    status: SubmissionStatus | undefined,
    page: PageRequest,
  ): Promise<Page<SubmissionRow>>
  setPointers(
    client: PrismaTransactionClient,
    organizationId: string,
    submissionId: string,
    patch: {
      draftVersionId?: string
      finalVersionId?: string
      status?: SubmissionStatus
      finalizedAt?: Date | null
    },
  ): Promise<void>
  setDisqualified(
    client: PrismaTransactionClient,
    organizationId: string,
    submissionId: string,
    input: { disqualifiedByUserId: string; reason: string },
  ): Promise<void>
  reinstate(
    client: PrismaTransactionClient,
    organizationId: string,
    submissionId: string,
  ): Promise<void>

  createVersion(
    client: PrismaTransactionClient,
    input: SubmissionVersionInput & {
      id: string
      organizationId: string
      challengeId: string
      submissionId: string
      isFinal: boolean
      createdByUserId: string
    },
  ): Promise<SubmissionVersionRow>
  findVersionById(
    client: PrismaTransactionClient,
    organizationId: string,
    versionId: string,
  ): Promise<SubmissionVersionRow | null>
  listVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    submissionId: string,
  ): Promise<SubmissionVersionRow[]>

  createScreenshot(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      submissionVersionId: string
      slot: number
      mediaAssetId: string
    },
  ): Promise<SubmissionScreenshotRow>
  listScreenshots(
    client: PrismaTransactionClient,
    organizationId: string,
    submissionVersionId: string,
  ): Promise<SubmissionScreenshotRow[]>
}

export function createSubmissionsRepository(): SubmissionsRepository {
  const versionInclude = {
    technologies: { orderBy: { createdAt: 'asc' as const } },
  }

  const mapVersion = (value: unknown): SubmissionVersionRow => {
    const row = value as Omit<SubmissionVersionRow, 'technologyTags'> & {
      technologies: { displayLabelSnapshot: string }[]
    }
    return {
      ...row,
      technologyTags: row.technologies.map((technology) => technology.displayLabelSnapshot),
    }
  }

  return {
    async createSubmission(client, input) {
      return client.submission.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          teamId: input.teamId,
          trackId: input.trackId,
        },
      }) as unknown as Promise<SubmissionRow>
    },

    async findById(client, organizationId, submissionId) {
      return client.submission.findFirst({
        where: { id: submissionId, organizationId },
      }) as unknown as Promise<SubmissionRow | null>
    },

    async lockSubmissionForUpdate(client, organizationId, submissionId) {
      const rows = await client.$queryRaw<
        {
          id: string
          organization_id: string
          challenge_id: string
          team_id: string
          track_id: string | null
          status: SubmissionStatus
          draft_version_id: string | null
          final_version_id: string | null
          disqualified_at: Date | null
          disqualified_by_user_id: string | null
          disqualification_reason: string | null
          finalized_at: Date | null
          created_at: Date
          updated_at: Date
        }[]
      >`
        select id, organization_id, challenge_id, team_id, track_id, status,
               draft_version_id, final_version_id, disqualified_at,
               disqualified_by_user_id, disqualification_reason, finalized_at, created_at, updated_at
        from submission
        where id = ${submissionId}::uuid and organization_id = ${organizationId}::uuid
        for update
      `
      const row = rows[0]
      if (row === undefined) return null
      return {
        id: row.id,
        organizationId: row.organization_id,
        challengeId: row.challenge_id,
        teamId: row.team_id,
        trackId: row.track_id,
        status: row.status,
        draftVersionId: row.draft_version_id,
        finalVersionId: row.final_version_id,
        disqualifiedAt: row.disqualified_at,
        disqualifiedByUserId: row.disqualified_by_user_id,
        disqualificationReason: row.disqualification_reason,
        finalizedAt: row.finalized_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    },

    async findByChallengeAndTeam(client, organizationId, challengeId, teamId) {
      return client.submission.findFirst({
        where: { organizationId, challengeId, teamId },
      }) as unknown as Promise<SubmissionRow | null>
    },

    async listByChallenge(client, organizationId, challengeId, status, page) {
      const rows = await client.submission.findMany({
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
      return buildPage(rows as unknown as SubmissionRow[], page, (row) => ({
        at: row.createdAt.toISOString(),
        id: row.id,
      }))
    },

    async setPointers(client, organizationId, submissionId, patch) {
      await client.submission.updateMany({
        where: { id: submissionId, organizationId },
        data: patch,
      })
    },

    async setDisqualified(client, organizationId, submissionId, input) {
      await client.submission.updateMany({
        where: { id: submissionId, organizationId },
        data: {
          status: 'DISQUALIFIED',
          disqualifiedAt: new Date(),
          disqualifiedByUserId: input.disqualifiedByUserId,
          disqualificationReason: input.reason,
        },
      })
    },

    async reinstate(client, organizationId, submissionId) {
      await client.submission.updateMany({
        where: { id: submissionId, organizationId },
        data: {
          status: 'FINALIZED',
          disqualifiedAt: null,
          disqualifiedByUserId: null,
          disqualificationReason: null,
        },
      })
    },

    async createVersion(client, input) {
      const latest = await client.submissionVersion.findFirst({
        where: { organizationId: input.organizationId, submissionId: input.submissionId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      })
      const requestedTags = [...new Set(input.technologyTags ?? [])]
      const catalogueTags =
        requestedTags.length === 0
          ? []
          : await client.technologyTag.findMany({
              where: { active: true, name: { in: requestedTags, mode: 'insensitive' } },
              select: { id: true, name: true },
            })
      const catalogueByName = new Map(
        catalogueTags.map((tag) => [tag.name.toLocaleLowerCase('en-US'), tag]),
      )
      const missingTag = requestedTags.find(
        (tag) => !catalogueByName.has(tag.toLocaleLowerCase('en-US')),
      )
      if (missingTag !== undefined) {
        throw badRequest(`Technology tag "${missingTag}" is not in the active catalogue.`)
      }

      await client.submissionVersion.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          submissionId: input.submissionId,
          challengeId: input.challengeId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          isFinal: input.isFinal,
          title: input.title,
          tagline: input.tagline,
          problemStatement: input.problemStatement,
          solutionDescription: input.solutionDescription,
          impactBeneficiaries: input.impactBeneficiaries,
          repositoryUrl: input.repositoryUrl,
          demoUrl: input.demoUrl,
          pitchVideoUrl: input.pitchVideoUrl,
          presentationUrl: input.presentationUrl,
          supportingLinks: (input.supportingLinks ?? []) as never,
          publicationConsent: input.publicationConsent ?? false,
          termsVersionId: input.termsVersionId,
          createdByUserId: input.createdByUserId,
        },
      })
      if (requestedTags.length > 0) {
        await client.submissionTechnology.createMany({
          data: requestedTags.map((label) => ({
            id: newId(),
            organizationId: input.organizationId,
            challengeId: input.challengeId,
            submissionVersionId: input.id,
            technologyTagId: (
              catalogueByName.get(label.toLocaleLowerCase('en-US')) as { id: string }
            ).id,
            displayLabelSnapshot: label,
          })),
        })
      }
      const created = await client.submissionVersion.findUniqueOrThrow({
        where: { id: input.id },
        include: versionInclude,
      })
      return mapVersion(created)
    },

    async findVersionById(client, organizationId, versionId) {
      return client.submissionVersion
        .findFirst({
          where: { id: versionId, organizationId },
          include: versionInclude,
        })
        .then((row) => (row === null ? null : mapVersion(row)))
    },

    async listVersions(client, organizationId, submissionId) {
      const rows = await client.submissionVersion.findMany({
        where: { organizationId, submissionId },
        orderBy: { versionNumber: 'desc' },
        include: versionInclude,
      })
      return rows.map(mapVersion)
    },

    async createScreenshot(client, input) {
      const row = await client.submissionAsset.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          submissionVersionId: input.submissionVersionId,
          kind: 'SCREENSHOT',
          slot: input.slot,
          mediaAssetId: input.mediaAssetId,
        },
      })
      return row as SubmissionScreenshotRow
    },

    async listScreenshots(client, organizationId, submissionVersionId) {
      const rows = await client.submissionAsset.findMany({
        where: { organizationId, submissionVersionId, kind: 'SCREENSHOT' },
        orderBy: { slot: 'asc' },
      })
      return rows as SubmissionScreenshotRow[]
    },
  }
}
