import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { AppConfig } from '../../shared/config/config.schema'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { type Page, type PaginationLimits, toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue/queue-names'
import { syncChallengeReminderSchedules } from '../../shared/reminders'
import { isConfirmedMediaBinding, type MediaRepository } from '../media/media.repository'
import type {
  ChallengePrizeRow,
  ChallengeProfilePatch,
  ChallengeRow,
  ChallengeSponsorRow,
  ChallengeStatus,
  ChallengesRepository,
  ChallengeTermsVersionRow,
  ChallengeTrackRow,
  PrizePatch,
  ScheduleFields,
  SponsorPatch,
  TrackPatch,
} from './challenges.repository'

export interface CreateChallengeInput {
  title: string
  slug: string
  summary?: string
  description?: string
  visibility?: ChallengeRow['visibility']
  displayTimeZone?: string
  minTeamSize?: number
  maxTeamSize?: number
  soloParticipationAllowed?: boolean
  screeningRequired?: boolean
  participationPolicy?: ChallengeRow['participationPolicy']
  submissionRequirements?: string
  publicProjectPublicationEnabled?: boolean
  blindJudgingEnabled?: boolean
}

export type UpdateChallengeInput = ChallengeProfilePatch

export interface TrackInput {
  name: string
  description?: string
  displayOrder?: number
}

export interface PrizeInput {
  title: string
  description?: string
  valueLabel?: string
  trackId?: string
  displayOrder?: number
}

export interface SponsorInput {
  name: string
  websiteUrl?: string
  tier?: string
  displayOrder?: number
}

export interface RescheduleInput {
  registrationOpenAt?: string
  registrationCloseAt?: string
  submissionOpenAt?: string
  submissionDeadline?: string
  judgingStartAt?: string
  judgingEndAt?: string
  reason: string
}

const COSMETIC_FIELDS: readonly (keyof ChallengeProfilePatch)[] = [
  'title',
  'summary',
  'description',
  'coverAssetId',
  'publicProjectPublicationEnabled',
  'blindJudgingEnabled',
]

const STRUCTURAL_FIELDS: readonly (keyof ChallengeProfilePatch)[] = [
  'participationPolicy',
  'minTeamSize',
  'maxTeamSize',
  'soloParticipationAllowed',
  'screeningRequired',
  'visibility',
  'displayTimeZone',
  'submissionRequirements',
]

const RESCHEDULABLE_STATUSES: readonly ChallengeStatus[] = ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED']
const EXTENDABLE_STATUSES: readonly ChallengeStatus[] = ['SCHEDULED', 'OPEN']

export interface ChallengesService {
  create(
    access: AccessContext,
    organizationId: string,
    input: CreateChallengeInput,
  ): Promise<ChallengeRow>
  get(access: AccessContext, organizationId: string, challengeId: string): Promise<ChallengeRow>
  list(
    access: AccessContext,
    organizationId: string,
    status: ChallengeStatus | undefined,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<ChallengeRow>>
  update(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    patch: UpdateChallengeInput,
  ): Promise<ChallengeRow>
  publish(access: AccessContext, organizationId: string, challengeId: string): Promise<ChallengeRow>
  reschedule(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: RescheduleInput,
  ): Promise<ChallengeRow>
  extendDeadline(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    newDeadline: string,
    reason: string,
  ): Promise<ChallengeRow>
  reopen(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    newDeadline: string,
    reason: string,
  ): Promise<ChallengeRow>
  cancel(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    reason: string,
  ): Promise<ChallengeRow>
  archive(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    reason: string,
  ): Promise<ChallengeRow>

  createTrack(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: TrackInput,
  ): Promise<ChallengeTrackRow>
  listTracks(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeTrackRow[]>
  getTrack(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    trackId: string,
  ): Promise<ChallengeTrackRow>
  updateTrack(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    trackId: string,
    patch: TrackPatch,
  ): Promise<ChallengeTrackRow>
  archiveTrack(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    trackId: string,
  ): Promise<void>

  createPrize(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: PrizeInput,
  ): Promise<ChallengePrizeRow>
  listPrizes(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengePrizeRow[]>
  updatePrize(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    prizeId: string,
    patch: PrizePatch,
  ): Promise<ChallengePrizeRow>
  deletePrize(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    prizeId: string,
  ): Promise<void>

  createSponsor(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: SponsorInput,
  ): Promise<ChallengeSponsorRow>
  listSponsors(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeSponsorRow[]>
  updateSponsor(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    sponsorId: string,
    patch: SponsorPatch,
  ): Promise<ChallengeSponsorRow>
  deleteSponsor(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    sponsorId: string,
  ): Promise<void>

  createTermsVersion(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    content: string,
  ): Promise<ChallengeTermsVersionRow>
  listTermsVersions(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeTermsVersionRow[]>
  activateTermsVersion(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    termsVersionId: string,
  ): Promise<ChallengeTermsVersionRow>
  getTermsVersion(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    termsVersionId: string,
  ): Promise<ChallengeTermsVersionRow>
  getCurrentTerms(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeTermsVersionRow | null>
  acceptTerms(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    termsVersionId: string,
  ): Promise<{ termsVersionId: string; acceptedAt: string }>
}

export function createChallengesService(
  repository: ChallengesRepository,
  mediaRepository: MediaRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  paginationLimits: PaginationLimits,
  config: AppConfig,
): ChallengesService {
  async function loadForUpdate(
    tx: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeRow> {
    const challenge = await repository.findById(tx, organizationId, challengeId)
    if (challenge === null) throw notFound('Challenge not found.')
    return challenge
  }

  async function reload(
    tx: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ChallengeRow> {
    const challenge = await repository.findById(tx, organizationId, challengeId)
    if (challenge === null) throw notFound('Challenge not found.')
    return challenge
  }

  return {
    async create(access, organizationId, input) {
      authorize(access, Permission.ChallengeCreate)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      if (input.minTeamSize !== undefined && input.maxTeamSize !== undefined) {
        if (input.minTeamSize > input.maxTeamSize) {
          throw badRequest('minTeamSize cannot be greater than maxTeamSize.')
        }
      }

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          if (await repository.isSlugTaken(tx, organizationId, input.slug)) {
            throw conflict(ErrorCode.CONFLICT, 'A challenge with this slug already exists.')
          }

          const challenge = await repository.create(tx, {
            id: newId(),
            organizationId,
            createdByUserId: actorUserId,
            ...input,
          })
          await repository.createSubmissionRequirementVersion(tx, {
            id: newId(),
            organizationId,
            challengeId: challenge.id,
            guidance: input.submissionRequirements,
            createdByUserId: actorUserId,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeCreated,
            resourceType: 'challenge',
            resourceId: challenge.id,
            summary: `Created challenge "${challenge.title}".`,
          })

          return challenge
        },
        { actorUserId },
      )
    },

    async get(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, (tx) =>
        loadForUpdate(tx, organizationId, challengeId),
      )
    },

    async list(access, organizationId, status, query) {
      authorize(access, Permission.ChallengeView)
      const page = toPageRequest(query, paginationLimits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.list(tx, organizationId, status, page),
      )
    },

    async update(access, organizationId, challengeId, patch) {
      authorize(access, Permission.ChallengeEdit)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      const structuralKeys = STRUCTURAL_FIELDS.filter((field) => patch[field] !== undefined)
      const cosmeticKeys = COSMETIC_FIELDS.filter((field) => patch[field] !== undefined)

      if (patch.minTeamSize !== undefined && patch.maxTeamSize !== undefined) {
        if (patch.minTeamSize > patch.maxTeamSize) {
          throw badRequest('minTeamSize cannot be greater than maxTeamSize.')
        }
      }

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await loadForUpdate(tx, organizationId, challengeId)

          if (before.status === 'ARCHIVED' || before.status === 'CANCELLED') {
            throw conflict(
              ErrorCode.CONFLICT,
              `A ${before.status.toLowerCase()} challenge cannot be edited.`,
            )
          }

          if (
            structuralKeys.length > 0 &&
            before.status !== 'DRAFT' &&
            before.status !== 'SCHEDULED'
          ) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Structural fields can only change while the challenge is DRAFT or SCHEDULED.',
            )
          }
          if (patch.submissionRequirements !== undefined && before.status !== 'DRAFT') {
            throw conflict(
              ErrorCode.CONFLICT,
              'Submission requirements cannot change after the challenge is published.',
            )
          }

          if (patch.submissionRequirements !== undefined) {
            await repository.deactivateSubmissionRequirementVersions(
              tx,
              organizationId,
              challengeId,
            )
            await repository.createSubmissionRequirementVersion(tx, {
              id: newId(),
              organizationId,
              challengeId,
              guidance: patch.submissionRequirements ?? undefined,
              createdByUserId: actorUserId,
            })
          }

          if (patch.coverAssetId !== undefined && patch.coverAssetId !== null) {
            const asset = await mediaRepository.findById(tx, patch.coverAssetId)
            if (
              !isConfirmedMediaBinding(asset, {
                purpose: 'CHALLENGE_COVER',
                organizationId,
                challengeId,
                resourceType: 'challenge',
                resourceId: challengeId,
              })
            ) {
              throw badRequest('The cover is not a confirmed upload for this challenge.')
            }
          }

          const updated = await repository.updateProfile(
            tx,
            organizationId,
            challengeId,
            patch,
            before.version,
          )
          if (!updated) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeUpdated,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: 'Updated challenge.',
            changes: {
              before: pick(before as unknown as Record<string, unknown>, [
                ...structuralKeys,
                ...cosmeticKeys,
              ]),
              after: pick(patch as Record<string, unknown>, [...structuralKeys, ...cosmeticKeys]),
            },
          })

          return reload(tx, organizationId, challengeId)
        },
        { actorUserId },
      )
    },

    async publish(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengePublish)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await loadForUpdate(tx, organizationId, challengeId)

          if (before.status !== 'DRAFT') {
            throw conflict(ErrorCode.CONFLICT, 'Only a DRAFT challenge can be published.')
          }
          if (before.submissionDeadline === null) {
            throw badRequest('A submission deadline must be set before publishing.')
          }

          const now = await transactions.databaseNow(tx)
          const nextStatus: ChallengeStatus =
            before.registrationOpenAt === null || before.registrationOpenAt <= now
              ? 'OPEN'
              : 'SCHEDULED'

          const updated = await repository.setStatus(
            tx,
            organizationId,
            challengeId,
            nextStatus,
            { publishedAt: now },
            before.version,
          )
          if (!updated) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }
          await repository.lockActiveSubmissionRequirementVersion(
            tx,
            organizationId,
            challengeId,
            now,
          )

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengePublished,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Published challenge "${before.title}".`,
            changes: { before: { status: before.status }, after: { status: nextStatus } },
          })

          await outbox.write(tx, {
            eventType: 'challenge.published',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge',
            aggregateId: challengeId,
            organizationId,
            dedupeKey: `challenge-published:${challengeId}:${before.version + 1}`,
            payload: { challengeId, organizationId },
          })
          const published = await reload(tx, organizationId, challengeId)
          await syncChallengeReminderSchedules(
            tx,
            published,
            now,
            config.worker.schedulers.reminderLeadHours,
          )
          return published
        },
        { actorUserId },
      )
    },

    async reschedule(access, organizationId, challengeId, input) {
      authorize(access, Permission.ChallengeChangeSchedule)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      const { reason, ...fields } = input
      const patch: ScheduleFields = {}
      for (const [field, value] of Object.entries(fields)) {
        if (value !== undefined) {
          ;(patch as Record<string, Date>)[field] = new Date(value)
        }
      }

      if (Object.keys(patch).length === 0) {
        throw badRequest('At least one schedule field must be provided.')
      }

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await loadForUpdate(tx, organizationId, challengeId)

          if (!RESCHEDULABLE_STATUSES.includes(before.status)) {
            throw conflict(
              ErrorCode.CONFLICT,
              `A challenge in ${before.status} status cannot be rescheduled.`,
            )
          }

          const newSubmissionDeadline = patch.submissionDeadline ?? undefined
          if (
            newSubmissionDeadline !== undefined &&
            before.submissionDeadline !== null &&
            newSubmissionDeadline.getTime() < before.submissionDeadline.getTime()
          ) {
            if (await repository.hasAnyParticipation(tx, organizationId, challengeId)) {
              throw conflict(
                ErrorCode.CONFLICT,
                'The submission deadline cannot be shortened once participants have registered.',
              )
            }

            await audit.write(tx, {
              organizationId,
              actorType: 'USER',
              actorUserId,
              action: AuditAction.ChallengeDeadlineShortened,
              resourceType: 'challenge',
              resourceId: challengeId,
              summary: 'Shortened the submission deadline.',
              reason,
              changes: {
                before: { submissionDeadline: before.submissionDeadline.toISOString() },
                after: { submissionDeadline: newSubmissionDeadline.toISOString() },
              },
            })
          }

          const updated = await repository.updateSchedule(
            tx,
            organizationId,
            challengeId,
            patch,
            before.version,
          )
          if (!updated) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }

          for (const [field, newValue] of Object.entries(patch)) {
            await repository.recordScheduleChange(tx, {
              id: newId(),
              organizationId,
              challengeId,
              field,
              previousValue: (before as unknown as Record<string, Date | null>)[field] ?? null,
              newValue,
              reason,
              actorUserId,
            })
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeRescheduled,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Rescheduled challenge "${before.title}".`,
            reason,
            changes: {
              before: pick(before as unknown as Record<string, unknown>, Object.keys(patch)),
              after: Object.fromEntries(
                Object.entries(patch).map(([field, value]) => [field, value.toISOString()]),
              ),
            },
          })

          await outbox.write(tx, {
            eventType: 'challenge.rescheduled',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge',
            aggregateId: challengeId,
            organizationId,
            dedupeKey: `challenge-rescheduled:${challengeId}:${before.version + 1}`,
            payload: { challengeId, organizationId, fields: Object.keys(patch) },
          })
          const rescheduled = await reload(tx, organizationId, challengeId)
          await syncChallengeReminderSchedules(
            tx,
            rescheduled,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )
          return rescheduled
        },
        { actorUserId },
      )
    },

    async extendDeadline(access, organizationId, challengeId, newDeadline, reason) {
      authorize(access, Permission.ChallengeChangeSchedule)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      const next = new Date(newDeadline)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await loadForUpdate(tx, organizationId, challengeId)

          if (!EXTENDABLE_STATUSES.includes(before.status)) {
            throw conflict(
              ErrorCode.CONFLICT,
              `A challenge in ${before.status} status cannot have its deadline extended.`,
            )
          }
          if (
            before.submissionDeadline !== null &&
            next.getTime() <= before.submissionDeadline.getTime()
          ) {
            throw badRequest('The new deadline must be later than the current deadline.')
          }

          const updated = await repository.updateSchedule(
            tx,
            organizationId,
            challengeId,
            { submissionDeadline: next },
            before.version,
          )
          if (!updated) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }

          await repository.recordScheduleChange(tx, {
            id: newId(),
            organizationId,
            challengeId,
            field: 'submissionDeadline',
            previousValue: before.submissionDeadline,
            newValue: next,
            reason,
            actorUserId,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeDeadlineExtended,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Extended the submission deadline for "${before.title}".`,
            reason,
            changes: {
              before: { submissionDeadline: before.submissionDeadline?.toISOString() ?? null },
              after: { submissionDeadline: next.toISOString() },
            },
          })

          await outbox.write(tx, {
            eventType: 'challenge.deadline_extended',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge',
            aggregateId: challengeId,
            organizationId,
            dedupeKey: `challenge-deadline-extended:${challengeId}:${before.version + 1}`,
            payload: { challengeId, organizationId, newDeadline: next.toISOString() },
          })
          const extended = await reload(tx, organizationId, challengeId)
          await syncChallengeReminderSchedules(
            tx,
            extended,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )
          return extended
        },
        { actorUserId },
      )
    },

    async reopen(access, organizationId, challengeId, newDeadline, reason) {
      authorize(access, Permission.ChallengeChangeSchedule)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      const next = new Date(newDeadline)
      if (next.getTime() <= Date.now()) {
        throw badRequest('The new deadline must be in the future.')
      }

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await loadForUpdate(tx, organizationId, challengeId)

          // CLOSED is a derived state (master prompt section 10.4): no code
          // path ever persists it, since submission-window closing must read
          // the authoritative deadline rather than a delayed worker update.
          // "Only a CLOSED challenge can be reopened" therefore means
          // "effectively closed" — OPEN with a deadline that has already
          // passed, checked against database time, not the app server clock.
          const now = await transactions.databaseNow(tx)
          const isEffectivelyClosed =
            before.status === 'CLOSED' ||
            (before.status === 'OPEN' &&
              before.submissionDeadline !== null &&
              before.submissionDeadline <= now)

          if (!isEffectivelyClosed) {
            throw conflict(ErrorCode.CONFLICT, 'Only a CLOSED challenge can be reopened.')
          }

          const updated = await repository.setStatus(
            tx,
            organizationId,
            challengeId,
            'OPEN',
            {},
            before.version,
          )
          if (!updated) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }
          await repository.updateSchedule(
            tx,
            organizationId,
            challengeId,
            { submissionDeadline: next },
            before.version + 1,
          )

          await repository.recordScheduleChange(tx, {
            id: newId(),
            organizationId,
            challengeId,
            field: 'submissionDeadline',
            previousValue: before.submissionDeadline,
            newValue: next,
            reason,
            actorUserId,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeReopened,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Reopened challenge "${before.title}".`,
            reason,
            changes: {
              before: {
                status: before.status,
                submissionDeadline: before.submissionDeadline?.toISOString() ?? null,
              },
              after: { status: 'OPEN', submissionDeadline: next.toISOString() },
            },
          })

          await outbox.write(tx, {
            eventType: 'challenge.reopened',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge',
            aggregateId: challengeId,
            organizationId,
            dedupeKey: `challenge-reopened:${challengeId}:${before.version + 2}`,
            payload: { challengeId, organizationId, newDeadline: next.toISOString() },
          })
          const reopened = await reload(tx, organizationId, challengeId)
          await syncChallengeReminderSchedules(
            tx,
            reopened,
            now,
            config.worker.schedulers.reminderLeadHours,
          )
          return reopened
        },
        { actorUserId },
      )
    },

    async cancel(access, organizationId, challengeId, reason) {
      authorize(access, Permission.ChallengeCancel)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await loadForUpdate(tx, organizationId, challengeId)

          if (before.status === 'CANCELLED' || before.status === 'ARCHIVED') {
            throw conflict(
              ErrorCode.CONFLICT,
              `A ${before.status.toLowerCase()} challenge cannot be cancelled.`,
            )
          }

          const updated = await repository.setStatus(
            tx,
            organizationId,
            challengeId,
            'CANCELLED',
            {},
            before.version,
          )
          if (!updated) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeCancelled,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Cancelled challenge "${before.title}".`,
            reason,
            changes: { before: { status: before.status }, after: { status: 'CANCELLED' } },
          })

          await outbox.write(tx, {
            eventType: 'challenge.cancelled',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge',
            aggregateId: challengeId,
            organizationId,
            dedupeKey: `challenge-cancelled:${challengeId}:${before.version + 1}`,
            payload: { challengeId, organizationId, reason },
          })
          const cancelled = await reload(tx, organizationId, challengeId)
          await syncChallengeReminderSchedules(
            tx,
            cancelled,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )
          return cancelled
        },
        { actorUserId },
      )
    },

    async archive(access, organizationId, challengeId, reason) {
      authorize(access, Permission.ChallengeArchive)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await loadForUpdate(tx, organizationId, challengeId)

          if (before.status === 'ARCHIVED') {
            throw conflict(ErrorCode.CONFLICT, 'This challenge is already archived.')
          }

          const updated = await repository.setStatus(
            tx,
            organizationId,
            challengeId,
            'ARCHIVED',
            {},
            before.version,
          )
          if (!updated) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeArchived,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Archived challenge "${before.title}".`,
            reason,
          })
          const archived = await reload(tx, organizationId, challengeId)
          await syncChallengeReminderSchedules(
            tx,
            archived,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )
          return archived
        },
        { actorUserId },
      )
    },

    async createTrack(access, organizationId, challengeId, input) {
      authorize(access, Permission.ChallengeManageTracks)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const track = await repository.createTrack(tx, {
            id: newId(),
            organizationId,
            challengeId,
            ...input,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeTrackCreated,
            resourceType: 'challenge_track',
            resourceId: track.id,
            summary: `Created track "${track.name}".`,
          })
          return track
        },
        { actorUserId },
      )
    },

    async listTracks(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadForUpdate(tx, organizationId, challengeId)
        return repository.listTracks(tx, organizationId, challengeId)
      })
    },

    async getTrack(access, organizationId, challengeId, trackId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadForUpdate(tx, organizationId, challengeId)
        const track = await repository.findTrackById(tx, organizationId, trackId)
        if (track === null || track.challengeId !== challengeId) {
          throw notFound('Track not found.')
        }
        return track
      })
    },

    async updateTrack(access, organizationId, challengeId, trackId, patch) {
      authorize(access, Permission.ChallengeManageTracks)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const before = await repository.findTrackById(tx, organizationId, trackId)
          if (before === null) throw notFound('Track not found.')

          await repository.updateTrack(tx, organizationId, trackId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeTrackUpdated,
            resourceType: 'challenge_track',
            resourceId: trackId,
            summary: `Updated track "${before.name}".`,
            changes: { before: pick(before, Object.keys(patch)), after: patch },
          })

          const after = await repository.findTrackById(tx, organizationId, trackId)
          if (after === null) throw notFound('Track not found.')
          return after
        },
        { actorUserId },
      )
    },

    async archiveTrack(access, organizationId, challengeId, trackId) {
      authorize(access, Permission.ChallengeManageTracks)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const before = await repository.findTrackById(tx, organizationId, trackId)
          if (before === null) throw notFound('Track not found.')

          await repository.archiveTrack(tx, organizationId, trackId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeTrackArchived,
            resourceType: 'challenge_track',
            resourceId: trackId,
            summary: `Archived track "${before.name}".`,
          })
        },
        { actorUserId },
      )
    },

    async createPrize(access, organizationId, challengeId, input) {
      authorize(access, Permission.ChallengeManagePrizes)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const prize = await repository.createPrize(tx, {
            id: newId(),
            organizationId,
            challengeId,
            ...input,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengePrizeChanged,
            resourceType: 'challenge_prize',
            resourceId: prize.id,
            summary: `Created prize "${prize.title}".`,
          })
          return prize
        },
        { actorUserId },
      )
    },

    async listPrizes(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadForUpdate(tx, organizationId, challengeId)
        return repository.listPrizes(tx, organizationId, challengeId)
      })
    },

    async updatePrize(access, organizationId, challengeId, prizeId, patch) {
      authorize(access, Permission.ChallengeManagePrizes)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const before = await repository.findPrizeById(tx, organizationId, prizeId)
          if (before === null) throw notFound('Prize not found.')

          await repository.updatePrize(tx, organizationId, prizeId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengePrizeChanged,
            resourceType: 'challenge_prize',
            resourceId: prizeId,
            summary: `Updated prize "${before.title}".`,
            changes: { before: pick(before, Object.keys(patch)), after: patch },
          })

          const after = await repository.findPrizeById(tx, organizationId, prizeId)
          if (after === null) throw notFound('Prize not found.')
          return after
        },
        { actorUserId },
      )
    },

    async deletePrize(access, organizationId, challengeId, prizeId) {
      authorize(access, Permission.ChallengeManagePrizes)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const before = await repository.findPrizeById(tx, organizationId, prizeId)
          if (before === null) throw notFound('Prize not found.')

          await repository.deletePrize(tx, organizationId, prizeId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengePrizeChanged,
            resourceType: 'challenge_prize',
            resourceId: prizeId,
            summary: `Removed prize "${before.title}".`,
          })
        },
        { actorUserId },
      )
    },

    async createSponsor(access, organizationId, challengeId, input) {
      authorize(access, Permission.ChallengeManageSponsors)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const sponsor = await repository.createSponsor(tx, {
            id: newId(),
            organizationId,
            challengeId,
            ...input,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeSponsorChanged,
            resourceType: 'challenge_sponsor',
            resourceId: sponsor.id,
            summary: `Created sponsor "${sponsor.name}".`,
          })
          return sponsor
        },
        { actorUserId },
      )
    },

    async listSponsors(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadForUpdate(tx, organizationId, challengeId)
        return repository.listSponsors(tx, organizationId, challengeId)
      })
    },

    async updateSponsor(access, organizationId, challengeId, sponsorId, patch) {
      authorize(access, Permission.ChallengeManageSponsors)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const before = await repository.findSponsorById(tx, organizationId, sponsorId)
          if (before === null) throw notFound('Sponsor not found.')

          if (patch.logoAssetId !== undefined && patch.logoAssetId !== null) {
            const asset = await mediaRepository.findById(tx, patch.logoAssetId)
            if (
              !isConfirmedMediaBinding(asset, {
                purpose: 'SPONSOR_LOGO',
                organizationId,
                challengeId,
                resourceType: 'challenge_sponsor',
                resourceId: sponsorId,
              })
            ) {
              throw badRequest('The logo is not a confirmed upload for this sponsor.')
            }
          }

          await repository.updateSponsor(tx, organizationId, sponsorId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeSponsorChanged,
            resourceType: 'challenge_sponsor',
            resourceId: sponsorId,
            summary: `Updated sponsor "${before.name}".`,
            changes: { before: pick(before, Object.keys(patch)), after: patch },
          })

          const after = await repository.findSponsorById(tx, organizationId, sponsorId)
          if (after === null) throw notFound('Sponsor not found.')
          return after
        },
        { actorUserId },
      )
    },

    async deleteSponsor(access, organizationId, challengeId, sponsorId) {
      authorize(access, Permission.ChallengeManageSponsors)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const before = await repository.findSponsorById(tx, organizationId, sponsorId)
          if (before === null) throw notFound('Sponsor not found.')

          await repository.deleteSponsor(tx, organizationId, sponsorId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeSponsorChanged,
            resourceType: 'challenge_sponsor',
            resourceId: sponsorId,
            summary: `Removed sponsor "${before.name}".`,
          })
        },
        { actorUserId },
      )
    },

    async createTermsVersion(access, organizationId, challengeId, content) {
      authorize(access, Permission.ChallengeManageTerms)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const version = await repository.createTermsVersion(tx, {
            id: newId(),
            organizationId,
            challengeId,
            content,
            createdByUserId: actorUserId,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.TermsVersionCreated,
            resourceType: 'challenge_terms_version',
            resourceId: version.id,
            summary: `Created terms version ${version.version}.`,
          })
          return version
        },
        { actorUserId },
      )
    },

    async listTermsVersions(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadForUpdate(tx, organizationId, challengeId)
        return repository.listTermsVersions(tx, organizationId, challengeId)
      })
    },

    async activateTermsVersion(access, organizationId, challengeId, termsVersionId) {
      authorize(access, Permission.ChallengeManageTerms)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadForUpdate(tx, organizationId, challengeId)
          const version = await repository.findTermsVersionById(tx, organizationId, termsVersionId)
          if (version === null || version.challengeId !== challengeId) {
            throw notFound('Terms version not found.')
          }
          if (version.isActive) return version

          await repository.deactivateAllTermsVersions(tx, organizationId, challengeId)
          await repository.activateTermsVersion(tx, organizationId, termsVersionId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.TermsVersionActivated,
            resourceType: 'challenge_terms_version',
            resourceId: termsVersionId,
            summary: `Activated terms version ${version.version}.`,
          })

          const after = await repository.findTermsVersionById(tx, organizationId, termsVersionId)
          if (after === null) throw notFound('Terms version not found.')
          return after
        },
        { actorUserId },
      )
    },

    async getTermsVersion(access, organizationId, challengeId, termsVersionId) {
      requireVerifiedActor(access)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadForUpdate(tx, organizationId, challengeId)
        const version = await repository.findTermsVersionById(tx, organizationId, termsVersionId)
        if (version === null || version.challengeId !== challengeId) {
          throw notFound('Terms version not found.')
        }
        return version
      })
    },

    async getCurrentTerms(access, organizationId, challengeId) {
      requireVerifiedActor(access)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadForUpdate(tx, organizationId, challengeId)
        return repository.findActiveTermsVersion(tx, organizationId, challengeId)
      })
    },

    async acceptTerms(access, organizationId, challengeId, termsVersionId) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const version = await repository.findTermsVersionById(tx, organizationId, termsVersionId)
          if (version === null || version.challengeId !== challengeId) {
            throw notFound('Terms version not found.')
          }

          await repository.recordConsent(tx, {
            id: newId(),
            organizationId,
            userId: actor.userId,
            termsVersionId,
            context: 'explicit_acceptance',
          })

          const consent = await repository.findConsent(tx, actor.userId, termsVersionId)
          const acceptedAt = consent?.acceptedAt ?? new Date()

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TermsAccepted,
            resourceType: 'challenge_terms_version',
            resourceId: termsVersionId,
            summary: `Accepted terms version ${version.version} for "${version.challengeId}".`,
          })

          return { termsVersionId, acceptedAt: acceptedAt.toISOString() }
        },
        { actorUserId: actor.userId },
      )
    },
  }
}

function pick<T extends object>(source: T, keys: readonly string[]): Partial<T> {
  const result: Partial<T> = {}
  const record = source as Record<string, unknown>
  for (const key of keys) {
    if (key in record) {
      ;(result as Record<string, unknown>)[key] = record[key]
    }
  }
  return result
}
