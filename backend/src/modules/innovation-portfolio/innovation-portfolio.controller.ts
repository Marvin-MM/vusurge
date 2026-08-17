import type { AccessContext } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type {
  EvidenceRow,
  InnovationFields,
  InnovationRow,
  InnovationStage,
  MeasurementRow,
  MetricRow,
  MilestoneRow,
  StageHistoryRow,
} from './innovation-portfolio.repository'
import type {
  InnovationPortfolioService,
  TransitionStageInput,
} from './innovation-portfolio.service'

function toDate(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value)
}

function serializeInnovation(row: InnovationRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sourceChallengeId: row.sourceChallengeId,
    sourceSubmissionId: row.sourceSubmissionId,
    title: row.title,
    opportunityStatement: row.opportunityStatement,
    thesis: row.thesis,
    ownerUserId: row.ownerUserId,
    ownerTeamName: row.ownerTeamName,
    strategicThemes: row.strategicThemes,
    expectedImpact: row.expectedImpact,
    riskLevel: row.riskLevel,
    beneficiaries: row.beneficiaries,
    stage: row.stage,
    resourceNotes: row.resourceNotes,
    nextReviewDate: row.nextReviewDate?.toISOString().slice(0, 10) ?? null,
    publicVisible: row.publicVisible,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeInnovationPage(page: Page<InnovationRow>) {
  return {
    items: page.items.map(serializeInnovation),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

function serializeStageHistory(row: StageHistoryRow) {
  return {
    id: row.id,
    innovationId: row.innovationId,
    previousStage: row.previousStage,
    newStage: row.newStage,
    decision: row.decision,
    decisionMakerUserId: row.decisionMakerUserId,
    evidenceRefs: row.evidenceRefs,
    notes: row.notes,
    nextReviewDate: row.nextReviewDate?.toISOString().slice(0, 10) ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeMilestone(row: MilestoneRow) {
  return {
    id: row.id,
    innovationId: row.innovationId,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeEvidence(row: EvidenceRow) {
  return {
    id: row.id,
    innovationId: row.innovationId,
    type: row.type,
    title: row.title,
    url: row.url,
    mediaAssetId: row.mediaAssetId,
    note: row.note,
    addedByUserId: row.addedByUserId,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeMetric(row: MetricRow) {
  return {
    id: row.id,
    innovationId: row.innovationId,
    name: row.name,
    metricType: row.metricType,
    unit: row.unit,
    targetValue: row.targetValue,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeMeasurement(row: MeasurementRow) {
  return {
    id: row.id,
    metricId: row.metricId,
    value: row.value,
    measuredAt: row.measuredAt.toISOString(),
    note: row.note,
    recordedByUserId: row.recordedByUserId,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeMeasurementPage(page: Page<MeasurementRow>) {
  return {
    items: page.items.map(serializeMeasurement),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

interface InnovationBody extends Partial<Omit<InnovationFields, 'nextReviewDate'>> {
  nextReviewDate?: string
}

function fromBody(body: InnovationBody): Partial<InnovationFields> {
  return { ...body, nextReviewDate: toDate(body.nextReviewDate) }
}

export function createInnovationPortfolioController(service: InnovationPortfolioService) {
  return {
    async create(
      access: AccessContext,
      organizationId: string,
      body: InnovationBody & { title: string },
    ) {
      return serializeInnovation(
        await service.create(access, organizationId, { ...fromBody(body), title: body.title }),
      )
    },

    async promoteFromSubmission(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
      body: InnovationBody,
    ) {
      return serializeInnovation(
        await service.promoteFromSubmission(
          access,
          organizationId,
          challengeId,
          submissionId,
          fromBody(body),
        ),
      )
    },

    async get(access: AccessContext, organizationId: string, innovationId: string) {
      return serializeInnovation(await service.get(access, organizationId, innovationId))
    },

    async list(
      access: AccessContext,
      organizationId: string,
      query: { stage?: InnovationStage; limit?: number; cursor?: string },
    ) {
      return serializeInnovationPage(
        await service.list(access, organizationId, { stage: query.stage }, query),
      )
    },

    async update(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      body: InnovationBody,
    ) {
      return serializeInnovation(
        await service.update(access, organizationId, innovationId, fromBody(body)),
      )
    },

    async transitionStage(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      body: Omit<TransitionStageInput, 'nextReviewDate'> & { nextReviewDate?: string },
    ) {
      return serializeInnovation(
        await service.transitionStage(access, organizationId, innovationId, {
          ...body,
          nextReviewDate: toDate(body.nextReviewDate),
        }),
      )
    },

    async listStageHistory(access: AccessContext, organizationId: string, innovationId: string) {
      const rows = await service.listStageHistory(access, organizationId, innovationId)
      return rows.map(serializeStageHistory)
    },

    async createMilestone(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      body: {
        title: string
        description?: string
        status?: MilestoneRow['status']
        dueDate?: string
      },
    ) {
      return serializeMilestone(
        await service.createMilestone(access, organizationId, innovationId, {
          ...body,
          dueDate: toDate(body.dueDate),
        }),
      )
    },

    async listMilestones(access: AccessContext, organizationId: string, innovationId: string) {
      const rows = await service.listMilestones(access, organizationId, innovationId)
      return rows.map(serializeMilestone)
    },

    async updateMilestone(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      milestoneId: string,
      body: {
        title?: string
        description?: string
        status?: MilestoneRow['status']
        dueDate?: string | null
      },
    ) {
      return serializeMilestone(
        await service.updateMilestone(access, organizationId, innovationId, milestoneId, {
          ...body,
          dueDate:
            body.dueDate === undefined
              ? undefined
              : body.dueDate === null
                ? null
                : new Date(body.dueDate),
        }),
      )
    },

    async deleteMilestone(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      milestoneId: string,
    ) {
      await service.deleteMilestone(access, organizationId, innovationId, milestoneId)
    },

    async createEvidence(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      body: {
        type: EvidenceRow['type']
        title: string
        url?: string
        mediaAssetId?: string
        note?: string
      },
    ) {
      return serializeEvidence(
        await service.createEvidence(access, organizationId, innovationId, body),
      )
    },

    async listEvidence(access: AccessContext, organizationId: string, innovationId: string) {
      const rows = await service.listEvidence(access, organizationId, innovationId)
      return rows.map(serializeEvidence)
    },

    async deleteEvidence(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      evidenceId: string,
    ) {
      await service.deleteEvidence(access, organizationId, innovationId, evidenceId)
    },

    async createMetric(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      body: {
        name: string
        metricType: MetricRow['metricType']
        unit?: string
        targetValue?: string
      },
    ) {
      return serializeMetric(await service.createMetric(access, organizationId, innovationId, body))
    },

    async listMetrics(access: AccessContext, organizationId: string, innovationId: string) {
      const rows = await service.listMetrics(access, organizationId, innovationId)
      return rows.map(serializeMetric)
    },

    async updateMetric(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      metricId: string,
      body: { name?: string; unit?: string; targetValue?: string | null },
    ) {
      return serializeMetric(
        await service.updateMetric(access, organizationId, innovationId, metricId, body),
      )
    },

    async addMeasurement(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      metricId: string,
      body: { value: string; measuredAt: string; note?: string },
    ) {
      return serializeMeasurement(
        await service.addMeasurement(access, organizationId, innovationId, metricId, {
          ...body,
          measuredAt: new Date(body.measuredAt),
        }),
      )
    },

    async listMeasurements(
      access: AccessContext,
      organizationId: string,
      innovationId: string,
      metricId: string,
      query: { limit?: number; cursor?: string },
    ) {
      return serializeMeasurementPage(
        await service.listMeasurements(access, organizationId, innovationId, metricId, query),
      )
    },
  }
}

export type InnovationPortfolioController = ReturnType<typeof createInnovationPortfolioController>
