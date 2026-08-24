import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import { badRequest } from '../../shared/errors'
import type { IdempotencyStore } from '../../shared/idempotency'
import type {
  ChallengeStaffRole,
  CriterionScore,
  JudgeAssignmentRow,
  RubricCriterion,
  RubricRow,
  RubricVersionRow,
  ScorecardRow,
  StaffAssignmentRow,
  StaffInvitationRow,
  SubmissionResultRow,
} from './judging.repository'
import type { FeedbackEntry, JudgingProgress, JudgingService } from './judging.service'

function serializeInvitation(row: StaffInvitationRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    role: row.role,
    email: row.email,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeStaff(row: StaffAssignmentRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeRubric(row: RubricRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeRubricVersion(row: RubricVersionRow) {
  return {
    id: row.id,
    rubricId: row.rubricId,
    version: row.version,
    criteria: row.criteria,
    tieBreakPolicy: row.tieBreakPolicy,
    judgeCommentRules: row.judgeCommentRules,
    isActive: row.isActive,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeJudgeAssignment(row: JudgeAssignmentRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    organizationId: row.organizationId,
    staffAssignmentId: row.staffAssignmentId,
    submissionId: row.submissionId,
    status: row.status,
    scorecardId: row.scorecard?.id ?? null,
    scorecardStatus: row.scorecard?.status ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeScorecard(row: ScorecardRow) {
  return {
    id: row.id,
    judgeAssignmentId: row.judgeAssignmentId,
    rubricVersionId: row.rubricVersionId,
    status: row.status,
    criterionScores: row.criterionScores,
    totalScore: row.totalScore,
    maxPossibleScore: row.maxPossibleScore,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeResult(row: SubmissionResultRow) {
  return {
    id: row.id,
    snapshotId: row.snapshotId,
    challengeId: row.challengeId,
    submissionId: row.submissionId,
    submissionVersionId: row.submissionVersionId,
    trackId: row.trackId,
    selectionType: row.selectionType,
    rankLabel: row.rankLabel,
    rank: row.rank,
    aggregateScore: row.aggregateScore,
    tieBreakDecision: row.tieBreakDecision,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createJudgingController(service: JudgingService, idempotency: IdempotencyStore) {
  return {
    async createStaffInvitation(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: { role: ChallengeStaffRole; email?: string },
    ) {
      requireActor(access)
      const row = await service.createStaffInvitation(access, organizationId, challengeId, input)
      return serializeInvitation(row)
    },
    async listStaffInvitations(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.listStaffInvitations(access, organizationId, challengeId)
      return rows.map(serializeInvitation)
    },
    async revokeStaffInvitation(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      invitationId: string,
    ) {
      requireActor(access)
      await service.revokeStaffInvitation(access, organizationId, challengeId, invitationId)
    },
    async acceptStaffInvitation(access: AccessContext, token: string) {
      requireActor(access)
      const row = await service.acceptStaffInvitation(access, token)
      return serializeStaff(row)
    },
    async declineStaffInvitation(access: AccessContext, token: string) {
      requireActor(access)
      await service.declineStaffInvitation(access, token)
    },

    async listStaff(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.listStaff(access, organizationId, challengeId)
      return rows.map(serializeStaff)
    },
    async removeStaff(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      staffAssignmentId: string,
    ) {
      requireActor(access)
      await service.removeStaff(access, organizationId, challengeId, staffAssignmentId)
    },

    async createRubric(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      name: string,
    ) {
      requireActor(access)
      const row = await service.createRubric(access, organizationId, challengeId, name)
      return serializeRubric(row)
    },
    async listRubrics(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.listRubrics(access, organizationId, challengeId)
      return rows.map(serializeRubric)
    },
    async getRubric(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      rubricId: string,
    ) {
      requireActor(access)
      const row = await service.getRubric(access, organizationId, challengeId, rubricId)
      return serializeRubric(row)
    },
    async createRubricVersion(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      rubricId: string,
      input: { criteria: RubricCriterion[]; tieBreakPolicy?: string; judgeCommentRules?: string },
    ) {
      requireActor(access)
      const row = await service.createRubricVersion(
        access,
        organizationId,
        challengeId,
        rubricId,
        input,
      )
      return serializeRubricVersion(row)
    },
    async listRubricVersions(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      rubricId: string,
    ) {
      requireActor(access)
      const rows = await service.listRubricVersions(access, organizationId, challengeId, rubricId)
      return rows.map(serializeRubricVersion)
    },
    async getRubricVersion(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      rubricId: string,
      versionId: string,
    ) {
      requireActor(access)
      const row = await service.getRubricVersion(
        access,
        organizationId,
        challengeId,
        rubricId,
        versionId,
      )
      return serializeRubricVersion(row)
    },
    async activateRubricVersion(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      rubricId: string,
      versionId: string,
    ) {
      requireActor(access)
      const row = await service.activateRubricVersion(
        access,
        organizationId,
        challengeId,
        rubricId,
        versionId,
      )
      return serializeRubricVersion(row)
    },

    async createJudgeAssignment(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: { staffAssignmentId: string; submissionId: string },
    ) {
      requireActor(access)
      const row = await service.createJudgeAssignment(access, organizationId, challengeId, input)
      return serializeJudgeAssignment(row)
    },
    async autoBalance(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.autoBalance(access, organizationId, challengeId)
      return rows.map(serializeJudgeAssignment)
    },
    async reassignJudgeAssignment(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      assignmentId: string,
      input: { newStaffAssignmentId: string; reason: string },
    ) {
      requireActor(access)
      const row = await service.reassignJudgeAssignment(
        access,
        organizationId,
        challengeId,
        assignmentId,
        input,
      )
      return serializeJudgeAssignment(row)
    },
    async deleteJudgeAssignment(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      assignmentId: string,
    ) {
      requireActor(access)
      await service.deleteJudgeAssignment(access, organizationId, challengeId, assignmentId)
    },
    async listJudgeAssignmentsForChallenge(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
    ) {
      requireActor(access)
      const rows = await service.listJudgeAssignmentsForChallenge(
        access,
        organizationId,
        challengeId,
      )
      return rows.map(serializeJudgeAssignment)
    },

    async listMyAssignments(access: AccessContext) {
      requireActor(access)
      const rows = await service.listMyAssignments(access)
      return rows.map(serializeJudgeAssignment)
    },
    async getMyAssignment(access: AccessContext, assignmentId: string) {
      requireActor(access)
      const row = await service.getMyAssignment(access, assignmentId)
      return serializeJudgeAssignment(row)
    },
    async declareConflict(access: AccessContext, assignmentId: string) {
      requireActor(access)
      const row = await service.declareConflict(access, assignmentId)
      return serializeJudgeAssignment(row)
    },
    async recuse(access: AccessContext, assignmentId: string) {
      requireActor(access)
      const row = await service.recuse(access, assignmentId)
      return serializeJudgeAssignment(row)
    },

    async getMyScorecard(access: AccessContext, assignmentId: string) {
      requireActor(access)
      const row = await service.getMyScorecard(access, assignmentId)
      return serializeScorecard(row)
    },
    async saveScorecardDraft(
      access: AccessContext,
      assignmentId: string,
      criterionScores: CriterionScore[],
    ) {
      requireActor(access)
      const row = await service.saveScorecardDraft(access, assignmentId, criterionScores)
      return serializeScorecard(row)
    },
    async submitScorecard(
      access: AccessContext,
      assignmentId: string,
      criterionScores: CriterionScore[],
    ) {
      requireActor(access)
      const row = await service.submitScorecard(access, assignmentId, criterionScores)
      return serializeScorecard(row)
    },

    async reopenScorecard(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      scorecardId: string,
      reason: string,
    ) {
      requireActor(access)
      await service.reopenScorecard(access, organizationId, challengeId, scorecardId, reason)
    },
    async getProgress(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
    ): Promise<JudgingProgress> {
      requireActor(access)
      return service.getProgress(access, organizationId, challengeId)
    },
    async finalizeJudging(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      await service.finalizeJudging(access, organizationId, challengeId)
    },

    async getResults(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const rows = await service.getResults(access, organizationId, challengeId)
      return rows.map(serializeResult)
    },
    async finalizeResults(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      selections: Parameters<JudgingService['finalizeResults']>[3],
    ) {
      requireActor(access)
      const rows = await service.finalizeResults(access, organizationId, challengeId, selections)
      return rows.map(serializeResult)
    },
    async publishResults(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      idempotencyKey: string | undefined,
    ) {
      const { actor } = requireActor(access)
      if (idempotencyKey === undefined) {
        throw badRequest('An Idempotency-Key header is required for this operation.')
      }
      await idempotency.run(
        {
          actorUserId: actor.userId,
          operation: 'challenge.results.publish',
          key: idempotencyKey,
          requestBody: { organizationId, challengeId },
          organizationId,
        },
        async (tx) => {
          await service.publishResults(access, organizationId, challengeId, tx)
          return { status: 204, body: {} }
        },
      )
    },
    async retractResults(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      reason: string,
    ) {
      requireActor(access)
      await service.retractResults(access, organizationId, challengeId, reason)
    },

    async releaseFeedback(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      await service.releaseFeedback(access, organizationId, challengeId)
    },
    async getFeedbackForSubmission(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      submissionId: string,
    ): Promise<FeedbackEntry[]> {
      requireActor(access)
      return service.getFeedbackForSubmission(access, organizationId, challengeId, submissionId)
    },
  }
}

export type JudgingController = ReturnType<typeof createJudgingController>
