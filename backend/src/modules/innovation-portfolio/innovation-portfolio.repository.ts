import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type InnovationStage =
  | 'DISCOVERY'
  | 'VALIDATION'
  | 'PROTOTYPE'
  | 'PILOT'
  | 'INCUBATION'
  | 'SCALE'
  | 'PAUSED'
  | 'CLOSED'

export type InnovationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type InnovationMilestoneStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'AT_RISK'
  | 'CANCELLED'
export type InnovationEvidenceType = 'LINK' | 'MEDIA_ASSET' | 'NOTE'
export type InnovationMetricType = 'NUMBER' | 'PERCENTAGE' | 'CURRENCY'

export interface InnovationRow {
  id: string
  organizationId: string
  sourceChallengeId: string | null
  sourceSubmissionId: string | null
  title: string
  opportunityStatement: string | null
  thesis: string | null
  ownerUserId: string | null
  ownerTeamName: string | null
  strategicThemes: string[]
  expectedImpact: string | null
  riskLevel: InnovationRiskLevel | null
  beneficiaries: string | null
  stage: InnovationStage
  resourceNotes: string | null
  nextReviewDate: Date | null
  publicVisible: boolean
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}

export interface InnovationFields {
  title: string
  opportunityStatement?: string
  thesis?: string
  ownerUserId?: string
  ownerTeamName?: string
  strategicThemes?: string[]
  expectedImpact?: string
  riskLevel?: InnovationRiskLevel
  beneficiaries?: string
  resourceNotes?: string
  nextReviewDate?: Date
  publicVisible?: boolean
}

export interface CreateInnovationInput extends InnovationFields {
  id: string
  organizationId: string
  sourceChallengeId?: string
  sourceSubmissionId?: string
  createdByUserId: string
}

export interface StageHistoryRow {
  id: string
  organizationId: string
  innovationId: string
  previousStage: InnovationStage | null
  newStage: InnovationStage
  decision: string
  decisionMakerUserId: string
  evidenceRefs: string[]
  notes: string | null
  nextReviewDate: Date | null
  createdAt: Date
}

export interface MilestoneRow {
  id: string
  organizationId: string
  innovationId: string
  title: string
  description: string | null
  status: InnovationMilestoneStatus
  dueDate: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface EvidenceRow {
  id: string
  organizationId: string
  innovationId: string
  type: InnovationEvidenceType
  title: string
  url: string | null
  mediaAssetId: string | null
  note: string | null
  addedByUserId: string
  createdAt: Date
}

export interface MetricRow {
  id: string
  organizationId: string
  innovationId: string
  name: string
  metricType: InnovationMetricType
  unit: string | null
  targetValue: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MeasurementRow {
  id: string
  organizationId: string
  metricId: string
  value: string
  measuredAt: Date
  note: string | null
  recordedByUserId: string
  createdAt: Date
}

export interface InnovationPortfolioRepository {
  create(tx: PrismaTransactionClient, input: CreateInnovationInput): Promise<InnovationRow>
  findById(
    tx: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<InnovationRow | null>
  findBySourceSubmission(
    tx: PrismaTransactionClient,
    organizationId: string,
    submissionId: string,
  ): Promise<InnovationRow | null>
  list(
    tx: PrismaTransactionClient,
    organizationId: string,
    filters: { stage?: InnovationStage },
    page: PageRequest,
  ): Promise<Page<InnovationRow>>
  update(
    tx: PrismaTransactionClient,
    id: string,
    patch: Partial<InnovationFields>,
  ): Promise<InnovationRow>
  setStage(tx: PrismaTransactionClient, id: string, stage: InnovationStage): Promise<InnovationRow>

  addStageHistory(
    tx: PrismaTransactionClient,
    input: Omit<StageHistoryRow, 'createdAt'>,
  ): Promise<StageHistoryRow>
  listStageHistory(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
  ): Promise<StageHistoryRow[]>

  createMilestone(
    tx: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      innovationId: string
      title: string
      description?: string
      status?: InnovationMilestoneStatus
      dueDate?: Date
    },
  ): Promise<MilestoneRow>
  listMilestones(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
  ): Promise<MilestoneRow[]>
  findMilestone(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
    milestoneId: string,
  ): Promise<MilestoneRow | null>
  updateMilestone(
    tx: PrismaTransactionClient,
    milestoneId: string,
    patch: {
      title?: string
      description?: string
      status?: InnovationMilestoneStatus
      dueDate?: Date | null
      completedAt?: Date | null
    },
  ): Promise<MilestoneRow>
  deleteMilestone(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
    milestoneId: string,
  ): Promise<void>

