import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { type Page, type PaginationLimits, toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import type { ChallengesRepository } from '../challenges/challenges.repository'
import type { FormResponseRow, FormsRepository } from '../forms/forms.repository'
import { validateFormResponseData } from '../forms/forms.service'
import type { MembershipsRepository } from '../memberships/memberships.repository'
import type {
  ParticipationRepository,
  ParticipationRow,
  ParticipationStatus,
} from './participation.repository'

export interface RegisterInput {
  acceptTermsVersionId?: string
  formResponseId?: string
}

export interface ParticipationService {
  register(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: RegisterInput,
  ): Promise<ParticipationRow>
  /**
   * The published CHALLENGE_PARTICIPATION screening form's schema for this
   * challenge, or null if none is configured/published. Deliberately NOT
   * routed through the generic forms module's own `getDefinition`/
   * `listVersions` (both gated on `organization.view_private`, i.e. active
   * membership) — a screening application exists specifically to let a
   * *prospective* participant apply, and `participationPolicy` can be
   * `APPROVED_CHALLENGE_PARTICIPANTS` (screening required) independently of
   * org membership. Matches `saveApplication`/`submitApplication`'s own
   * posture: any authenticated, verified user, no org role required.
   */
  getApplicationForm(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<{ formDefinitionId: string; fields: unknown[] } | null>
  saveApplication(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    responseData: Record<string, unknown>,
  ): Promise<FormResponseRow>
  submitApplication(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    responseData: Record<string, unknown>,
    acceptTermsVersionId?: string,
  ): Promise<ParticipationRow>
  getMine(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<ParticipationRow | null>
  withdraw(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<ParticipationRow>
  get(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    participationId: string,
  ): Promise<ParticipationRow>
  list(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    status: ParticipationStatus | undefined,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<ParticipationRow>>
  approve(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    participationId: string,
    reason?: string,
  ): Promise<ParticipationRow>
  reject(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    participationId: string,
    reason: string,
    internalNotes?: string,
  ): Promise<ParticipationRow>
  disqualify(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    participationId: string,
    reason: string,
  ): Promise<ParticipationRow>
  reinstate(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    participationId: string,
    reason: string,
  ): Promise<ParticipationRow>
}

export function createParticipationService(
  repository: ParticipationRepository,
  challengesRepository: ChallengesRepository,
  membershipsRepository: MembershipsRepository,
  formsRepository: FormsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  paginationLimits: PaginationLimits,
): ParticipationService {
  const service: ParticipationService = {
    async register(access, organizationId, challengeId, input) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()
      if (!actor.emailVerified) {
        throw forbidden('You must verify your email address before registering for a challenge.')
      }

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')

          if (challenge.status !== 'OPEN') {
            throw conflict(
              ErrorCode.CONFLICT,
              'This challenge is not currently open for registration.',
            )
          }
          const now = new Date()
          if (challenge.registrationOpenAt !== null && now < challenge.registrationOpenAt) {
            throw conflict(ErrorCode.CONFLICT, 'Registration has not opened yet.')
          }
          if (challenge.registrationCloseAt !== null && now > challenge.registrationCloseAt) {
            throw conflict(ErrorCode.CONFLICT, 'Registration has closed.')
          }

          if (challenge.participationPolicy === 'ORG_MEMBERS_ONLY') {
            const membership = await membershipsRepository.find(tx, organizationId, actor.userId)
            if (membership === null || membership.status !== 'ACTIVE') {
              throw forbidden('Only active organization members may register for this challenge.')
            }
          }

          const activeTerms = await challengesRepository.findActiveTermsVersion(
            tx,
            organizationId,
            challengeId,
          )
          if (activeTerms !== null) {
            if (input.acceptTermsVersionId !== activeTerms.id) {
              throw badRequest('You must accept the current terms version to register.')
            }
          }

          const requiresScreening =
            challenge.screeningRequired ||
            challenge.participationPolicy === 'APPROVED_CHALLENGE_PARTICIPANTS'

          let formResponseId: string | undefined
          if (requiresScreening) {
            const formDefinition = await formsRepository.findDefinitionByChallenge(
              tx,
              organizationId,
              challengeId,
              'CHALLENGE_PARTICIPATION',
            )
            if (formDefinition === null) {
              throw conflict(
                ErrorCode.CONFLICT,
                'This challenge requires a screening application, which has not been configured yet.',
              )
            }
            const publishedVersion = await formsRepository.findPublishedVersion(
              tx,
              organizationId,
              formDefinition.id,
            )
            if (publishedVersion === null) {
              throw conflict(
                ErrorCode.CONFLICT,
                'This challenge requires a screening application, which has not been published yet.',
              )
            }
            if (input.formResponseId === undefined) {
              throw badRequest('A completed screening application is required to register.')
            }
            const response = await formsRepository.findResponseById(
              tx,
              organizationId,
              input.formResponseId,
            )
            if (
              response === null ||
              response.isDraft ||
              response.userId !== actor.userId ||
              response.formVersionId !== publishedVersion.id
            ) {
              throw badRequest('The provided screening application response is invalid.')
            }
            formResponseId = response.id
          }

          const status: ParticipationStatus = requiresScreening ? 'PENDING' : 'APPROVED'

          const existing = await repository.findByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )

          let participation: ParticipationRow
          if (existing === null) {
            participation = await repository.create(tx, {
              id: newId(),
              organizationId,
              challengeId,
              userId: actor.userId,
              status,
              termsVersionId: activeTerms?.id,
              acceptedTermsAt: activeTerms !== null ? now : undefined,
              formResponseId,
            })
          } else if (existing.status === 'PENDING' || existing.status === 'APPROVED') {
            throw conflict(
              ErrorCode.CONFLICT,
              'You already have an active registration for this challenge.',
            )
          } else if (existing.status === 'DISQUALIFIED') {
            throw forbidden(
              'You have been disqualified from this challenge and cannot re-register.',
            )
          } else {
            participation = await repository.reRegister(tx, organizationId, existing.id, {
              status,
              termsVersionId: activeTerms?.id,
              acceptedTermsAt: activeTerms !== null ? now : undefined,
              formResponseId,
            })
          }

          if (activeTerms !== null) {
            await repository.recordConsent(tx, {
              id: newId(),
              organizationId,
              userId: actor.userId,
              termsVersionId: activeTerms.id,
              context: 'challenge_registration',
            })
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action:
              status === 'PENDING'
                ? AuditAction.ParticipationApplicationSubmitted
                : AuditAction.ParticipationRegistered,
            resourceType: 'challenge_participation',
            resourceId: participation.id,
            summary:
              status === 'PENDING'
                ? `Submitted a participation application for "${challenge.title}".`
                : `Registered for "${challenge.title}".`,
          })
          return participation
        },
        { actorUserId: actor.userId },
      )
    },

    async getApplicationForm(access, organizationId, challengeId) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')

          const definition = await formsRepository.findDefinitionByChallenge(
            tx,
            organizationId,
            challengeId,
            'CHALLENGE_PARTICIPATION',
          )
          if (definition === null) return null

          const version = await formsRepository.findPublishedVersion(tx, organizationId, definition.id)
          if (version === null) return null

          return {
            formDefinitionId: definition.id,
            fields: (version.schema as { fields: unknown[] }).fields,
          }
        },
        { actorUserId: actor.userId },
      )
    },

    async saveApplication(access, organizationId, challengeId, responseData) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()
      if (!actor.emailVerified) {
        throw forbidden('You must verify your email address before saving an application.')
      }
      if (JSON.stringify(responseData).length > 64 * 1024) {
        throw badRequest('The application response exceeds the 64 KiB limit.')
      }

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await tx.$queryRaw`
            select pg_advisory_xact_lock(
              hashtextextended(${`participation-draft:${organizationId}:${challengeId}:${actor.userId}`}, 0)
            )::text as acquired
          `
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          const now = await transactions.databaseNow(tx)
          if (
            challenge.status !== 'OPEN' ||
            (challenge.registrationOpenAt !== null && now < challenge.registrationOpenAt) ||
            (challenge.registrationCloseAt !== null && now > challenge.registrationCloseAt)
          ) {
            throw conflict(ErrorCode.CONFLICT, 'Applications cannot be edited at this time.')
          }
          const existingParticipation = await repository.findByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )
          if (
            existingParticipation?.status === 'PENDING' ||
            existingParticipation?.status === 'APPROVED' ||
            existingParticipation?.status === 'DISQUALIFIED'
          ) {
            throw conflict(ErrorCode.CONFLICT, 'A submitted application cannot be edited.')
          }
          const definition = await formsRepository.findDefinitionByChallenge(
            tx,
            organizationId,
            challengeId,
            'CHALLENGE_PARTICIPATION',
          )
          if (definition === null) {
            throw conflict(ErrorCode.CONFLICT, 'No screening application is configured.')
          }
          const version = await formsRepository.findPublishedVersion(
            tx,
            organizationId,
            definition.id,
          )
          if (version === null) {
            throw conflict(ErrorCode.CONFLICT, 'No screening application is published.')
          }
          const draft = await formsRepository.saveParticipationDraft(tx, {
            id: newId(),
            organizationId,
            formVersionId: version.id,
            challengeId,
            userId: actor.userId,
            responseData,
            savedAt: now,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.ParticipationApplicationDraftSaved,
            resourceType: 'form_response',
            resourceId: draft.id,
            summary: 'Saved a challenge participation application draft.',
          })
          return draft
        },
        { actorUserId: actor.userId },
      )
    },

    async submitApplication(
      access,
      organizationId,
      challengeId,
      responseData,
      acceptTermsVersionId,
    ) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()
      if (!actor.emailVerified) {
        throw forbidden('You must verify your email address before applying to a challenge.')
      }

      // The screening application's own owning-workflow endpoint (master
      // prompt 34.16), rather than requiring the client to first call the
      // generic forms/responses route and thread the resulting ID into
      // `register` itself. Deliberately not authorized through
      // `formsService.submitResponse` — that method requires
      // `Permission.OrganizationViewPrivate`, which an OPEN_AUTHENTICATED
      // challenge's applicant does not hold and should not need; only the
      // pure schema validation is reused, never that authorization.
      const responseId = await transactions.withTenant(
        organizationId,
        async (tx) => {
          await tx.$queryRaw`
            select pg_advisory_xact_lock(
              hashtextextended(${`participation-draft:${organizationId}:${challengeId}:${actor.userId}`}, 0)
            )::text as acquired
          `
          const definition = await formsRepository.findDefinitionByChallenge(
            tx,
            organizationId,
            challengeId,
            'CHALLENGE_PARTICIPATION',
          )
          if (definition === null) {
            throw conflict(
              ErrorCode.CONFLICT,
              'This challenge requires a screening application, which has not been configured yet.',
            )
          }
          const version = await formsRepository.findPublishedVersion(
            tx,
            organizationId,
            definition.id,
          )
          if (version === null) {
            throw conflict(
              ErrorCode.CONFLICT,
              'This challenge requires a screening application, which has not been published yet.',
            )
          }

          const result = validateFormResponseData(version.schema, responseData)
          if (!result.valid) {
            throw badRequest(`Invalid screening application: ${result.errorText}`)
          }

          const submittedAt = await transactions.databaseNow(tx)
          const response =
            (await formsRepository.submitParticipationDraft(tx, {
              organizationId,
              formVersionId: version.id,
              challengeId: version.challengeId ?? challengeId,
              userId: actor.userId,
              responseData,
              submittedAt,
            })) ??
            (await formsRepository.createResponse(tx, {
              id: newId(),
              organizationId,
              formVersionId: version.id,
              challengeId: version.challengeId ?? challengeId,
              userId: actor.userId,
              responseData,
            }))

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.FormResponseSubmitted,
            resourceType: 'form_response',
            resourceId: response.id,
            summary: 'Submitted a challenge screening application.',
          })
          return response.id
        },
        { actorUserId: actor.userId },
      )

      return service.register(access, organizationId, challengeId, {
        formResponseId: responseId,
        acceptTermsVersionId,
      })
    },

    async getMine(access, organizationId, challengeId) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()

      return transactions.withTenant(organizationId, (tx) =>
        repository.findByChallengeAndUser(tx, organizationId, challengeId, actor.userId),
      )
    },

    async withdraw(access, organizationId, challengeId) {
      const actor = access.actor
      if (actor === null || actor === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const existing = await repository.findByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )
          if (existing === null) throw notFound('You have no registration for this challenge.')
          if (existing.status !== 'PENDING' && existing.status !== 'APPROVED') {
            throw conflict(ErrorCode.CONFLICT, 'This registration cannot be withdrawn.')
          }

          const withdrawn = await repository.withdraw(tx, organizationId, existing.id)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.ParticipationWithdrawn,
            resourceType: 'challenge_participation',
            resourceId: existing.id,
            summary: 'Withdrew from a challenge.',
          })
          return withdrawn
        },
        { actorUserId: actor.userId },
      )
    },

    async get(access, organizationId, challengeId, participationId) {
      authorize(access, Permission.ChallengeManageParticipants)
      return transactions.withTenant(organizationId, async (tx) => {
        const participation = await repository.findById(tx, organizationId, participationId)
        if (participation === null || participation.challengeId !== challengeId) {
          throw notFound('Participation not found.')
        }
        return participation
      })
    },

    async list(access, organizationId, challengeId, status, query) {
      authorize(access, Permission.ChallengeManageParticipants)
      const page = toPageRequest(query, paginationLimits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.list(tx, organizationId, challengeId, status, page),
      )
    },

    async approve(access, organizationId, challengeId, participationId, reason) {
      authorize(access, Permission.ChallengeManageParticipants)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const participation = await repository.findById(tx, organizationId, participationId)
          if (participation === null || participation.challengeId !== challengeId) {
            throw notFound('Participation not found.')
          }
          if (participation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'Only a pending application can be approved.')
          }

          const decided = await repository.decide(tx, organizationId, participationId, {
            status: 'APPROVED',
            decidedByUserId: actorUserId,
            decisionReason: reason,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ParticipationApproved,
            resourceType: 'challenge_participation',
            resourceId: participationId,
            summary: 'Approved a challenge participation application.',
            reason,
          })

          await outbox.write(tx, {
            eventType: 'participation.decided',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_participation',
            aggregateId: participationId,
            organizationId,
            dedupeKey: `participation-decided:${participationId}:approved`,
            payload: { participationId, challengeId, status: 'APPROVED' },
          })

          return decided
        },
        { actorUserId },
      )
    },

    async reject(access, organizationId, challengeId, participationId, reason, internalNotes) {
      authorize(access, Permission.ChallengeManageParticipants)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const participation = await repository.findById(tx, organizationId, participationId)
          if (participation === null || participation.challengeId !== challengeId) {
            throw notFound('Participation not found.')
          }
          if (participation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'Only a pending application can be rejected.')
          }

          const decided = await repository.decide(tx, organizationId, participationId, {
            status: 'REJECTED',
            decidedByUserId: actorUserId,
            decisionReason: reason,
            internalNotes,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ParticipationRejected,
            resourceType: 'challenge_participation',
            resourceId: participationId,
            summary: 'Rejected a challenge participation application.',
            reason,
          })

          await outbox.write(tx, {
            eventType: 'participation.decided',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_participation',
            aggregateId: participationId,
            organizationId,
            dedupeKey: `participation-decided:${participationId}:rejected`,
            payload: { participationId, challengeId, status: 'REJECTED' },
          })

          return decided
        },
        { actorUserId },
      )
    },

    async disqualify(access, organizationId, challengeId, participationId, reason) {
      authorize(access, Permission.ChallengeManageParticipants)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const participation = await repository.findById(tx, organizationId, participationId)
          if (participation === null || participation.challengeId !== challengeId) {
            throw notFound('Participation not found.')
          }
          if (participation.status !== 'APPROVED') {
            throw conflict(ErrorCode.CONFLICT, 'Only an approved participant can be disqualified.')
          }

          const updated = await repository.setStatus(
            tx,
            organizationId,
            participationId,
            'DISQUALIFIED',
            {
              decidedByUserId: actorUserId,
              decisionReason: reason,
            },
          )

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ParticipationDisqualified,
            resourceType: 'challenge_participation',
            resourceId: participationId,
            summary: 'Disqualified a challenge participant.',
            reason,
          })

          await outbox.write(tx, {
            eventType: 'participation.decided',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_participation',
            aggregateId: participationId,
            organizationId,
            dedupeKey: `participation-decided:${participationId}:disqualified`,
            payload: { participationId, challengeId, status: 'DISQUALIFIED' },
          })

          return updated
        },
        { actorUserId },
      )
    },

    async reinstate(access, organizationId, challengeId, participationId, reason) {
      authorize(access, Permission.ChallengeManageParticipants)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const participation = await repository.findById(tx, organizationId, participationId)
          if (participation === null || participation.challengeId !== challengeId) {
            throw notFound('Participation not found.')
          }
          if (participation.status !== 'DISQUALIFIED') {
            throw conflict(ErrorCode.CONFLICT, 'Only a disqualified participant can be reinstated.')
          }

          const updated = await repository.setStatus(
            tx,
            organizationId,
            participationId,
            'APPROVED',
            {
              decidedByUserId: actorUserId,
              decisionReason: reason,
            },
          )

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ParticipationReinstated,
            resourceType: 'challenge_participation',
            resourceId: participationId,
            summary: 'Reinstated a disqualified challenge participant.',
            reason,
          })

          await outbox.write(tx, {
            eventType: 'participation.decided',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_participation',
            aggregateId: participationId,
            organizationId,
            dedupeKey: `participation-decided:${participationId}:reinstated`,
            payload: { participationId, challengeId, status: 'APPROVED' },
          })

          return updated
        },
        { actorUserId },
      )
    },
  }

  return service
}
