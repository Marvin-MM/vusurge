import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { AppConfig } from '../../shared/config/config.schema'
import type { TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, notFound, unprocessable } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { syncPortfolioReviewSchedule } from '../../shared/reminders'
import { isConfirmedMediaBinding, type MediaRepository } from '../media/media.repository'
import type { SubmissionsRepository } from '../submissions/submissions.repository'
import type {
  EvidenceRow,
  InnovationFields,
  InnovationPortfolioRepository,
  InnovationRow,
  InnovationStage,
  MeasurementRow,
  MetricRow,
  MilestoneRow,
  StageHistoryRow,
} from './innovation-portfolio.repository'

/**
 * Innovation portfolio (master prompt section 26).
 *
 * Stage transitions are the one write path gated by its own permission
 * (`InnovationTransitionStage`, distinct from `InnovationManage`) and its
 * own required fields (decision, next review date) — every other field on
 * an innovation is edited through the ordinary `update` action. There is no
 * arbitrary workflow designer: `InnovationStage` is the fixed eight-value
 * enum from the schema, and any stage may move to any other stage, since
 * the master prompt specifies a fixed stage set but not a restricted
 * transition graph between them (unlike, say, submission status).
 */

export interface TransitionStageInput {
  newStage: InnovationStage
  decision: string
  evidenceRefs?: string[]
  notes?: string
  nextReviewDate?: Date
}

export interface InnovationPortfolioService {
  create(
    access: AccessContext,
    organizationId: string,
    input: InnovationFields,
  ): Promise<InnovationRow>
  promoteFromSubmission(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
    input: Omit<InnovationFields, 'title'> & { title?: string },
  ): Promise<InnovationRow>
  get(access: AccessContext, organizationId: string, innovationId: string): Promise<InnovationRow>
  list(
    access: AccessContext,
    organizationId: string,
    filters: { stage?: InnovationStage },
    query: { limit?: number; cursor?: string },
  ): Promise<Page<InnovationRow>>
  update(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    patch: Partial<InnovationFields>,
  ): Promise<InnovationRow>
  transitionStage(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    input: TransitionStageInput,
  ): Promise<InnovationRow>
  listStageHistory(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
  ): Promise<StageHistoryRow[]>

  createMilestone(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    input: { title: string; description?: string; status?: MilestoneRow['status']; dueDate?: Date },
  ): Promise<MilestoneRow>
  listMilestones(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
  ): Promise<MilestoneRow[]>
  updateMilestone(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    milestoneId: string,
    patch: {
      title?: string
      description?: string
      status?: MilestoneRow['status']
      dueDate?: Date | null
    },
  ): Promise<MilestoneRow>
  deleteMilestone(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    milestoneId: string,
  ): Promise<void>

  createEvidence(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    input: {
      type: EvidenceRow['type']
      title: string
      url?: string
      mediaAssetId?: string
      note?: string
    },
  ): Promise<EvidenceRow>
  listEvidence(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
  ): Promise<EvidenceRow[]>
  deleteEvidence(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    evidenceId: string,
  ): Promise<void>

