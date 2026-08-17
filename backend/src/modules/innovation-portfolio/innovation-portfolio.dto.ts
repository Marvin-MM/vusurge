import { t } from 'elysia'
import { MarkdownText, PageOf, Uuid } from '../../shared/http'

export const InnovationStage = t.Union([
  t.Literal('DISCOVERY'),
  t.Literal('VALIDATION'),
  t.Literal('PROTOTYPE'),
  t.Literal('PILOT'),
  t.Literal('INCUBATION'),
  t.Literal('SCALE'),
  t.Literal('PAUSED'),
  t.Literal('CLOSED'),
])

export const InnovationRiskLevel = t.Union([
  t.Literal('LOW'),
  t.Literal('MEDIUM'),
  t.Literal('HIGH'),
])

export const InnovationMilestoneStatus = t.Union([
  t.Literal('PLANNED'),
  t.Literal('IN_PROGRESS'),
  t.Literal('COMPLETED'),
  t.Literal('AT_RISK'),
  t.Literal('CANCELLED'),
])

export const InnovationEvidenceType = t.Union([
  t.Literal('LINK'),
  t.Literal('MEDIA_ASSET'),
  t.Literal('NOTE'),
])

export const InnovationMetricType = t.Union([
  t.Literal('NUMBER'),
  t.Literal('PERCENTAGE'),
  t.Literal('CURRENCY'),
])

const InnovationFieldsBody = {
  title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  opportunityStatement: t.Optional(MarkdownText(4000)),
  thesis: t.Optional(MarkdownText(4000)),
  ownerUserId: t.Optional(Uuid),
  ownerTeamName: t.Optional(t.String({ maxLength: 200 })),
  strategicThemes: t.Optional(t.Array(t.String({ maxLength: 80 }), { maxItems: 20 })),
  expectedImpact: t.Optional(MarkdownText(2000)),
  riskLevel: t.Optional(InnovationRiskLevel),
  beneficiaries: t.Optional(t.String({ maxLength: 2000 })),
  resourceNotes: t.Optional(MarkdownText(2000)),
  nextReviewDate: t.Optional(t.String({ format: 'date' })),
  publicVisible: t.Optional(t.Boolean()),
}

export const CreateInnovationBody = t.Object({
  ...InnovationFieldsBody,
  title: t.String({ minLength: 1, maxLength: 200 }),
})

export const PromoteToInnovationBody = t.Object(InnovationFieldsBody)

export const UpdateInnovationBody = t.Object(InnovationFieldsBody)

export const TransitionStageBody = t.Object({
  newStage: InnovationStage,
  decision: t.String({ minLength: 10, maxLength: 2000 }),
  evidenceRefs: t.Optional(t.Array(t.String({ maxLength: 200 }), { maxItems: 50 })),
  notes: t.Optional(t.String({ maxLength: 2000 })),
  nextReviewDate: t.Optional(t.String({ format: 'date' })),
})

export const InnovationListQuery = t.Object({
  stage: t.Optional(InnovationStage),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
  cursor: t.Optional(t.String({ maxLength: 512 })),
})

export const InnovationResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  sourceChallengeId: t.Union([Uuid, t.Null()]),
  sourceSubmissionId: t.Union([Uuid, t.Null()]),
  title: t.String(),
  opportunityStatement: t.Union([t.String(), t.Null()]),
  thesis: t.Union([t.String(), t.Null()]),
  ownerUserId: t.Union([Uuid, t.Null()]),
  ownerTeamName: t.Union([t.String(), t.Null()]),
  strategicThemes: t.Array(t.String()),
  expectedImpact: t.Union([t.String(), t.Null()]),
  riskLevel: t.Union([InnovationRiskLevel, t.Null()]),
  beneficiaries: t.Union([t.String(), t.Null()]),
  stage: InnovationStage,
  resourceNotes: t.Union([t.String(), t.Null()]),
  nextReviewDate: t.Union([t.String(), t.Null()]),
  publicVisible: t.Boolean(),
  createdByUserId: Uuid,
  createdAt: t.String(),
  updatedAt: t.String(),
})

export const InnovationListResponse = PageOf(InnovationResponse)

export const StageHistoryResponse = t.Object({
  id: Uuid,
  innovationId: Uuid,
  previousStage: t.Union([InnovationStage, t.Null()]),
  newStage: InnovationStage,
  decision: t.String(),
  decisionMakerUserId: Uuid,
  evidenceRefs: t.Array(t.String()),
  notes: t.Union([t.String(), t.Null()]),
  nextReviewDate: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const StageHistoryListResponse = t.Array(StageHistoryResponse)

export const CreateMilestoneBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  status: t.Optional(InnovationMilestoneStatus),
  dueDate: t.Optional(t.String({ format: 'date' })),
})

export const UpdateMilestoneBody = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  description: t.Optional(t.String({ maxLength: 2000 })),
  status: t.Optional(InnovationMilestoneStatus),
  dueDate: t.Optional(t.Union([t.String({ format: 'date' }), t.Null()])),
})

export const MilestoneResponse = t.Object({
  id: Uuid,
  innovationId: Uuid,
  title: t.String(),
  description: t.Union([t.String(), t.Null()]),
  status: InnovationMilestoneStatus,
  dueDate: t.Union([t.String(), t.Null()]),
  completedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
})

export const MilestoneListResponse = t.Array(MilestoneResponse)

export const CreateEvidenceBody = t.Object({
  type: InnovationEvidenceType,
  title: t.String({ minLength: 1, maxLength: 200 }),
  url: t.Optional(t.String({ format: 'uri', maxLength: 2048 })),
  mediaAssetId: t.Optional(Uuid),
  note: t.Optional(t.String({ maxLength: 2000 })),
})

export const EvidenceResponse = t.Object({
  id: Uuid,
  innovationId: Uuid,
  type: InnovationEvidenceType,
  title: t.String(),
  url: t.Union([t.String(), t.Null()]),
  mediaAssetId: t.Union([Uuid, t.Null()]),
  note: t.Union([t.String(), t.Null()]),
  addedByUserId: Uuid,
  createdAt: t.String(),
})

export const EvidenceListResponse = t.Array(EvidenceResponse)

export const CreateMetricBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
  metricType: InnovationMetricType,
  unit: t.Optional(t.String({ maxLength: 40 })),
  targetValue: t.Optional(t.String({ maxLength: 40 })),
})

export const UpdateMetricBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  unit: t.Optional(t.String({ maxLength: 40 })),
  targetValue: t.Optional(t.Union([t.String({ maxLength: 40 }), t.Null()])),
})

export const MetricResponse = t.Object({
  id: Uuid,
  innovationId: Uuid,
  name: t.String(),
  metricType: InnovationMetricType,
  unit: t.Union([t.String(), t.Null()]),
  targetValue: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
})

export const MetricListResponse = t.Array(MetricResponse)

export const AddMeasurementBody = t.Object({
  value: t.String({ minLength: 1, maxLength: 40 }),
  measuredAt: t.String({ format: 'date-time' }),
  note: t.Optional(t.String({ maxLength: 1000 })),
})

export const MeasurementResponse = t.Object({
  id: Uuid,
  metricId: Uuid,
  value: t.String(),
  measuredAt: t.String(),
  note: t.Union([t.String(), t.Null()]),
  recordedByUserId: Uuid,
  createdAt: t.String(),
})

export const MeasurementListResponse = PageOf(MeasurementResponse)
