import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { type Page, toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import type { ChallengesRepository } from '../challenges/challenges.repository'
import type { MediaRepository } from '../media/media.repository'
import type { OrganizationsRepository } from '../organizations/organizations.repository'
import type { TeamsRepository } from '../teams/teams.repository'
import type { TeamsService } from '../teams/teams.service'
import type {
  SubmissionRow,
  SubmissionScreenshotRow,
  SubmissionStatus,
  SubmissionsRepository,
  SubmissionVersionInput,
  SubmissionVersionRow,
  SupportingLink,
} from './submissions.repository'

export interface SubmissionDetail {
  submission: SubmissionRow
  draftVersion: SubmissionVersionRow | null
  screenshots: SubmissionScreenshotRow[]
}

export interface SaveDraftInput extends SubmissionVersionInput {
  screenshotAssetIds?: string[]
}

export interface SubmissionsService {
  getMine(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<SubmissionDetail | null>
  createMine(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<SubmissionDetail>
  get(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
  ): Promise<SubmissionDetail>
  saveDraft(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    input: SaveDraftInput,
  ): Promise<SubmissionDetail>
  listVersions(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
  ): Promise<SubmissionVersionRow[]>
  getVersion(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    versionId: string,
  ): Promise<SubmissionVersionRow>
  finalize(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    transaction?: PrismaTransactionClient,
  ): Promise<SubmissionDetail>
  listForChallenge(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    status: SubmissionStatus | undefined,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<SubmissionRow>>
  reopen(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    reason: string,
  ): Promise<SubmissionRow>
  disqualify(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    reason: string,
  ): Promise<SubmissionRow>
  reinstate(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    reason: string,
  ): Promise<SubmissionRow>
}

export function createSubmissionsService(
  repository: SubmissionsRepository,
  teamsRepository: TeamsRepository,
  teamsService: TeamsService,
  challengesRepository: ChallengesRepository,
  organizationsRepository: OrganizationsRepository,
  mediaRepository: MediaRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
): SubmissionsService {
  type Tx = Parameters<SubmissionsRepository['findById']>[0]

  async function requireOwningTeamMember(
    tx: Tx,
    organizationId: string,
    challengeId: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    const member = await teamsRepository.findMemberByChallengeAndUser(
      tx,
      organizationId,
      challengeId,
      userId,
    )
    if (member === null || member.teamId !== teamId) {
      throw forbidden('Only a member of the owning team may manage this submission.')
    }
  }

  async function detail(
    tx: Tx,
    organizationId: string,
    submission: SubmissionRow,
  ): Promise<SubmissionDetail> {
    const draftVersion =
      submission.draftVersionId === null
        ? null
        : await repository.findVersionById(tx, organizationId, submission.draftVersionId)
    const screenshots =
      draftVersion === null
        ? []
        : await repository.listScreenshots(tx, organizationId, draftVersion.id)
    return { submission, draftVersion, screenshots }
  }

  async function attachScreenshots(
    tx: Tx,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    versionId: string,
    actorUserId: string,
    assetIds: string[],
  ): Promise<void> {
    if (assetIds.length > 4) {
      throw badRequest('A submission may have at most four screenshots.')
    }
    for (const [index, assetId] of assetIds.entries()) {
      const asset = await mediaRepository.findById(tx, assetId)
      if (
        asset === null ||
        asset.status !== 'CONFIRMED' ||
        asset.purpose !== 'SUBMISSION_SCREENSHOT' ||
        asset.organizationId !== organizationId ||
        asset.challengeId !== challengeId ||
        asset.resourceType !== 'submission' ||
        asset.resourceId !== submissionId ||
        asset.ownerUserId !== actorUserId
      ) {
        throw badRequest(`Screenshot ${index + 1} is not a valid confirmed upload owned by you.`)
      }
      await repository.createScreenshot(tx, {
        id: newId(),
        organizationId,
        challengeId,
        submissionVersionId: versionId,
        slot: index + 1,
        mediaAssetId: assetId,
      })
    }
  }

  return {
    async getMine(access, organizationId, challengeId) {
      const { actor } = requireVerifiedActor(access)
      return transactions.withTenant(organizationId, async (tx) => {
        const member = await teamsRepository.findMemberByChallengeAndUser(
          tx,
          organizationId,
          challengeId,
          actor.userId,
        )
        if (member === null) return null
        const submission = await repository.findByChallengeAndTeam(
          tx,
          organizationId,
          challengeId,
          member.teamId,
        )
        if (submission === null) return null
        return detail(tx, organizationId, submission)
      })
    },

    async createMine(access, organizationId, challengeId) {
      const { actor } = requireVerifiedActor(access)

      // Resolves (or, for a solo-eligible challenge, implicitly creates) the
      // caller's own team in its own transaction — master prompt section 14:
      // "normalize a solo submission to an implicit one-person challenge team".
      const team = await teamsService.ensureTeamForSubmission(access, organizationId, challengeId)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const existing = await repository.findByChallengeAndTeam(
            tx,
            organizationId,
            challengeId,
            team.id,
          )
          if (existing !== null) {
            return detail(tx, organizationId, existing)
          }

          const submission = await repository.createSubmission(tx, {
            id: newId(),
            organizationId,
            challengeId,
            teamId: team.id,
          })
          const version = await repository.createVersion(tx, {
            id: newId(),
            organizationId,
            challengeId,
            submissionId: submission.id,
            isFinal: false,
            createdByUserId: actor.userId,
          })
          await repository.setPointers(tx, organizationId, submission.id, {
            draftVersionId: version.id,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.SubmissionCreated,
            resourceType: 'submission',
            resourceId: submission.id,
            summary: 'Started a submission.',
          })

          return detail(tx, organizationId, { ...submission, draftVersionId: version.id })
        },
        { actorUserId: actor.userId },
      )
    },

    async get(access, organizationId, challengeId, submissionId) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(organizationId, async (tx) => {
        const submission = await repository.findById(tx, organizationId, submissionId)
        if (submission === null || submission.challengeId !== challengeId) {
          throw notFound('Submission not found.')
        }

        const member = await teamsRepository.findMemberByChallengeAndUser(
          tx,
          organizationId,
          challengeId,
          actor.userId,
        )
        const isOwner = member !== null && member.teamId === submission.teamId
        if (!isOwner) {
          authorize(access, Permission.SubmissionViewAll)
        }

        return detail(tx, organizationId, submission)
      })
    },

    async saveDraft(access, organizationId, challengeId, submissionId, input) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')

          // Serialize draft-version allocation and pointer movement. Without
          // this lock, concurrent saves can both choose the same next version
          // number and one fails with an internal unique-constraint error.
          const submission = await repository.lockSubmissionForUpdate(
            tx,
            organizationId,
            submissionId,
          )
          if (submission === null || submission.challengeId !== challengeId) {
            throw notFound('Submission not found.')
          }
          if (submission.status !== 'DRAFT') {
            throw conflict(
              submission.status === 'FINALIZED'
                ? ErrorCode.SUBMISSION_ALREADY_FINALIZED
                : ErrorCode.SUBMISSION_DISQUALIFIED,
              submission.status === 'FINALIZED'
                ? 'A finalized submission must be reopened before it can be edited.'
                : 'A disqualified submission cannot be edited.',
            )
          }

          await requireOwningTeamMember(
            tx,
            organizationId,
            challengeId,
            submission.teamId,
            actor.userId,
          )

          const now = await transactions.databaseNow(tx)
          if (challenge.submissionDeadline !== null && now > challenge.submissionDeadline) {
            throw conflict(ErrorCode.CONFLICT, 'The submission deadline has passed.')
          }

          const current =
            submission.draftVersionId === null
              ? null
              : await repository.findVersionById(tx, organizationId, submission.draftVersionId)

          const { screenshotAssetIds, ...fields } = input
          const merged: SubmissionVersionInput = {
            title: fields.title ?? current?.title ?? undefined,
            tagline: fields.tagline ?? current?.tagline ?? undefined,
            problemStatement: fields.problemStatement ?? current?.problemStatement ?? undefined,
            solutionDescription:
              fields.solutionDescription ?? current?.solutionDescription ?? undefined,
            impactBeneficiaries:
              fields.impactBeneficiaries ?? current?.impactBeneficiaries ?? undefined,
            technologyTags: fields.technologyTags ?? current?.technologyTags ?? undefined,
            repositoryUrl: fields.repositoryUrl ?? current?.repositoryUrl ?? undefined,
            demoUrl: fields.demoUrl ?? current?.demoUrl ?? undefined,
            pitchVideoUrl: fields.pitchVideoUrl ?? current?.pitchVideoUrl ?? undefined,
            presentationUrl: fields.presentationUrl ?? current?.presentationUrl ?? undefined,
            supportingLinks: (fields.supportingLinks ?? current?.supportingLinks) as
              | SupportingLink[]
              | undefined,
            publicationConsent: fields.publicationConsent ?? current?.publicationConsent,
            termsVersionId: fields.termsVersionId ?? current?.termsVersionId ?? undefined,
          }

          const version = await repository.createVersion(tx, {
            id: newId(),
            organizationId,
            challengeId,
            submissionId,
            isFinal: false,
            createdByUserId: actor.userId,
            ...merged,
          })

          const screenshotIds =
            screenshotAssetIds ??
            (current === null
              ? []
              : (await repository.listScreenshots(tx, organizationId, current.id)).map(
                  (s) => s.mediaAssetId,
                ))
          await attachScreenshots(
            tx,
            organizationId,
            challengeId,
            submissionId,
            version.id,
            actor.userId,
            screenshotIds,
          )

          await repository.setPointers(tx, organizationId, submissionId, {
            draftVersionId: version.id,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.SubmissionDraftSaved,
            resourceType: 'submission',
            resourceId: submissionId,
            summary: 'Saved a submission draft.',
          })

          const after = await repository.findById(tx, organizationId, submissionId)
          if (after === null) throw notFound('Submission not found.')
          return detail(tx, organizationId, after)
        },
        { actorUserId: actor.userId },
      )
    },

    async listVersions(access, organizationId, challengeId, submissionId) {
      const { actor } = requireVerifiedActor(access)
      return transactions.withTenant(organizationId, async (tx) => {
        const submission = await repository.findById(tx, organizationId, submissionId)
        if (submission === null || submission.challengeId !== challengeId) {
          throw notFound('Submission not found.')
        }
        const member = await teamsRepository.findMemberByChallengeAndUser(
          tx,
          organizationId,
          challengeId,
          actor.userId,
        )
        if (member === null || member.teamId !== submission.teamId) {
          authorize(access, Permission.SubmissionViewAll)
        }
        return repository.listVersions(tx, organizationId, submissionId)
      })
    },

    async getVersion(access, organizationId, challengeId, submissionId, versionId) {
      const { actor } = requireVerifiedActor(access)
      return transactions.withTenant(organizationId, async (tx) => {
        const submission = await repository.findById(tx, organizationId, submissionId)
        if (submission === null || submission.challengeId !== challengeId) {
          throw notFound('Submission not found.')
        }
        const member = await teamsRepository.findMemberByChallengeAndUser(
          tx,
          organizationId,
          challengeId,
          actor.userId,
        )
        if (member === null || member.teamId !== submission.teamId) {
          authorize(access, Permission.SubmissionViewAll)
        }
        const version = await repository.findVersionById(tx, organizationId, versionId)
        if (version === null || version.submissionId !== submissionId)
          throw notFound('Version not found.')
        return version
      })
    },

    async finalize(access, organizationId, challengeId, submissionId, transaction) {
      const { actor } = requireVerifiedActor(access)

      const execute = async (tx: PrismaTransactionClient) => {
        const organization = await organizationsRepository.findById(tx, organizationId)
        if (organization === null || organization.status !== 'ACTIVE') {
          throw conflict(
            ErrorCode.ORGANIZATION_SUSPENDED,
            'This organization is not currently active.',
          )
        }

        const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
        if (challenge === null) throw notFound('Challenge not found.')

        const now = await transactions.databaseNow(tx)
        if (
          challenge.status !== 'OPEN' ||
          challenge.submissionDeadline === null ||
          now > challenge.submissionDeadline
        ) {
          throw conflict(
            ErrorCode.CONFLICT,
            'This challenge is not currently accepting final submissions.',
          )
        }

        const locked = await repository.lockSubmissionForUpdate(tx, organizationId, submissionId)
        if (locked === null || locked.challengeId !== challengeId)
          throw notFound('Submission not found.')
        if (locked.status === 'DISQUALIFIED') {
          throw conflict(ErrorCode.CONFLICT, 'A disqualified submission cannot be finalized.')
        }
        if (locked.status === 'FINALIZED' || locked.finalVersionId !== null) {
          throw conflict(
            ErrorCode.SUBMISSION_ALREADY_FINALIZED,
            'This submission has already been finalized.',
          )
        }

        await requireOwningTeamMember(tx, organizationId, challengeId, locked.teamId, actor.userId)

        const memberCount = await teamsRepository.countMembers(tx, organizationId, locked.teamId)
        if (memberCount < challenge.minTeamSize) {
          throw conflict(
            ErrorCode.CONFLICT,
            `This team has fewer than the required ${challenge.minTeamSize} member(s).`,
          )
        }

        if (locked.draftVersionId === null) {
          throw badRequest('There is no draft to finalize. Save a draft first.')
        }
        const draft = await repository.findVersionById(tx, organizationId, locked.draftVersionId)
        if (draft === null) throw notFound('Draft version not found.')

        const requirements = await challengesRepository.findActiveSubmissionRequirementVersion(
          tx,
          organizationId,
          challengeId,
        )
        if (requirements === null || requirements.lockedAt === null) {
          throw conflict(
            ErrorCode.CONFLICT,
            'The challenge submission requirements are not locked.',
          )
        }
        const requiredTextFields: [string, unknown, boolean][] = [
          ['title', draft.title, requirements.requireTitle],
          ['tagline', draft.tagline, requirements.requireTagline],
          ['problemStatement', draft.problemStatement, requirements.requireProblemStatement],
          [
            'solutionDescription',
            draft.solutionDescription,
            requirements.requireSolutionDescription,
          ],
          [
            'impactBeneficiaries',
            draft.impactBeneficiaries,
            requirements.requireImpactBeneficiaries,
          ],
          ['repositoryUrl', draft.repositoryUrl, requirements.requireRepositoryUrl],
          ['demoUrl', draft.demoUrl, requirements.requireDemoUrl],
          ['pitchVideoUrl', draft.pitchVideoUrl, requirements.requirePitchVideoUrl],
        ]
        for (const [field, value, required] of requiredTextFields) {
          if (required && (typeof value !== 'string' || value.trim() === '')) {
            throw badRequest(
              `"${field}" is required by requirement version ${requirements.version}.`,
            )
          }
        }
        if (requirements.requireTechnologyTags && draft.technologyTags.length === 0) {
          throw badRequest('At least one technology tag is required before finalizing.')
        }
        if (requirements.requireSupportingLinks && draft.supportingLinks.length === 0) {
          throw badRequest('At least one supporting link is required before finalizing.')
        }
        if (requirements.requirePublicationConsent && !draft.publicationConsent) {
          throw badRequest('Publication consent is required before finalizing.')
        }

        const activeTerms = await challengesRepository.findActiveTermsVersion(
          tx,
          organizationId,
          challengeId,
        )
        if (activeTerms !== null && draft.termsVersionId !== activeTerms.id) {
          throw badRequest('You must accept the current terms version before finalizing.')
        }

        const screenshots = await repository.listScreenshots(tx, organizationId, draft.id)
        if (
          screenshots.length < requirements.minScreenshots ||
          screenshots.length > requirements.maxScreenshots
        ) {
          throw badRequest(
            `Between ${requirements.minScreenshots} and ${requirements.maxScreenshots} screenshots are required.`,
          )
        }
        const presentationAssets = await tx.submissionAsset.findMany({
          where: {
            organizationId,
            challengeId,
            submissionVersionId: draft.id,
            kind: 'PRESENTATION_FILE',
          },
        })
        if (
          requirements.requirePresentationAsset &&
          draft.presentationUrl === null &&
          presentationAssets.length === 0
        ) {
          throw badRequest('A presentation URL or clean private presentation file is required.')
        }

        const finalVersion = await repository.createVersion(tx, {
          id: newId(),
          organizationId,
          challengeId,
          submissionId,
          isFinal: true,
          createdByUserId: actor.userId,
          title: draft.title ?? undefined,
          tagline: draft.tagline ?? undefined,
          problemStatement: draft.problemStatement ?? undefined,
          solutionDescription: draft.solutionDescription ?? undefined,
          impactBeneficiaries: draft.impactBeneficiaries ?? undefined,
          technologyTags: draft.technologyTags,
          repositoryUrl: draft.repositoryUrl ?? undefined,
          demoUrl: draft.demoUrl ?? undefined,
          pitchVideoUrl: draft.pitchVideoUrl ?? undefined,
          presentationUrl: draft.presentationUrl ?? undefined,
          supportingLinks: draft.supportingLinks,
          publicationConsent: draft.publicationConsent,
          termsVersionId: draft.termsVersionId ?? undefined,
        })
        for (const screenshot of screenshots) {
          await repository.createScreenshot(tx, {
            id: newId(),
            organizationId,
            challengeId,
            submissionVersionId: finalVersion.id,
            slot: screenshot.slot,
            mediaAssetId: screenshot.mediaAssetId,
          })
        }
        for (const asset of presentationAssets) {
          await tx.submissionAsset.create({
            data: {
              id: newId(),
              organizationId,
              challengeId,
              submissionVersionId: finalVersion.id,
              kind: 'PRESENTATION_FILE',
              fileAssetId: asset.fileAssetId,
              displayName: asset.displayName,
            },
          })
        }

        await repository.setPointers(tx, organizationId, submissionId, {
          finalVersionId: finalVersion.id,
          status: 'FINALIZED',
          finalizedAt: now,
        })

        await audit.write(tx, {
          organizationId,
          actorType: 'USER',
          actorUserId: actor.userId,
          action: AuditAction.SubmissionFinalized,
          resourceType: 'submission',
          resourceId: submissionId,
          summary: 'Finalized a submission.',
        })

        await outbox.write(tx, {
          eventType: 'submission.finalized',
          queueName: QueueName.NotificationFanout,
          aggregateType: 'submission',
          aggregateId: submissionId,
          organizationId,
          payload: { submissionId, challengeId, teamId: locked.teamId },
          dedupeKey: `submission.finalized:${submissionId}:${finalVersion.id}`,
        })

        const after = await repository.findById(tx, organizationId, submissionId)
        if (after === null) throw notFound('Submission not found.')
        return detail(tx, organizationId, after)
      }

      if (transaction !== undefined) return execute(transaction)
      return transactions.withTenant(organizationId, execute, { actorUserId: actor.userId })
    },

    async listForChallenge(access, organizationId, challengeId, status, query) {
      authorize(access, Permission.SubmissionViewAll)
      const page = toPageRequest(query, { defaultPageSize: 20, maxPageSize: 100 })
      return transactions.withTenant(organizationId, (tx) =>
        repository.listByChallenge(tx, organizationId, challengeId, status, page),
      )
    },

    async reopen(access, organizationId, challengeId, submissionId, reason) {
      authorize(access, Permission.SubmissionReopen)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const submission = await repository.findById(tx, organizationId, submissionId)
          if (submission === null || submission.challengeId !== challengeId) {
            throw notFound('Submission not found.')
          }
          if (submission.status !== 'FINALIZED') {
            throw conflict(ErrorCode.CONFLICT, 'Only a finalized submission can be reopened.')
          }

          await repository.setPointers(tx, organizationId, submissionId, { status: 'DRAFT' })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.SubmissionReopened,
            resourceType: 'submission',
            resourceId: submissionId,
            summary: 'Reopened a submission for editing.',
            reason,
          })

          const after = await repository.findById(tx, organizationId, submissionId)
          if (after === null) throw notFound('Submission not found.')
          return after
        },
        { actorUserId },
      )
    },

    async disqualify(access, organizationId, challengeId, submissionId, reason) {
      authorize(access, Permission.SubmissionDisqualify)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const submission = await repository.findById(tx, organizationId, submissionId)
          if (submission === null || submission.challengeId !== challengeId) {
            throw notFound('Submission not found.')
          }
          if (submission.status === 'DISQUALIFIED') {
            throw conflict(ErrorCode.CONFLICT, 'This submission is already disqualified.')
          }

          await repository.setDisqualified(tx, organizationId, submissionId, {
            disqualifiedByUserId: actorUserId,
            reason,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.SubmissionDisqualified,
            resourceType: 'submission',
            resourceId: submissionId,
            summary: 'Disqualified a submission.',
            reason,
          })

          const after = await repository.findById(tx, organizationId, submissionId)
          if (after === null) throw notFound('Submission not found.')
          return after
        },
        { actorUserId },
      )
    },

    async reinstate(access, organizationId, challengeId, submissionId, reason) {
      authorize(access, Permission.SubmissionReopen)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const submission = await repository.findById(tx, organizationId, submissionId)
          if (submission === null || submission.challengeId !== challengeId) {
            throw notFound('Submission not found.')
          }
          if (submission.status !== 'DISQUALIFIED') {
            throw conflict(ErrorCode.CONFLICT, 'Only a disqualified submission can be reinstated.')
          }

          await repository.reinstate(tx, organizationId, submissionId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.SubmissionReinstated,
            resourceType: 'submission',
            resourceId: submissionId,
            summary: 'Reinstated a disqualified submission.',
            reason,
          })

          const after = await repository.findById(tx, organizationId, submissionId)
          if (after === null) throw notFound('Submission not found.')
          return after
        },
        { actorUserId },
      )
    },
  }
}
