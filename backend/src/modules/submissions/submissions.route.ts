import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, IdempotencyKey, Uuid } from '../../shared/http'
import type { SubmissionsController } from './submissions.controller'
import {
  DisqualifySubmissionBody,
  ReinstateSubmissionBody,
  ReopenSubmissionBody,
  SaveDraftBody,
  SubmissionListQuery,
  SubmissionListResponse,
  SubmissionResponse,
  SubmissionSummaryResponse,
  SubmissionVersionListResponse,
  SubmissionVersionResponse,
} from './submissions.dto'

export function submissionsRoutes(controller: SubmissionsController, auth: AuthPlugin) {
  return new Elysia({ name: 'submissions-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId/challenges/:challengeId/submissions/me',
      ({ access, params }) => controller.getMine(access, params.organizationId, params.challengeId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        response: { 200: t.Union([SubmissionResponse, t.Null()]), ...CommonErrorResponses },
        detail: { tags: ['Submissions'], summary: "Get the caller's team's submission" },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/submissions',
      async ({ access, params, set }) => {
        const result = await controller.createMine(
          access,
          params.organizationId,
          params.challengeId,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        response: { 201: SubmissionResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Submissions'],
          summary: 'Start a submission',
          description:
            'Creates or joins the implicit solo team if the caller has none yet and the challenge allows it.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId',
      ({ access, params }) =>
        controller.get(access, params.organizationId, params.challengeId, params.submissionId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
        response: { 200: SubmissionResponse, ...CommonErrorResponses },
        detail: { tags: ['Submissions'], summary: 'Get a submission' },
      },
    )
    .patch(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/draft',
      ({ access, params, body }) =>
        controller.saveDraft(
          access,
          params.organizationId,
          params.challengeId,
          params.submissionId,
          body,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
        body: SaveDraftBody,
        response: { 200: SubmissionResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Submissions'],
          summary: 'Save a draft',
          description: 'Every save creates a new immutable version and moves the draft pointer.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/versions',
      ({ access, params }) =>
        controller.listVersions(
          access,
          params.organizationId,
          params.challengeId,
          params.submissionId,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
        response: { 200: SubmissionVersionListResponse, ...CommonErrorResponses },
        detail: { tags: ['Submissions'], summary: 'List submission versions' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/versions/:versionId',
      ({ access, params }) =>
        controller.getVersion(
          access,
          params.organizationId,
          params.challengeId,
          params.submissionId,
          params.versionId,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({
          organizationId: Uuid,
          challengeId: Uuid,
          submissionId: Uuid,
          versionId: Uuid,
        }),
        response: { 200: SubmissionVersionResponse, ...CommonErrorResponses },
        detail: { tags: ['Submissions'], summary: 'Get one submission version' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/finalize',
      async ({ access, params, headers, set }) => {
        const result = await controller.finalize(
          access,
          params.organizationId,
          params.challengeId,
          params.submissionId,
          headers['idempotency-key'],
        )
        set.status = 200
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
        headers: t.Object({ 'idempotency-key': IdempotencyKey }),
        response: { 200: SubmissionResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Submissions'],
          summary: 'Finalize a submission',
          description:
            'A single synchronous PostgreSQL transaction. Requires an Idempotency-Key header. ' +
            'Rejected once the database-authoritative deadline has passed, regardless of cached challenge status.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/submissions',
      ({ access, params, query }) =>
        controller.listForChallenge(
          access,
          params.organizationId,
          params.challengeId,
          query.status,
          query,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        query: SubmissionListQuery,
        response: { 200: SubmissionListResponse, ...CommonErrorResponses },
        detail: { tags: ['Submissions'], summary: 'List challenge submissions (organizer)' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/reopen',
      ({ access, params, body }) =>
        controller.reopen(
          access,
          params.organizationId,
          params.challengeId,
          params.submissionId,
          body.reason,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
        body: ReopenSubmissionBody,
        response: { 200: SubmissionSummaryResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Submissions'],
          summary: 'Reopen a finalized submission for editing (organizer)',
        },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/disqualify',
      ({ access, params, body }) =>
        controller.disqualify(
          access,
          params.organizationId,
          params.challengeId,
          params.submissionId,
          body.reason,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
        body: DisqualifySubmissionBody,
        response: { 200: SubmissionSummaryResponse, ...CommonErrorResponses },
        detail: { tags: ['Submissions'], summary: 'Disqualify a submission (organizer)' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/reinstate',
      ({ access, params, body }) =>
        controller.reinstate(
          access,
          params.organizationId,
          params.challengeId,
          params.submissionId,
          body.reason,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, submissionId: Uuid }),
        body: ReinstateSubmissionBody,
        response: { 200: SubmissionSummaryResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Submissions'],
          summary: 'Reinstate a disqualified submission (organizer)',
        },
      },
    )
}