  createEvidence(
    tx: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      innovationId: string
      type: InnovationEvidenceType
      title: string
      url?: string
      mediaAssetId?: string
      note?: string
      addedByUserId: string
    },
  ): Promise<EvidenceRow>
  listEvidence(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
  ): Promise<EvidenceRow[]>
  findEvidence(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
    evidenceId: string,
  ): Promise<EvidenceRow | null>
  deleteEvidence(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
    evidenceId: string,
  ): Promise<void>

  createMetric(
    tx: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      innovationId: string
      name: string
      metricType: InnovationMetricType
      unit?: string
      targetValue?: string
    },
  ): Promise<MetricRow>
  listMetrics(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
  ): Promise<MetricRow[]>
  findMetric(
    tx: PrismaTransactionClient,
    organizationId: string,
    innovationId: string,
    metricId: string,
  ): Promise<MetricRow | null>
  updateMetric(
    tx: PrismaTransactionClient,
    metricId: string,
    patch: { name?: string; unit?: string; targetValue?: string | null },
  ): Promise<MetricRow>
  addMeasurement(
    tx: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      metricId: string
      value: string
      measuredAt: Date
      note?: string
      recordedByUserId: string
    },
  ): Promise<MeasurementRow>
  listMeasurements(
    tx: PrismaTransactionClient,
    organizationId: string,
    metricId: string,
    page: PageRequest,
  ): Promise<Page<MeasurementRow>>
}

function toMetricRow(row: {
  id: string
  organizationId: string
  innovationId: string
  name: string
  metricType: string
  unit: string | null
  targetValue: unknown
  createdAt: Date
  updatedAt: Date
}): MetricRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    innovationId: row.innovationId,
    name: row.name,
    metricType: row.metricType as InnovationMetricType,
    unit: row.unit,
    targetValue: row.targetValue === null ? null : String(row.targetValue),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toMeasurementRow(row: {
  id: string
  organizationId: string
  metricId: string
  value: unknown
  measuredAt: Date
  note: string | null
  recordedByUserId: string
  createdAt: Date
}): MeasurementRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    metricId: row.metricId,
    value: String(row.value),
    measuredAt: row.measuredAt,
    note: row.note,
    recordedByUserId: row.recordedByUserId,
    createdAt: row.createdAt,
  }
}