  createMetric(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    input: {
      name: string
      metricType: MetricRow['metricType']
      unit?: string
      targetValue?: string
    },
  ): Promise<MetricRow>
  listMetrics(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
  ): Promise<MetricRow[]>
  updateMetric(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    metricId: string,
    patch: { name?: string; unit?: string; targetValue?: string | null },
  ): Promise<MetricRow>
  addMeasurement(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    metricId: string,
    input: { value: string; measuredAt: Date; note?: string },
  ): Promise<MeasurementRow>
  listMeasurements(
    access: AccessContext,
    organizationId: string,
    innovationId: string,
    metricId: string,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<MeasurementRow>>
}

export function createInnovationPortfolioService(
  repository: InnovationPortfolioRepository,
  submissionsRepository: SubmissionsRepository,
  mediaRepository: MediaRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  limits: PaginationLimits,
  config: AppConfig,
): InnovationPortfolioService {
  async function loadOrThrow(
    tx: Parameters<InnovationPortfolioRepository['findById']>[0],
    organizationId: string,
    innovationId: string,
  ) {
    const innovation = await repository.findById(tx, organizationId, innovationId)
    if (innovation === null) throw notFound('Innovation not found.')
    return innovation
  }

  return {
    async create(access, organizationId, input) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const innovation = await repository.create(tx, {
            id: newId(),
            organizationId,
            createdByUserId: actorUserId,
            ...input,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationCreated,
            resourceType: 'innovation',
            resourceId: innovation.id,
            summary: `Created innovation item "${innovation.title}".`,
          })

          await syncPortfolioReviewSchedule(
            tx,
            innovation,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )

          return innovation
        },
        { actorUserId },
      )
    },

    async promoteFromSubmission(access, organizationId, challengeId, submissionId, input) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const submission = await submissionsRepository.findById(tx, organizationId, submissionId)
          if (submission === null || submission.challengeId !== challengeId) {
            throw notFound('Submission not found.')
          }
          if (submission.status !== 'FINALIZED') {
            throw unprocessable(
              ErrorCode.VALIDATION_FAILED,
              'Only a finalized submission can be promoted to the innovation portfolio.',
            )
          }

          const existing = await repository.findBySourceSubmission(tx, organizationId, submissionId)
          if (existing !== null) {
            throw conflict(
              ErrorCode.CONFLICT,
              'This submission has already been promoted to the innovation portfolio.',
            )
          }

          const innovation = await repository.create(tx, {
            id: newId(),
            organizationId,
            sourceChallengeId: challengeId,
            sourceSubmissionId: submissionId,
            createdByUserId: actorUserId,
            title: input.title ?? 'Untitled innovation',
            ...input,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationPromotedFromSubmission,
            resourceType: 'innovation',
            resourceId: innovation.id,
            summary: `Promoted submission to the innovation portfolio as "${innovation.title}".`,
          })

          await syncPortfolioReviewSchedule(
            tx,
            innovation,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )

          return innovation
        },
        { actorUserId },
      )
    },

    async get(access, organizationId, innovationId) {
      authorize(access, Permission.InnovationView)
      return transactions.withTenant(organizationId, (tx) =>
        loadOrThrow(tx, organizationId, innovationId),
      )
    },

    async list(access, organizationId, filters, query) {
      authorize(access, Permission.InnovationView)
      const page = toPageRequest(query, limits)
      return transactions.withTenant(organizationId, (tx) =>
        repository.list(tx, organizationId, filters, page),
      )
    },

    async update(access, organizationId, innovationId, patch) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadOrThrow(tx, organizationId, innovationId)
          const updated = await repository.update(tx, innovationId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationUpdated,
            resourceType: 'innovation',
            resourceId: innovationId,
            summary: `Updated innovation item "${updated.title}".`,
          })

          await syncPortfolioReviewSchedule(
            tx,
            updated,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )

          return updated
        },
        { actorUserId },
      )
    },

    async transitionStage(access, organizationId, innovationId, input) {
      authorize(access, Permission.InnovationTransitionStage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const innovation = await loadOrThrow(tx, organizationId, innovationId)
          if (innovation.stage === input.newStage) {
            throw conflict(ErrorCode.CONFLICT, 'The innovation is already in this stage.')
          }

          await repository.setStage(tx, innovationId, input.newStage)
          if (input.nextReviewDate !== undefined) {
            await repository.update(tx, innovationId, { nextReviewDate: input.nextReviewDate })
          }

          const stageHistoryId = newId()
          await repository.addStageHistory(tx, {
            id: stageHistoryId,
            organizationId,
            innovationId,
            previousStage: innovation.stage,
            newStage: input.newStage,
            decision: input.decision,
            decisionMakerUserId: actorUserId,
            evidenceRefs: input.evidenceRefs ?? [],
            notes: input.notes ?? null,
            nextReviewDate: input.nextReviewDate ?? null,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationStageChanged,
            resourceType: 'innovation',
            resourceId: innovationId,
            summary: `Moved "${innovation.title}" from ${innovation.stage} to ${input.newStage}.`,
            reason: input.decision,
          })

          if (innovation.ownerUserId !== null) {
            await outbox.write(tx, {
              eventType: 'innovation.stage_changed',
              queueName: QueueName.NotificationFanout,
              aggregateType: 'innovation',
              aggregateId: innovationId,
              organizationId,
              dedupeKey: `innovation-stage-changed:${stageHistoryId}`,
              payload: {
                innovationId,
                ownerUserId: innovation.ownerUserId,
                title: innovation.title,
                previousStage: innovation.stage,
                newStage: input.newStage,
              },
            })
          }
          const updated = await loadOrThrow(tx, organizationId, innovationId)
          await syncPortfolioReviewSchedule(
            tx,
            updated,
            await transactions.databaseNow(tx),
            config.worker.schedulers.reminderLeadHours,
          )
          return updated
        },
        { actorUserId },
      )
    },

    async listStageHistory(access, organizationId, innovationId) {
      authorize(access, Permission.InnovationView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadOrThrow(tx, organizationId, innovationId)
        return repository.listStageHistory(tx, organizationId, innovationId)
      })
    },

    async createMilestone(access, organizationId, innovationId, input) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const innovation = await loadOrThrow(tx, organizationId, innovationId)
          const milestone = await repository.createMilestone(tx, {
            id: newId(),
            organizationId,
            innovationId,
            ...input,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationMilestoneChanged,
            resourceType: 'innovation_milestone',
            resourceId: milestone.id,
            summary: `Added a milestone to "${innovation.title}".`,
          })

          return milestone
        },
        { actorUserId },
      )
    },

    async listMilestones(access, organizationId, innovationId) {
      authorize(access, Permission.InnovationView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadOrThrow(tx, organizationId, innovationId)
        return repository.listMilestones(tx, organizationId, innovationId)
      })
    },

    async updateMilestone(access, organizationId, innovationId, milestoneId, patch) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const milestone = await repository.findMilestone(
            tx,
            organizationId,
            innovationId,
            milestoneId,
          )
          if (milestone === null) throw notFound('Milestone not found.')

          const completedAt =
            patch.status === 'COMPLETED' && milestone.status !== 'COMPLETED'
              ? new Date()
              : patch.status !== undefined && patch.status !== 'COMPLETED'
                ? null
                : undefined

          const updated = await repository.updateMilestone(tx, milestoneId, {
            ...patch,
            ...(completedAt !== undefined ? { completedAt } : {}),
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationMilestoneChanged,
            resourceType: 'innovation_milestone',
            resourceId: milestoneId,
            summary: `Updated milestone "${updated.title}".`,
          })

          return updated
        },
        { actorUserId },
      )
    },

    async deleteMilestone(access, organizationId, innovationId, milestoneId) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const milestone = await repository.findMilestone(
            tx,
            organizationId,
            innovationId,
            milestoneId,
          )
          if (milestone === null) throw notFound('Milestone not found.')

          await repository.deleteMilestone(tx, organizationId, innovationId, milestoneId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationMilestoneChanged,
            resourceType: 'innovation_milestone',
            resourceId: milestoneId,
            summary: `Deleted milestone "${milestone.title}".`,
          })
        },
        { actorUserId },
      )
    },

    async createEvidence(access, organizationId, innovationId, input) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadOrThrow(tx, organizationId, innovationId)
          if (input.mediaAssetId !== undefined) {
            const asset = await mediaRepository.findById(tx, input.mediaAssetId)
            if (
              !isConfirmedMediaBinding(asset, {
                purpose: 'PORTFOLIO_EVIDENCE',
                organizationId,
                challengeId: null,
                resourceType: 'innovation',
                resourceId: innovationId,
              })
            ) {
              throw badRequest('The image is not a confirmed upload for this innovation.')
            }
          }
          const evidence = await repository.createEvidence(tx, {
            id: newId(),
            organizationId,
            innovationId,
            addedByUserId: actorUserId,
            ...input,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationEvidenceChanged,
            resourceType: 'innovation_evidence',
            resourceId: evidence.id,
            summary: `Added evidence "${evidence.title}".`,
          })

          return evidence
        },
        { actorUserId },
      )
    },

    async listEvidence(access, organizationId, innovationId) {
      authorize(access, Permission.InnovationView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadOrThrow(tx, organizationId, innovationId)
        return repository.listEvidence(tx, organizationId, innovationId)
      })
    },

    async deleteEvidence(access, organizationId, innovationId, evidenceId) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const evidence = await repository.findEvidence(
            tx,
            organizationId,
            innovationId,
            evidenceId,
          )
          if (evidence === null) throw notFound('Evidence not found.')

          await repository.deleteEvidence(tx, organizationId, innovationId, evidenceId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationEvidenceChanged,
            resourceType: 'innovation_evidence',
            resourceId: evidenceId,
            summary: `Deleted evidence "${evidence.title}".`,
          })
        },
        { actorUserId },
      )
    },

    async createMetric(access, organizationId, innovationId, input) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await loadOrThrow(tx, organizationId, innovationId)
          const metric = await repository.createMetric(tx, {
            id: newId(),
            organizationId,
            innovationId,
            ...input,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationMetricChanged,
            resourceType: 'innovation_metric',
            resourceId: metric.id,
            summary: `Defined metric "${metric.name}".`,
          })

          return metric
        },
        { actorUserId },
      )
    },

    async listMetrics(access, organizationId, innovationId) {
      authorize(access, Permission.InnovationView)
      return transactions.withTenant(organizationId, async (tx) => {
        await loadOrThrow(tx, organizationId, innovationId)
        return repository.listMetrics(tx, organizationId, innovationId)
      })
    },

    async updateMetric(access, organizationId, innovationId, metricId, patch) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const metric = await repository.findMetric(tx, organizationId, innovationId, metricId)
          if (metric === null) throw notFound('Metric not found.')

          const updated = await repository.updateMetric(tx, metricId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationMetricChanged,
            resourceType: 'innovation_metric',
            resourceId: metricId,
            summary: `Updated metric "${updated.name}".`,
          })

          return updated
        },
        { actorUserId },
      )
    },

    async addMeasurement(access, organizationId, innovationId, metricId, input) {
      authorize(access, Permission.InnovationManage)
      const actorUserId = access.actor?.userId as string

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const metric = await repository.findMetric(tx, organizationId, innovationId, metricId)
          if (metric === null) throw notFound('Metric not found.')

          const measurement = await repository.addMeasurement(tx, {
            id: newId(),
            organizationId,
            metricId,
            recordedByUserId: actorUserId,
            ...input,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.InnovationMetricChanged,
            resourceType: 'innovation_metric_measurement',
            resourceId: measurement.id,
            summary: `Recorded a measurement for metric "${metric.name}".`,
          })

          return measurement
        },
        { actorUserId },
      )
    },

    async listMeasurements(access, organizationId, innovationId, metricId, query) {
      authorize(access, Permission.InnovationView)
      const page = toPageRequest(query, limits)
      return transactions.withTenant(organizationId, async (tx) => {
        const metric = await repository.findMetric(tx, organizationId, innovationId, metricId)
        if (metric === null) throw notFound('Metric not found.')
        return repository.listMeasurements(tx, organizationId, metricId, page)
      })
    },
  }
}
