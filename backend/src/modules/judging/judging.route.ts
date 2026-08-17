import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, IdempotencyKey, Uuid } from '../../shared/http'
import type { JudgingController } from './judging.controller'
import {
  CreateJudgeAssignmentBody,
  CreateRubricBody,
  CreateRubricVersionBody,
  CreateStaffInvitationBody,
  FeedbackListResponse,
  FinalizeResultsBody,
  JudgeAssignmentListResponse,
  JudgeAssignmentResponse,
  JudgingProgressResponse,
  ReassignJudgeAssignmentBody,
  ReopenScorecardBody,
  RetractResultsBody,
  RubricListResponse,
  RubricResponse,
  RubricVersionListResponse,
  RubricVersionResponse,
  SaveScorecardBody,
  ScorecardResponse,
  StaffAssignmentListResponse,
  StaffAssignmentResponse,
  StaffInvitationListResponse,
  StaffInvitationResponse,
  SubmissionResultListResponse,
} from './judging.dto'

export function judgingRoutes(controller: JudgingController, auth: AuthPlugin) {
  return (
    new Elysia({ name: 'judging-routes' })
      .use(auth)
      // --- staff invitations (organizer) ------------------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/staff-invitations',
        async ({ access, params, body, set }) => {
          const result = await controller.createStaffInvitation(
            access,
            params.organizationId,
            params.challengeId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CreateStaffInvitationBody,
          response: { 201: StaffInvitationResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Invite a judge or mentor to a challenge' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/staff-invitations',
        ({ access, params }) =>
          controller.listStaffInvitations(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: StaffInvitationListResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'List challenge staff invitations' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/staff-invitations/:invitationId/revoke',
        async ({ access, params, set }) => {
          await controller.revokeStaffInvitation(
            access,
            params.organizationId,
            params.challengeId,
            params.invitationId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, invitationId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Revoke a staff invitation' },
        },
      )
      // --- staff invitations (recipient, flat) ------------------------------
      .post(
        '/challenge-staff-invitations/:token/accept',
        ({ access, params }) => controller.acceptStaffInvitation(access, params.token),
        {
          requireAuth: true,
          params: t.Object({ token: t.String({ minLength: 16, maxLength: 512 }) }),
          response: { 200: StaffAssignmentResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Accept a staff invitation by token' },
        },
      )
      .post(
        '/challenge-staff-invitations/:token/decline',
        async ({ access, params, set }) => {
          await controller.declineStaffInvitation(access, params.token)
          set.status = 204
        },
        {
          requireAuth: true,
          params: t.Object({ token: t.String({ minLength: 16, maxLength: 512 }) }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Decline a staff invitation by token' },
        },
      )
      // --- staff (organizer) -------------------------------------------------
      .get(
        '/organizations/:organizationId/challenges/:challengeId/staff',
        ({ access, params }) =>
          controller.listStaff(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: StaffAssignmentListResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'List challenge staff' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/staff/:staffAssignmentId/remove',
        async ({ access, params, set }) => {
          await controller.removeStaff(
            access,
            params.organizationId,
            params.challengeId,
            params.staffAssignmentId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, staffAssignmentId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Remove a challenge staff member' },
        },
      )
      // --- rubrics -------------------------------------------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/rubrics',
        async ({ access, params, body, set }) => {
          const result = await controller.createRubric(
            access,
            params.organizationId,
            params.challengeId,
            body.name,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CreateRubricBody,
          response: { 201: RubricResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Create a rubric' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/rubrics',
        ({ access, params }) =>
          controller.listRubrics(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: RubricListResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'List rubrics' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId',
        ({ access, params }) =>
          controller.getRubric(access, params.organizationId, params.challengeId, params.rubricId),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, rubricId: Uuid }),
          response: { 200: RubricResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Get a rubric' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions',
        ({ access, params }) =>
          controller.listRubricVersions(
            access,
            params.organizationId,
            params.challengeId,
            params.rubricId,
          ),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, rubricId: Uuid }),
          response: { 200: RubricVersionListResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'List rubric versions' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions',
        async ({ access, params, body, set }) => {
          const result = await controller.createRubricVersion(
            access,
            params.organizationId,
            params.challengeId,
            params.rubricId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, rubricId: Uuid }),
          body: CreateRubricVersionBody,
          response: { 201: RubricVersionResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Judging'],
            summary: 'Create a new rubric version',
            description: 'Immutable once created; creating a version does not activate it.',
          },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions/:versionId',
        ({ access, params }) =>
          controller.getRubricVersion(
            access,
            params.organizationId,
            params.challengeId,
            params.rubricId,
            params.versionId,
          ),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({
            organizationId: Uuid,
            challengeId: Uuid,
            rubricId: Uuid,
            versionId: Uuid,
          }),
          response: { 200: RubricVersionResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Get a rubric version' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions/:versionId/activate',
        ({ access, params }) =>
          controller.activateRubricVersion(
            access,
            params.organizationId,
            params.challengeId,
            params.rubricId,
            params.versionId,
          ),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({
            organizationId: Uuid,
            challengeId: Uuid,
            rubricId: Uuid,
            versionId: Uuid,
          }),
          response: { 200: RubricVersionResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Activate a rubric version' },
        },
      )
      // --- judge assignments (organizer) --------------------------------------
      .get(
        '/organizations/:organizationId/challenges/:challengeId/judge-assignments',
        ({ access, params }) =>
          controller.listJudgeAssignmentsForChallenge(
            access,
            params.organizationId,
            params.challengeId,
          ),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: JudgeAssignmentListResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'List judge assignments' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/judge-assignments',
        async ({ access, params, body, set }) => {
          const result = await controller.createJudgeAssignment(
            access,
            params.organizationId,
            params.challengeId,
            body,
          )
          set.status = 201
          return result
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: CreateJudgeAssignmentBody,
          response: { 201: JudgeAssignmentResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Assign a judge to a submission' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/judge-assignments/auto-balance',
        ({ access, params }) =>
          controller.autoBalance(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: JudgeAssignmentListResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Judging'],
            summary: 'Auto-balance judge assignments',
            description: 'Deterministic least-loaded round robin only — no machine learning.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/judge-assignments/:assignmentId/reassign',
        ({ access, params, body }) =>
          controller.reassignJudgeAssignment(
            access,
            params.organizationId,
            params.challengeId,
            params.assignmentId,
            body,
          ),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, assignmentId: Uuid }),
          body: ReassignJudgeAssignmentBody,
          response: { 200: JudgeAssignmentResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Reassign a judge assignment' },
        },
      )
      .delete(
        '/organizations/:organizationId/challenges/:challengeId/judge-assignments/:assignmentId',
        async ({ access, params, set }) => {
          await controller.deleteJudgeAssignment(
            access,
            params.organizationId,
            params.challengeId,
            params.assignmentId,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, assignmentId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Remove a judge assignment' },
        },
      )
      // --- judge self-service (flat) -------------------------------------------
      .get('/judging/assignments', ({ access }) => controller.listMyAssignments(access), {
        requireAuth: true,
        response: { 200: JudgeAssignmentListResponse, ...CommonErrorResponses },
        detail: { tags: ['Judging'], summary: "List the caller's own judge assignments" },
      })
      .get(
        '/judging/assignments/:assignmentId',
        ({ access, params }) => controller.getMyAssignment(access, params.assignmentId),
        {
          requireAuth: true,
          params: t.Object({ assignmentId: Uuid }),
          response: { 200: JudgeAssignmentResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: "Get one of the caller's own judge assignments" },
        },
      )
      .post(
        '/judging/assignments/:assignmentId/declare-conflict',
        ({ access, params }) => controller.declareConflict(access, params.assignmentId),
        {
          requireAuth: true,
          params: t.Object({ assignmentId: Uuid }),
          response: { 200: JudgeAssignmentResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Declare a conflict of interest' },
        },
      )
      .post(
        '/judging/assignments/:assignmentId/recuse',
        ({ access, params }) => controller.recuse(access, params.assignmentId),
        {
          requireAuth: true,
          params: t.Object({ assignmentId: Uuid }),
          response: { 200: JudgeAssignmentResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Recuse from a judge assignment' },
        },
      )
      // --- scorecards (judge, flat) --------------------------------------------
      .get(
        '/judging/assignments/:assignmentId/scorecard',
        ({ access, params }) => controller.getMyScorecard(access, params.assignmentId),
        {
          requireAuth: true,
          params: t.Object({ assignmentId: Uuid }),
          response: { 200: ScorecardResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: "Get the caller's scorecard for an assignment" },
        },
      )
      .patch(
        '/judging/assignments/:assignmentId/scorecard',
        ({ access, params, body }) =>
          controller.saveScorecardDraft(access, params.assignmentId, body.criterionScores),
        {
          requireAuth: true,
          params: t.Object({ assignmentId: Uuid }),
          body: SaveScorecardBody,
          response: { 200: ScorecardResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Save a scorecard draft' },
        },
      )
      .post(
        '/judging/assignments/:assignmentId/scorecard/submit',
        ({ access, params, body }) =>
          controller.submitScorecard(access, params.assignmentId, body.criterionScores),
        {
          requireAuth: true,
          params: t.Object({ assignmentId: Uuid }),
          body: SaveScorecardBody,
          response: { 200: ScorecardResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Judging'],
            summary: 'Submit a scorecard',
            description:
              'Validates all required criteria and computes the weighted total server-side.',
          },
        },
      )
      // --- scorecards (organizer) + judging lifecycle ---------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/scorecards/:scorecardId/reopen',
        async ({ access, params, body, set }) => {
          await controller.reopenScorecard(
            access,
            params.organizationId,
            params.challengeId,
            params.scorecardId,
            body.reason,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid, scorecardId: Uuid }),
          body: ReopenScorecardBody,
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Reopen a locked/submitted scorecard' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/judging/progress',
        ({ access, params }) =>
          controller.getProgress(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: JudgingProgressResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Judging'],
            summary: 'View judging progress',
            description: 'Aggregate counts only — never relative live rank.',
          },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/judging/finalize',
        async ({ access, params, set }) => {
          await controller.finalizeJudging(access, params.organizationId, params.challengeId)
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: {
            tags: ['Judging'],
            summary: 'Finalize judging, locking every submitted scorecard',
          },
        },
      )
      // --- results ---------------------------------------------------------------
      .get(
        '/organizations/:organizationId/challenges/:challengeId/results',
        ({ access, params }) =>
          controller.getResults(access, params.organizationId, params.challengeId),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 200: SubmissionResultListResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'View results (organizer)' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/results/finalize',
        ({ access, params, body }) =>
          controller.finalizeResults(
            access,
            params.organizationId,
            params.challengeId,
            body.selections,
          ),
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: FinalizeResultsBody,
          response: { 200: SubmissionResultListResponse, ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Finalize results' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/results/publish',
        async ({ access, params, headers, set }) => {
          await controller.publishResults(
            access,
            params.organizationId,
            params.challengeId,
            headers['idempotency-key'],
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          headers: t.Object({ 'idempotency-key': IdempotencyKey }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Publish results' },
        },
      )
      .post(
        '/organizations/:organizationId/challenges/:challengeId/results/retract',
        async ({ access, params, body, set }) => {
          await controller.retractResults(
            access,
            params.organizationId,
            params.challengeId,
            body.reason,
          )
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          body: RetractResultsBody,
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: {
            tags: ['Judging'],
            summary: 'Retract published results',
            description:
              'High privilege: requires a fresh session, an explicit reason, and is fully audited.',
          },
        },
      )
      // --- feedback ----------------------------------------------------------
      .post(
        '/organizations/:organizationId/challenges/:challengeId/feedback/release',
        async ({ access, params, set }) => {
          await controller.releaseFeedback(access, params.organizationId, params.challengeId)
          set.status = 204
        },
        {
          requireAuth: true,
          orgContext: true,
          challengeContext: true,
          params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
          response: { 204: t.Void(), ...CommonErrorResponses },
          detail: { tags: ['Judging'], summary: 'Release judge feedback to participants' },
        },
      )
      .get(
        '/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/feedback',
        ({ access, params }) =>
          controller.getFeedbackForSubmission(
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
          response: { 200: FeedbackListResponse, ...CommonErrorResponses },
          detail: {
            tags: ['Judging'],
            summary: "Get the caller's own submission feedback",
            description: 'Only the owning team may view it, and only once released.',
          },
        },
      )
  )
}