export function createInnovationPortfolioRepository(): InnovationPortfolioRepository {
  return {
    async create(tx, input) {
      return tx.innovation.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          sourceChallengeId: input.sourceChallengeId,
          sourceSubmissionId: input.sourceSubmissionId,
          title: input.title,
          opportunityStatement: input.opportunityStatement,
          thesis: input.thesis,
          ownerUserId: input.ownerUserId,
          ownerTeamName: input.ownerTeamName,
          strategicThemes: input.strategicThemes ?? [],
          expectedImpact: input.expectedImpact,
          riskLevel: input.riskLevel,
          beneficiaries: input.beneficiaries,
          resourceNotes: input.resourceNotes,
          nextReviewDate: input.nextReviewDate,
          publicVisible: input.publicVisible ?? false,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findById(tx, organizationId, id) {
      return tx.innovation.findFirst({ where: { id, organizationId } })
    },

    async findBySourceSubmission(tx, organizationId, submissionId) {
      return tx.innovation.findFirst({
        where: { organizationId, sourceSubmissionId: submissionId },
      })
    },

    async list(tx, organizationId, filters, page) {
      const rows = await tx.innovation.findMany({
        where: {
          organizationId,
          ...(filters.stage ? { stage: filters.stage } : {}),
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

    async update(tx, id, patch) {
      return tx.innovation.update({ where: { id }, data: patch })
    },

    async setStage(tx, id, stage) {
      return tx.innovation.update({ where: { id }, data: { stage } })
    },

    async addStageHistory(tx, input) {
      return tx.innovationStageHistoryEntry.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          innovationId: input.innovationId,
          previousStage: input.previousStage,
          newStage: input.newStage,
          decision: input.decision,
          decisionMakerUserId: input.decisionMakerUserId,
          evidenceRefs: input.evidenceRefs,
          notes: input.notes,
          nextReviewDate: input.nextReviewDate,
        },
      })
    },

    async listStageHistory(tx, organizationId, innovationId) {
      return tx.innovationStageHistoryEntry.findMany({
        where: { organizationId, innovationId },
        orderBy: { createdAt: 'desc' },
      })
    },

    async createMilestone(tx, input) {
      return tx.innovationMilestone.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          innovationId: input.innovationId,
          title: input.title,
          description: input.description,
          status: input.status ?? 'PLANNED',
          dueDate: input.dueDate,
        },
      })
    },

    async listMilestones(tx, organizationId, innovationId) {
      return tx.innovationMilestone.findMany({
        where: { organizationId, innovationId },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      })
    },

    async findMilestone(tx, organizationId, innovationId, milestoneId) {
      return tx.innovationMilestone.findFirst({
        where: { id: milestoneId, organizationId, innovationId },
      })
    },

    async updateMilestone(tx, milestoneId, patch) {
      return tx.innovationMilestone.update({ where: { id: milestoneId }, data: patch })
    },

    async deleteMilestone(tx, organizationId, innovationId, milestoneId) {
      await tx.innovationMilestone.deleteMany({
        where: { id: milestoneId, organizationId, innovationId },
      })
    },

    async createEvidence(tx, input) {
      return tx.innovationEvidence.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          innovationId: input.innovationId,
          type: input.type,
          title: input.title,
          url: input.url,
          mediaAssetId: input.mediaAssetId,
          note: input.note,
          addedByUserId: input.addedByUserId,
        },
      })
    },

    async listEvidence(tx, organizationId, innovationId) {
      return tx.innovationEvidence.findMany({
        where: { organizationId, innovationId },
        orderBy: { createdAt: 'desc' },
      })
    },

    async findEvidence(tx, organizationId, innovationId, evidenceId) {
      return tx.innovationEvidence.findFirst({
        where: { id: evidenceId, organizationId, innovationId },
      })
    },

    async deleteEvidence(tx, organizationId, innovationId, evidenceId) {
      await tx.innovationEvidence.deleteMany({
        where: { id: evidenceId, organizationId, innovationId },
      })
    },

    async createMetric(tx, input) {
      const row = await tx.innovationMetric.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          innovationId: input.innovationId,
          name: input.name,
          metricType: input.metricType,
          unit: input.unit,
          targetValue: input.targetValue,
        },
      })
      return toMetricRow(row)
    },

    async listMetrics(tx, organizationId, innovationId) {
      const rows = await tx.innovationMetric.findMany({
        where: { organizationId, innovationId },
        orderBy: { createdAt: 'asc' },
      })
      return rows.map(toMetricRow)
    },

    async findMetric(tx, organizationId, innovationId, metricId) {
      const row = await tx.innovationMetric.findFirst({
        where: { id: metricId, organizationId, innovationId },
      })
      return row === null ? null : toMetricRow(row)
    },

    async updateMetric(tx, metricId, patch) {
      const row = await tx.innovationMetric.update({ where: { id: metricId }, data: patch })
      return toMetricRow(row)
    },

    async addMeasurement(tx, input) {
      const row = await tx.innovationMetricMeasurement.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          metricId: input.metricId,
          value: input.value,
          measuredAt: input.measuredAt,
          note: input.note,
          recordedByUserId: input.recordedByUserId,
        },
      })
      return toMeasurementRow(row)
    },

    async listMeasurements(tx, organizationId, metricId, page) {
      const rows = await tx.innovationMetricMeasurement.findMany({
        where: {
          organizationId,
          metricId,
          ...(page.cursor
            ? {
                OR: [
                  { measuredAt: { lt: new Date(page.cursor.at) } },
                  { measuredAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ measuredAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows.map(toMeasurementRow), page, (row) => ({
        at: row.measuredAt.toISOString(),
        id: row.id,
      }))
    },
  }
}
