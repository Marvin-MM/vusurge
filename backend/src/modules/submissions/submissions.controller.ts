import type { AccessContext } from '../../shared/authorization'
import { requireActor, requireVerifiedActor } from '../../shared/authorization'
import { badRequest } from '../../shared/errors'
import type { Page } from '../../shared/http'
import type { IdempotencyStore } from '../../shared/idempotency'
import type {
  SubmissionRow,
  SubmissionStatus,
  SubmissionVersionRow,
} from './submissions.repository'
import type { SaveDraftInput, SubmissionDetail, SubmissionsService } from './submissions.service'

function serializeVersion(row: SubmissionVersionRow) {
  return {
    id: row.id,
    submissionId: row.submissionId,
    versionNumber: row.versionNumber,
    isFinal: row.isFinal,
    title: row.title,
    tagline: row.tagline,
    problemStatement: row.problemStatement,
    solutionDescription: row.solutionDescription,
    impactBeneficiaries: row.impactBeneficiaries,
    technologyTags: row.technologyTags,
    repositoryUrl: row.repositoryUrl,
    demoUrl: row.demoUrl,
    pitchVideoUrl: row.pitchVideoUrl,
    presentationUrl: row.presentationUrl,
    supportingLinks: row.supportingLinks,
    publicationConsent: row.publicationConsent,
    termsVersionId: row.termsVersionId,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeDetail(detail: SubmissionDetail) {
  return {
    id: detail.submission.id,
    challengeId: detail.submission.challengeId,
    teamId: detail.submission.teamId,
    trackId: detail.submission.trackId,
    status: detail.submission.status,
    draftVersion: detail.draftVersion === null ? null : serializeVersion(detail.draftVersion),
    screenshots: detail.screenshots.map((s) => ({ slot: s.slot, mediaAssetId: s.mediaAssetId })),
    presentationFiles: detail.presentationFiles,
    disqualificationReason: detail.submission.disqualificationReason,
    createdAt: detail.submission.createdAt.toISOString(),
  }
}

function serializeSummary(row: SubmissionRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    teamId: row.teamId,
    trackId: row.trackId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeSummaryPage(page: Page<SubmissionRow>) {
  return {
    items: page.items.map(serializeSummary),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

export function createSubmissionsController(
  service: SubmissionsService,
  idempotency: IdempotencyStore,
) {
  return {
    async getMine(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const detail = await service.getMine(access, organizationId, challengeId)
      return detail === null ? null : serializeDetail(detail)
    },

    async createMine(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const detail = await service.createMine(access, organizationId, challengeId)
      return serializeDetail(detail)
    },

    async get(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
    ) {
      requireActor(access)
      const detail = await service.get(access, organizationId, challengeId, submissionId)
      return serializeDetail(detail)
    },

    async saveDraft(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
      input: SaveDraftInput,
    ) {
      requireActor(access)
      const detail = await service.saveDraft(
        access,
        organizationId,
        challengeId,
        submissionId,
        input,
      )
      return serializeDetail(detail)
    },

    async listVersions(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
    ) {
      requireActor(access)
      const rows = await service.listVersions(access, organizationId, challengeId, submissionId)
      return rows.map(serializeVersion)
    },

    async getVersion(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
      versionId: string,
    ) {
      requireActor(access)
      const row = await service.getVersion(
        access,
        organizationId,
        challengeId,
        submissionId,
        versionId,
      )
      return serializeVersion(row)
    },

    async finalize(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
      idempotencyKey: string | undefined,
    ) {
      const { actor } = requireVerifiedActor(access)
      if (idempotencyKey === undefined) {
        throw badRequest('An Idempotency-Key header is required for this operation.')
      }

      const result = await idempotency.run(
        {
          actorUserId: actor.userId,
          operation: 'submission.finalize',
          key: idempotencyKey,
          requestBody: { organizationId, challengeId, submissionId },
          organizationId,
        },
        async (tx) => {
          const detail = await service.finalize(
            access,
            organizationId,
            challengeId,
            submissionId,
            tx,
          )
          return { status: 200, body: serializeDetail(detail) }
        },
      )
      return result.value
    },

    async listForChallenge(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      status: SubmissionStatus | undefined,
      query: { limit?: number; cursor?: string },
    ) {
      requireActor(access)
      const page = await service.listForChallenge(
        access,
        organizationId,
        challengeId,
        status,
        query,
      )
      return serializeSummaryPage(page)
    },

    async reopen(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.reopen(access, organizationId, challengeId, submissionId, reason)
      return serializeSummary(row)
    },

    async disqualify(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.disqualify(
        access,
        organizationId,
        challengeId,
        submissionId,
        reason,
      )
      return serializeSummary(row)
    },

    async reinstate(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
      reason: string,
    ) {
      requireActor(access)
      const row = await service.reinstate(access, organizationId, challengeId, submissionId, reason)
      return serializeSummary(row)
    },
  }
}

export type SubmissionsController = ReturnType<typeof createSubmissionsController>
