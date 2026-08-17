import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { InnovationPortfolioController } from './innovation-portfolio.controller'
import {
  AddMeasurementBody,
  CreateEvidenceBody,
  CreateInnovationBody,
  CreateMetricBody,
  CreateMilestoneBody,
  EvidenceListResponse,
  EvidenceResponse,
  InnovationListQuery,
  InnovationListResponse,
  InnovationResponse,
  MeasurementListResponse,
  MeasurementResponse,
  MetricListResponse,
  MetricResponse,
  MilestoneListResponse,
  MilestoneResponse,
  PromoteToInnovationBody,
  StageHistoryListResponse,
  TransitionStageBody,
  UpdateInnovationBody,
  UpdateMetricBody,
  UpdateMilestoneBody,
} from './innovation-portfolio.dto'

const OrgParams = t.Object({ organizationId: Uuid })
const InnovationParams = t.Object({ organizationId: Uuid, innovationId: Uuid })

export function innovationPortfolioRoutes(
  controller: InnovationPortfolioController,
  auth: AuthPlugin,
) {
  return (
    new Elysia({ name: 'innovation-portfolio-routes' })
      .use(auth)
      // --- Core -----------------------------------------------------------
      .post(
        '/organizations/:organizationId/innovations',
        async ({ access, params, body, set }) => {
          const result = await controller.create(access, params.organizationId, body)
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: OrgParams,
          body: CreateInnovationBody,
          response: { 201: InnovationResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Create an innovation item directly' },
        },
      )
      .get(
        '/organizations/:organizationId/innovations',
        ({ access, params, query }) => controller.list(access, params.organizationId, query),
        {
          requireAuth: true,
          orgContext: true,
          params: OrgParams,
          query: InnovationListQuery,
          response: { 200: InnovationListResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'List innovation items' },
        },
      )
      .get(
        '/organizations/:organizationId/innovations/:innovationId',
        ({ access, params }) => controller.get(access, params.organizationId, params.innovationId),
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          response: { 200: InnovationResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Get an innovation item' },
        },
      )
      .patch(
        '/organizations/:organizationId/innovations/:innovationId',
        ({ access, params, body }) =>
          controller.update(access, params.organizationId, params.innovationId, body),
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          body: UpdateInnovationBody,
          response: { 200: InnovationResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Update an innovation item' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/promote-to-innovation',
        async ({ access, params, body, set }) => {
          const result = await controller.promoteFromSubmission(
            access,
            params.organizationId,
            params.challengeId,
            params.submissionId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
          body: PromoteToInnovationBody,
          response: { 201: InnovationResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Innovation Portfolio'],
            summary: 'Promote a finalized submission into the innovation portfolio',
            description: 'One promotion per submission by default; a second attempt is a 409.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/innovations/:innovationId/transition-stage',
        ({ access, params, body }) =>
          controller.transitionStage(access, params.organizationId, params.innovationId, body),
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          body: TransitionStageBody,
          response: { 200: InnovationResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Innovation Portfolio'],
            summary: 'Transition an innovation to a different stage',
            description: 'The only way to change stage; records a stage-history entry.',
          },
        },
      )
      .get(
        '/organizations/:organizationId/innovations/:innovationId/stage-history',
        ({ access, params }) =>
          controller.listStageHistory(access, params.organizationId, params.innovationId),
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          response: { 200: StageHistoryListResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'List stage-transition history' },
        },
      )
      // --- Milestones -------------------------------------------------------
      .post(
        '/organizations/:organizationId/innovations/:innovationId/milestones',
        async ({ access, params, body, set }) => {
          const result = await controller.createMilestone(
            access,
            params.organizationId,
            params.innovationId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          body: CreateMilestoneBody,
          response: { 201: MilestoneResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Add a milestone' },
        },
      )
      .get(
        '/organizations/:organizationId/innovations/:innovationId/milestones',
        ({ access, params }) =>
          controller.listMilestones(access, params.organizationId, params.innovationId),
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          response: { 200: MilestoneListResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'List milestones' },
        },
      )
      .patch(
        '/organizations/:organizationId/innovations/:innovationId/milestones/:milestoneId',
        ({ access, params, body }) =>
          controller.updateMilestone(
            access,
            params.organizationId,
            params.innovationId,
            params.milestoneId,
            body,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, innovationId: Uuid, milestoneId: Uuid }),
          body: UpdateMilestoneBody,
          response: { 200: MilestoneResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Update a milestone' },
        },
      )
      .delete(
        '/organizations/:organizationId/innovations/:innovationId/milestones/:milestoneId',
        async ({ access, params, set }) => {
          await controller.deleteMilestone(
            access,
            params.organizationId,
            params.innovationId,
            params.milestoneId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, innovationId: Uuid, milestoneId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Delete a milestone' },
        },
      )
      // --- Evidence -----------------------------------------------------------
      .post(
        '/organizations/:organizationId/innovations/:innovationId/evidence',
        async ({ access, params, body, set }) => {
          const result = await controller.createEvidence(
            access,
            params.organizationId,
            params.innovationId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          body: CreateEvidenceBody,
          response: { 201: EvidenceResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Attach evidence' },
        },
      )
      .get(
        '/organizations/:organizationId/innovations/:innovationId/evidence',
        ({ access, params }) =>
          controller.listEvidence(access, params.organizationId, params.innovationId),
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          response: { 200: EvidenceListResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'List evidence' },
        },
      )
      .delete(
        '/organizations/:organizationId/innovations/:innovationId/evidence/:evidenceId',
        async ({ access, params, set }) => {
          await controller.deleteEvidence(
            access,
            params.organizationId,
            params.innovationId,
            params.evidenceId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, innovationId: Uuid, evidenceId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Delete evidence' },
        },
      )
      // --- Metrics ------------------------------------------------------------
      .post(
        '/organizations/:organizationId/innovations/:innovationId/metrics',
        async ({ access, params, body, set }) => {
          const result = await controller.createMetric(
            access,
            params.organizationId,
            params.innovationId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          body: CreateMetricBody,
          response: { 201: MetricResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Define a metric' },
        },
      )
      .get(
        '/organizations/:organizationId/innovations/:innovationId/metrics',
        ({ access, params }) =>
          controller.listMetrics(access, params.organizationId, params.innovationId),
        {
          requireAuth: true,
          orgContext: true,
          params: InnovationParams,
          response: { 200: MetricListResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'List metric definitions' },
        },
      )
      .patch(
        '/organizations/:organizationId/innovations/:innovationId/metrics/:metricId',
        ({ access, params, body }) =>
          controller.updateMetric(
            access,
            params.organizationId,
            params.innovationId,
            params.metricId,
            body,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, innovationId: Uuid, metricId: Uuid }),
          body: UpdateMetricBody,
          response: { 200: MetricResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Update a metric definition' },
        },
      )
      .post(
        '/organizations/:organizationId/innovations/:innovationId/metrics/:metricId/measurements',
        async ({ access, params, body, set }) => {
          const result = await controller.addMeasurement(
            access,
            params.organizationId,
            params.innovationId,
            params.metricId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, innovationId: Uuid, metricId: Uuid }),
          body: AddMeasurementBody,
          response: { 201: MeasurementResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'Record a metric measurement' },
        },
      )
      .get(
        '/organizations/:organizationId/innovations/:innovationId/metrics/:metricId/measurements',
        ({ access, params, query }) =>
          controller.listMeasurements(
            access,
            params.organizationId,
            params.innovationId,
            params.metricId,
            query,
          ),
        {
          requireAuth: true,
          orgContext: true,
          params: t.Object({ organizationId: Uuid, innovationId: Uuid, metricId: Uuid }),
          query: t.Object({
            limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
            cursor: t.Optional(t.String({ maxLength: 512 })),
          }),
          response: { 200: MeasurementListResponse, ...CommonErrorResponses },
          detail: { tags: ['Innovation Portfolio'], summary: 'List metric measurements' },
        },
      )
  )
}
