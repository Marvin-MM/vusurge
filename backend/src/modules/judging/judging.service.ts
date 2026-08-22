import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue/queue-names'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import { generateSecureToken, hashToken } from '../../shared/security'
import type { ChallengesRepository } from '../challenges/challenges.repository'
import type { SubmissionsRepository } from '../submissions/submissions.repository'
import type { TeamsRepository } from '../teams/teams.repository'
import type {
  ChallengeStaffRole,
  CriterionScore,
  JudgeAssignmentRow,
  JudgingRepository,
  RubricCriterion,
  RubricRow,
  RubricVersionRow,
  ScorecardRow,
  StaffAssignmentRow,
  StaffInvitationRow,
  SubmissionResultRow,
} from './judging.repository'

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Criteria/scoring validation
// ---------------------------------------------------------------------------

function validateCriteria(criteria: RubricCriterion[]): void {
  if (criteria.length === 0) {
    throw badRequest('A rubric version must define at least one criterion.')
  }
  const seenKeys = new Set<string>()
  for (const criterion of criteria) {
    if (seenKeys.has(criterion.key)) {
      throw badRequest(`Duplicate criterion key "${criterion.key}".`)
    }
    seenKeys.add(criterion.key)
    if (!Number.isInteger(criterion.minScore) || !Number.isInteger(criterion.maxScore)) {
      throw badRequest(`Criterion "${criterion.key}" must use integer min/max scores.`)
    }
    if (criterion.minScore >= criterion.maxScore) {
      throw badRequest(`Criterion "${criterion.key}" must have minScore < maxScore.`)
    }
    if (!Number.isInteger(criterion.weight) || criterion.weight <= 0) {
      throw badRequest(`Criterion "${criterion.key}" must have a positive integer weight.`)
    }
  }
}

/** Exact integer arithmetic throughout — no floating point in a scoring path. */
function computeWeightedTotal(
  criteria: RubricCriterion[],
  scores: CriterionScore[],
): { totalScore: number; maxPossibleScore: number } {
  validateCriterionScores(criteria, scores, true)
  const scoreByKey = new Map(scores.map((s) => [s.criterionKey, s.score]))
  let totalScore = 0
  let maxPossibleScore = 0
  for (const criterion of criteria) {
    const score = scoreByKey.get(criterion.key)
    if (score === undefined) {
      throw badRequest(`A score for criterion "${criterion.key}" is required.`)
    }
    if (!Number.isInteger(score) || score < criterion.minScore || score > criterion.maxScore) {
      throw badRequest(
        `Score for "${criterion.key}" must be an integer between ${criterion.minScore} and ${criterion.maxScore}.`,
      )
    }
    totalScore += score * criterion.weight
    maxPossibleScore += criterion.maxScore * criterion.weight
  }
  return { totalScore, maxPossibleScore }
}

function validateCriterionScores(
  criteria: RubricCriterion[],
  scores: CriterionScore[],
  requireAll: boolean,
): void {
  const criterionByKey = new Map(criteria.map((criterion) => [criterion.key, criterion]))
  const seen = new Set<string>()
  for (const score of scores) {
    if (seen.has(score.criterionKey)) {
      throw badRequest(`Duplicate score for criterion "${score.criterionKey}".`)
    }
    seen.add(score.criterionKey)
    const criterion = criterionByKey.get(score.criterionKey)
    if (criterion === undefined) {
      throw badRequest(`Criterion "${score.criterionKey}" is not part of this rubric version.`)
    }
    if (
      !Number.isInteger(score.score) ||
      score.score < criterion.minScore ||
      score.score > criterion.maxScore
    ) {
      throw badRequest(
        `Score for "${criterion.key}" must be an integer between ${criterion.minScore} and ${criterion.maxScore}.`,
      )
    }
  }
  if (requireAll && seen.size !== criteria.length) {
    const missing = criteria.find((criterion) => !seen.has(criterion.key))
    throw badRequest(`A score for criterion "${missing?.key ?? 'unknown'}" is required.`)
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface CreateRubricVersionInput {
  criteria: RubricCriterion[]
  tieBreakPolicy?: string
  judgeCommentRules?: string
}

export interface JudgingProgress {
  totalAssignments: number
  draftCount: number
  submittedCount: number
  lockedCount: number
  conflictCount: number
  recusedCount: number
}

export interface FeedbackEntry {
  criterionScores: CriterionScore[]
  totalScore: number | null
  maxPossibleScore: number | null
}

export interface JudgingService {
  // staff invitations
  createStaffInvitation(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: { role: ChallengeStaffRole; email?: string },
  ): Promise<StaffInvitationRow>
  listStaffInvitations(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<StaffInvitationRow[]>
  revokeStaffInvitation(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    invitationId: string,
  ): Promise<void>
  acceptStaffInvitation(access: AccessContext, token: string): Promise<StaffAssignmentRow>
  declineStaffInvitation(access: AccessContext, token: string): Promise<void>

  // staff assignments
  listStaff(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<StaffAssignmentRow[]>
  removeStaff(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    staffAssignmentId: string,
  ): Promise<void>

  // rubrics
  createRubric(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    name: string,
  ): Promise<RubricRow>
  listRubrics(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<RubricRow[]>
  getRubric(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    rubricId: string,
  ): Promise<RubricRow>
  createRubricVersion(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    rubricId: string,
    input: CreateRubricVersionInput,
  ): Promise<RubricVersionRow>
  listRubricVersions(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    rubricId: string,
  ): Promise<RubricVersionRow[]>
  getRubricVersion(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    rubricId: string,
    versionId: string,
  ): Promise<RubricVersionRow>
  activateRubricVersion(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    rubricId: string,
    versionId: string,
  ): Promise<RubricVersionRow>

  // judge assignments (organizer)
  createJudgeAssignment(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: { staffAssignmentId: string; submissionId: string },
  ): Promise<JudgeAssignmentRow>
  autoBalance(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<JudgeAssignmentRow[]>
  reassignJudgeAssignment(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    assignmentId: string,
    input: { newStaffAssignmentId: string; reason: string },
  ): Promise<JudgeAssignmentRow>
  deleteJudgeAssignment(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    assignmentId: string,
  ): Promise<void>
  listJudgeAssignmentsForChallenge(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<JudgeAssignmentRow[]>

  // judge self-service (flat routes)
  listMyAssignments(access: AccessContext): Promise<JudgeAssignmentRow[]>
  getMyAssignment(access: AccessContext, assignmentId: string): Promise<JudgeAssignmentRow>
  declareConflict(access: AccessContext, assignmentId: string): Promise<JudgeAssignmentRow>
  recuse(access: AccessContext, assignmentId: string): Promise<JudgeAssignmentRow>

  // scorecards (judge)
  getMyScorecard(access: AccessContext, assignmentId: string): Promise<ScorecardRow>
  saveScorecardDraft(
    access: AccessContext,
    assignmentId: string,
    criterionScores: CriterionScore[],
  ): Promise<ScorecardRow>
  submitScorecard(
    access: AccessContext,
    assignmentId: string,
    criterionScores: CriterionScore[],
  ): Promise<ScorecardRow>

  // scorecards (organizer) + judging lifecycle
  reopenScorecard(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    scorecardId: string,
    reason: string,
  ): Promise<void>
  getProgress(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<JudgingProgress>
  finalizeJudging(access: AccessContext, organizationId: string, challengeId: string): Promise<void>

  // results
  getResults(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<SubmissionResultRow[]>
  finalizeResults(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    selections: ResultSelectionInput[],
  ): Promise<SubmissionResultRow[]>
  publishResults(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    transaction?: PrismaTransactionClient,
  ): Promise<void>
  retractResults(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    reason: string,
  ): Promise<void>

  // feedback
  releaseFeedback(access: AccessContext, organizationId: string, challengeId: string): Promise<void>
  getFeedbackForSubmission(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    submissionId: string,
  ): Promise<FeedbackEntry[]>
}

export interface ResultSelectionInput {
  submissionId: string
  selectionType: SubmissionResultRow['selectionType']
  rank?: number
  rankLabel?: string
  tieBreakDecision?: string
}

export function createJudgingService(
  repository: JudgingRepository,
  challengesRepository: ChallengesRepository,
  submissionsRepository: SubmissionsRepository,
  teamsRepository: TeamsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  rateLimiter: RateLimiter,
): JudgingService {
  return {
    // --- staff invitations -------------------------------------------------
    async createStaffInvitation(access, organizationId, challengeId, input) {
      authorize(access, Permission.ChallengeManageJudges)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')

          const token = generateSecureToken()
          const invitation = await repository.createStaffInvitation(tx, {
            id: newId(),
            organizationId,
            challengeId,
            role: input.role,
            email: input.email,
            tokenHash: hashToken(token),
            invitedByUserId: actorUserId,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeStaffInvited,
            resourceType: 'challenge_staff_invitation',
            resourceId: invitation.id,
            summary: `Invited a ${input.role.toLowerCase()} to "${challenge.title}".`,
          })

          if (input.email !== undefined) {
            await outbox.write(tx, {
              eventType: 'challenge.staff_invitation_created',
              queueName: QueueName.Email,
              aggregateType: 'challenge_staff_invitation',
              aggregateId: invitation.id,
              organizationId,
              dedupeKey: `challenge-staff-invitation-created:${invitation.id}`,
              payload: {
                email: input.email,
                token,
                role: input.role,
                challengeTitle: challenge.title,
              },
            })
          }

          return invitation
        },
        { actorUserId },
      )
    },

    async listStaffInvitations(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeManageJudges)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listStaffInvitations(tx, organizationId, challengeId),
      )
    },

    async revokeStaffInvitation(access, organizationId, challengeId, invitationId) {
      authorize(access, Permission.ChallengeManageJudges)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const invitation = await repository.findStaffInvitationById(
            tx,
            organizationId,
            invitationId,
          )
          if (invitation === null || invitation.challengeId !== challengeId) {
            throw notFound('Invitation not found.')
          }
          if (invitation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'Only a pending invitation can be revoked.')
          }

          await repository.setStaffInvitationStatus(tx, organizationId, invitationId, 'REVOKED')

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeStaffInvitationRevoked,
            resourceType: 'challenge_staff_invitation',
            resourceId: invitationId,
            summary: 'Revoked a challenge staff invitation.',
          })
        },
        { actorUserId },
      )
    },

    async acceptStaffInvitation(access, token) {
      const { actor } = requireVerifiedActor(access)
      // Mirrors organization invitation acceptance (invitations.service.ts):
      // a staff-invitation token is exactly as brute-forceable a secret as an
      // organization invitation token, and the policy for it already existed
      // (`RateLimitPolicies.StaffInvitationAcceptance`) but was never wired
      // up here.
      await rateLimiter.enforce(RateLimitPolicies.StaffInvitationAcceptance, {
        userId: actor.userId,
        ipAddress: access.ipAddress,
      })

      const tokenHash = hashToken(token)

      const invitation = await transactions.withSecretLookup((tx) =>
        repository.findStaffInvitationByTokenHash(tx, tokenHash),
      )
      if (invitation === null) throw notFound('This invitation link is invalid.')

      return transactions.withTenant(
        invitation.organizationId,
        async (tx) => {
          const now = await transactions.databaseNow(tx)
          if (invitation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'This invitation has already been used.')
          }
          if (invitation.expiresAt <= now) {
            throw conflict(ErrorCode.CONFLICT, 'This invitation has expired.')
          }
          if (
            invitation.email !== null &&
            invitation.email.toLowerCase() !== actor.email.toLowerCase()
          ) {
            throw forbidden('This invitation was issued to a different email address.')
          }

          const existing = await repository.findStaffAssignmentByChallengeAndUser(
            tx,
            invitation.organizationId,
            invitation.challengeId,
            actor.userId,
          )
          if (existing !== null && existing.status === 'ACTIVE') {
            throw conflict(ErrorCode.CONFLICT, 'You already hold a staff role on this challenge.')
          }

          const assignment = await repository.createStaffAssignment(tx, {
            id: newId(),
            organizationId: invitation.organizationId,
            challengeId: invitation.challengeId,
            userId: actor.userId,
            role: invitation.role,
            invitationId: invitation.id,
          })

          await repository.setStaffInvitationStatus(
            tx,
            invitation.organizationId,
            invitation.id,
            'ACCEPTED',
            actor.userId,
          )

          await audit.write(tx, {
            organizationId: invitation.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.ChallengeStaffAccepted,
            resourceType: 'challenge_staff_assignment',
            resourceId: assignment.id,
            summary: `Accepted a ${invitation.role.toLowerCase()} invitation.`,
          })

          return assignment
        },
        { actorUserId: actor.userId },
      )
    },

    async declineStaffInvitation(access, token) {
      const { actor } = requireVerifiedActor(access)
      const tokenHash = hashToken(token)
      const invitation = await transactions.withSecretLookup((tx) =>
        repository.findStaffInvitationByTokenHash(tx, tokenHash),
      )
      if (invitation === null) throw notFound('This invitation link is invalid.')

      await transactions.withTenant(
        invitation.organizationId,
        async (tx) => {
          if (invitation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'This invitation has already been used.')
          }
          await repository.setStaffInvitationStatus(
            tx,
            invitation.organizationId,
            invitation.id,
            'DECLINED',
          )
        },
        { actorUserId: actor.userId },
      )
    },

    // --- staff assignments ---------------------------------------------------
    async listStaff(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listStaffAssignments(tx, organizationId, challengeId, {}),
      )
    },

    async removeStaff(access, organizationId, challengeId, staffAssignmentId) {
      authorize(access, Permission.ChallengeManageJudges)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const staff = await repository.findStaffAssignmentById(
            tx,
            organizationId,
            staffAssignmentId,
          )
          if (staff === null || staff.challengeId !== challengeId)
            throw notFound('Staff assignment not found.')

          await repository.removeStaffAssignment(tx, organizationId, staffAssignmentId, actorUserId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ChallengeStaffRemoved,
            resourceType: 'challenge_staff_assignment',
            resourceId: staffAssignmentId,
            summary: 'Removed a challenge staff member.',
          })
        },
        { actorUserId },
      )
    },

    // --- rubrics -------------------------------------------------------------
    async createRubric(access, organizationId, challengeId, name) {
      authorize(access, Permission.ChallengeManageRubric)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const rubric = await repository.createRubric(tx, {
            id: newId(),
            organizationId,
            challengeId,
            name,
            createdByUserId: actorUserId,
          })
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.RubricCreated,
            resourceType: 'rubric',
            resourceId: rubric.id,
            summary: `Created rubric "${rubric.name}".`,
          })
          return rubric
        },
        { actorUserId },
      )
    },

    async listRubrics(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listRubrics(tx, organizationId, challengeId),
      )
    },

    async getRubric(access, organizationId, challengeId, rubricId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        const rubric = await repository.findRubricById(tx, organizationId, rubricId)
        if (rubric === null || rubric.challengeId !== challengeId)
          throw notFound('Rubric not found.')
        return rubric
      })
    },

    async createRubricVersion(access, organizationId, challengeId, rubricId, input) {
      authorize(access, Permission.ChallengeManageRubric)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()
      validateCriteria(input.criteria)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const rubric = await repository.findRubricById(tx, organizationId, rubricId)
          if (rubric === null || rubric.challengeId !== challengeId)
            throw notFound('Rubric not found.')

          const version = await repository.createRubricVersion(tx, {
            id: newId(),
            organizationId,
            rubricId,
            challengeId,
            criteria: input.criteria,
            tieBreakPolicy: input.tieBreakPolicy,
            judgeCommentRules: input.judgeCommentRules,
            createdByUserId: actorUserId,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.RubricVersionCreated,
            resourceType: 'rubric_version',
            resourceId: version.id,
            summary: `Created rubric version ${version.version} for "${rubric.name}".`,
          })

          return version
        },
        { actorUserId },
      )
    },

    async listRubricVersions(access, organizationId, challengeId, rubricId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        const rubric = await repository.findRubricById(tx, organizationId, rubricId)
        if (rubric === null || rubric.challengeId !== challengeId)
          throw notFound('Rubric not found.')
        return repository.listRubricVersions(tx, organizationId, rubricId)
      })
    },

    async getRubricVersion(access, organizationId, challengeId, rubricId, versionId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        const rubric = await repository.findRubricById(tx, organizationId, rubricId)
        if (rubric === null || rubric.challengeId !== challengeId)
          throw notFound('Rubric not found.')
        const version = await repository.findRubricVersionById(tx, organizationId, versionId)
        if (version === null || version.rubricId !== rubricId)
          throw notFound('Rubric version not found.')
        return version
      })
    },

    async activateRubricVersion(access, organizationId, challengeId, rubricId, versionId) {
      authorize(access, Permission.ChallengeManageRubric)
      const actorUserId = access.actor?.userId

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await tx.$queryRaw`select id from challenge where id = ${challengeId}::uuid for update`
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          const now = await transactions.databaseNow(tx)
          const judgingHasStarted =
            ['JUDGING', 'RESULTS_READY', 'RESULTS_PUBLISHED', 'ARCHIVED'].includes(
              challenge.status,
            ) ||
            (challenge.judgingStartAt !== null && challenge.judgingStartAt <= now)
          const submittedScorecardExists =
            (await tx.scorecard.count({
              where: { organizationId, challengeId, status: { not: 'DRAFT' } },
            })) > 0
          if (judgingHasStarted || submittedScorecardExists) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The active rubric is locked once judging begins or a scorecard is submitted.',
            )
          }

          const rubric = await repository.findRubricById(tx, organizationId, rubricId)
          if (rubric === null || rubric.challengeId !== challengeId)
            throw notFound('Rubric not found.')

          const version = await repository.findRubricVersionById(tx, organizationId, versionId)
          if (version === null || version.rubricId !== rubricId)
            throw notFound('Rubric version not found.')
          if (version.isActive) return version

          await repository.deactivateAllRubricVersions(tx, organizationId, rubricId)
          await repository.activateRubricVersion(tx, organizationId, versionId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.RubricVersionActivated,
            resourceType: 'rubric_version',
            resourceId: versionId,
            summary: `Activated rubric version ${version.version}.`,
          })

          const after = await repository.findRubricVersionById(tx, organizationId, versionId)
          if (after === null) throw notFound('Rubric version not found.')
          return after
        },
        { actorUserId },
      )
    },

    // --- judge assignments (organizer) ---------------------------------------
    async createJudgeAssignment(access, organizationId, challengeId, input) {
      authorize(access, Permission.ChallengeManageJudges)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const staff = await repository.findStaffAssignmentById(
            tx,
            organizationId,
            input.staffAssignmentId,
          )
          if (staff === null || staff.challengeId !== challengeId || staff.status !== 'ACTIVE') {
            throw notFound('Staff assignment not found.')
          }
          if (staff.role !== 'JUDGE') {
            throw badRequest('Only staff with the JUDGE role can be assigned to score submissions.')
          }

          const submission = await submissionsRepository.findById(
            tx,
            organizationId,
            input.submissionId,
          )
          if (submission === null || submission.challengeId !== challengeId) {
            throw notFound('Submission not found.')
          }
          if (submission.status !== 'FINALIZED') {
            throw conflict(
              ErrorCode.CONFLICT,
              'Only a finalized submission can be assigned to a judge.',
            )
          }

          const activeVersion = await repository.findActiveRubricVersionForChallenge(
            tx,
            organizationId,
            challengeId,
          )
          if (activeVersion === null) {
            throw conflict(ErrorCode.CONFLICT, 'Activate a rubric before assigning judges.')
          }

          const assignment = await repository.createJudgeAssignment(tx, {
            id: newId(),
            organizationId,
            challengeId,
            staffAssignmentId: staff.id,
            submissionId: submission.id,
          })
          await repository.createScorecard(tx, {
            id: newId(),
            organizationId,
            challengeId,
            judgeAssignmentId: assignment.id,
            rubricVersionId: activeVersion.id,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.JudgeAssigned,
            resourceType: 'judge_assignment',
            resourceId: assignment.id,
            summary: 'Assigned a judge to a submission.',
          })

          await outbox.write(tx, {
            eventType: 'judging.assignment_created',
            queueName: QueueName.Email,
            aggregateType: 'judge_assignment',
            aggregateId: assignment.id,
            organizationId,
            dedupeKey: `judging-assignment-created:${assignment.id}`,
            payload: { assignmentId: assignment.id, judgeUserId: staff.userId },
          })

          return assignment
        },
        { actorUserId },
      )
    },

    async autoBalance(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeManageJudges)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const activeVersion = await repository.findActiveRubricVersionForChallenge(
            tx,
            organizationId,
            challengeId,
          )
          if (activeVersion === null) {
            throw conflict(ErrorCode.CONFLICT, 'Activate a rubric before assigning judges.')
          }

          const judges = await repository.listStaffAssignments(tx, organizationId, challengeId, {
            status: 'ACTIVE',
            role: 'JUDGE',
          })
          if (judges.length === 0) {
            throw conflict(ErrorCode.CONFLICT, 'No active judges are available to balance.')
          }

          const submissionsPage = await submissionsRepository.listByChallenge(
            tx,
            organizationId,
            challengeId,
            'FINALIZED',
            { limit: 1000 },
          )
          const existingAssignments = await repository.listJudgeAssignmentsForChallenge(
            tx,
            organizationId,
            challengeId,
          )
          const assignedSubmissionIds = new Set(
            existingAssignments.filter((a) => a.status !== 'REASSIGNED').map((a) => a.submissionId),
          )
          const unassignedSubmissions = submissionsPage.items.filter(
            (s) => !assignedSubmissionIds.has(s.id),
          )

          // Deterministic, explainable round-robin: sort judges by their
          // current live-assignment count (ascending) then by id, always
          // picking the least-loaded judge next. No randomness, no ML.
          const loadByStaffId = new Map<string, number>()
          for (const judge of judges) {
            loadByStaffId.set(
              judge.id,
              await repository.countLiveAssignmentsForStaff(tx, organizationId, judge.id),
            )
          }
          const sortedJudgeIds = [...judges].map((j) => j.id).sort((a, b) => a.localeCompare(b))

          const created: JudgeAssignmentRow[] = []
          for (const submission of unassignedSubmissions) {
            const nextJudgeId = sortedJudgeIds.reduce((leastLoadedId, candidateId) => {
              const candidateLoad = loadByStaffId.get(candidateId) ?? 0
              const leastLoad = loadByStaffId.get(leastLoadedId) ?? 0
              return candidateLoad < leastLoad ? candidateId : leastLoadedId
            }, sortedJudgeIds[0] as string)

            const assignment = await repository.createJudgeAssignment(tx, {
              id: newId(),
              organizationId,
              challengeId,
              staffAssignmentId: nextJudgeId,
              submissionId: submission.id,
            })
            await repository.createScorecard(tx, {
              id: newId(),
              organizationId,
              challengeId,
              judgeAssignmentId: assignment.id,
              rubricVersionId: activeVersion.id,
            })
            loadByStaffId.set(nextJudgeId, (loadByStaffId.get(nextJudgeId) ?? 0) + 1)
            created.push(assignment)
          }

          if (created.length > 0) {
            await audit.write(tx, {
              organizationId,
              actorType: 'USER',
              actorUserId,
              action: AuditAction.JudgeAssigned,
              resourceType: 'judge_assignment',
              summary: `Auto-balanced ${created.length} judge assignment(s) across ${judges.length} judge(s).`,
            })
          }

          return created
        },
        { actorUserId },
      )
    },

    async reassignJudgeAssignment(access, organizationId, challengeId, assignmentId, input) {
      authorize(access, Permission.ChallengeManageJudges)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const assignment = await repository.findJudgeAssignmentById(
            tx,
            organizationId,
            assignmentId,
          )
          if (assignment === null || assignment.challengeId !== challengeId) {
            throw notFound('Judge assignment not found.')
          }
          if (assignment.status !== 'ASSIGNED') {
            throw conflict(ErrorCode.CONFLICT, 'Only an active assignment can be reassigned.')
          }

          const scorecard = await repository.findScorecardByAssignment(
            tx,
            organizationId,
            assignment.id,
          )
          if (scorecard !== null && scorecard.status !== 'DRAFT') {
            throw conflict(
              ErrorCode.CONFLICT,
              'This assignment already has scores and cannot be reassigned.',
            )
          }

          const newStaff = await repository.findStaffAssignmentById(
            tx,
            organizationId,
            input.newStaffAssignmentId,
          )
          if (
            newStaff === null ||
            newStaff.challengeId !== challengeId ||
            newStaff.status !== 'ACTIVE'
          ) {
            throw notFound('The new staff assignment was not found.')
          }
          if (newStaff.role !== 'JUDGE') {
            throw badRequest('The new assignee must hold the JUDGE role.')
          }

          await repository.setJudgeAssignmentStatus(tx, organizationId, assignmentId, 'REASSIGNED')

          const newAssignment = await repository.createJudgeAssignment(tx, {
            id: newId(),
            organizationId,
            challengeId,
            staffAssignmentId: newStaff.id,
            submissionId: assignment.submissionId,
          })
          await repository.createScorecard(tx, {
            id: newId(),
            organizationId,
            challengeId,
            judgeAssignmentId: newAssignment.id,
            rubricVersionId: (scorecard ?? { rubricVersionId: '' }).rubricVersionId,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.JudgeAssignmentReassigned,
            resourceType: 'judge_assignment',
            resourceId: newAssignment.id,
            summary: 'Reassigned a judge assignment.',
            reason: input.reason,
          })

          return newAssignment
        },
        { actorUserId },
      )
    },

    async deleteJudgeAssignment(access, organizationId, challengeId, assignmentId) {
      authorize(access, Permission.ChallengeManageJudges)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const assignment = await repository.findJudgeAssignmentById(
            tx,
            organizationId,
            assignmentId,
          )
          if (assignment === null || assignment.challengeId !== challengeId) {
            throw notFound('Judge assignment not found.')
          }
          const scorecard = await repository.findScorecardByAssignment(
            tx,
            organizationId,
            assignment.id,
          )
          if (scorecard !== null && scorecard.status !== 'DRAFT') {
            throw conflict(
              ErrorCode.CONFLICT,
              'This assignment already has scores and cannot be removed.',
            )
          }

          await repository.setJudgeAssignmentStatus(tx, organizationId, assignmentId, 'REASSIGNED')

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.JudgeAssignmentRemoved,
            resourceType: 'judge_assignment',
            resourceId: assignmentId,
            summary: 'Removed a judge assignment.',
          })
        },
        { actorUserId },
      )
    },

    async listJudgeAssignmentsForChallenge(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeManageJudges)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listJudgeAssignmentsForChallenge(tx, organizationId, challengeId),
      )
    },

    // --- judge self-service ----------------------------------------------------
    async listMyAssignments(access) {
      const { actor } = requireVerifiedActor(access)
      const rows = await transactions.withoutTenant((tx) =>
        repository.listJudgeAssignmentsAcrossOrgsForUser(tx, actor.userId),
      )
      return rows
    },

    async getMyAssignment(access, assignmentId) {
      const { actor } = requireVerifiedActor(access)
      const resolved = await transactions.withoutTenant((tx) =>
        repository.findJudgeAssignmentWithOwner(tx, assignmentId, actor.userId),
      )
      if (resolved === null || resolved.staffUserId !== actor.userId) {
        throw notFound('Judge assignment not found.')
      }
      return resolved
    },

    async declareConflict(access, assignmentId) {
      const { actor } = requireVerifiedActor(access)
      const resolved = await transactions.withoutTenant((tx) =>
        repository.findJudgeAssignmentWithOwner(tx, assignmentId, actor.userId),
      )
      if (resolved === null || resolved.staffUserId !== actor.userId) {
        throw notFound('Judge assignment not found.')
      }

      return transactions.withTenant(
        resolved.organizationId,
        async (tx) => {
          if (resolved.status !== 'ASSIGNED') {
            throw conflict(
              ErrorCode.CONFLICT,
              'Only an active assignment can have a conflict declared.',
            )
          }
          await repository.setJudgeAssignmentStatus(
            tx,
            resolved.organizationId,
            assignmentId,
            'CONFLICT_DECLARED',
            'conflictDeclaredAt',
          )
          await audit.write(tx, {
            organizationId: resolved.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.JudgeConflictDeclared,
            resourceType: 'judge_assignment',
            resourceId: assignmentId,
            summary: 'Declared a conflict of interest.',
          })
          const after = await repository.findJudgeAssignmentById(
            tx,
            resolved.organizationId,
            assignmentId,
          )
          if (after === null) throw notFound('Judge assignment not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    async recuse(access, assignmentId) {
      const { actor } = requireVerifiedActor(access)
      const resolved = await transactions.withoutTenant((tx) =>
        repository.findJudgeAssignmentWithOwner(tx, assignmentId, actor.userId),
      )
      if (resolved === null || resolved.staffUserId !== actor.userId) {
        throw notFound('Judge assignment not found.')
      }

      return transactions.withTenant(
        resolved.organizationId,
        async (tx) => {
          if (resolved.status !== 'ASSIGNED' && resolved.status !== 'CONFLICT_DECLARED') {
            throw conflict(ErrorCode.CONFLICT, 'This assignment cannot be recused.')
          }
          await repository.setJudgeAssignmentStatus(
            tx,
            resolved.organizationId,
            assignmentId,
            'RECUSED',
            'recusedAt',
          )
          await audit.write(tx, {
            organizationId: resolved.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.JudgeRecused,
            resourceType: 'judge_assignment',
            resourceId: assignmentId,
            summary: 'Recused from a judge assignment.',
          })
          const after = await repository.findJudgeAssignmentById(
            tx,
            resolved.organizationId,
            assignmentId,
          )
          if (after === null) throw notFound('Judge assignment not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    // --- scorecards (judge) -----------------------------------------------------
    async getMyScorecard(access, assignmentId) {
      const { actor } = requireVerifiedActor(access)
      const resolved = await transactions.withoutTenant((tx) =>
        repository.findScorecardByAssignmentWithOwner(tx, assignmentId, actor.userId),
      )
      if (resolved === null || resolved.staffUserId !== actor.userId) {
        throw notFound('Scorecard not found.')
      }
      return resolved
    },

    async saveScorecardDraft(access, assignmentId, criterionScores) {
      const { actor } = requireVerifiedActor(access)
      const resolved = await transactions.withoutTenant((tx) =>
        repository.findScorecardByAssignmentWithOwner(tx, assignmentId, actor.userId),
      )
      if (resolved === null || resolved.staffUserId !== actor.userId) {
        throw notFound('Scorecard not found.')
      }

      return transactions.withTenant(
        resolved.organizationId,
        async (tx) => {
          await tx.$queryRaw`select id from scorecard where id = ${resolved.id}::uuid for update`
          const current = await repository.findScorecardById(
            tx,
            resolved.organizationId,
            resolved.id,
          )
          if (current === null) throw notFound('Scorecard not found.')
          if (current.status !== 'DRAFT') {
            throw conflict(ErrorCode.CONFLICT, 'Only a draft scorecard can be edited.')
          }
          const rubricVersion = await repository.findRubricVersionById(
            tx,
            resolved.organizationId,
            current.rubricVersionId,
          )
          if (rubricVersion === null) throw notFound('Rubric version not found.')
          validateCriterionScores(rubricVersion.criteria, criterionScores, false)
          await repository.saveScorecardDraft(
            tx,
            resolved.organizationId,
            resolved.id,
            criterionScores,
          )
          const after = await repository.findScorecardById(tx, resolved.organizationId, resolved.id)
          if (after === null) throw notFound('Scorecard not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    async submitScorecard(access, assignmentId, criterionScores) {
      const { actor } = requireVerifiedActor(access)
      const resolved = await transactions.withoutTenant((tx) =>
        repository.findScorecardByAssignmentWithOwner(tx, assignmentId, actor.userId),
      )
      if (resolved === null || resolved.staffUserId !== actor.userId) {
        throw notFound('Scorecard not found.')
      }

      return transactions.withTenant(
        resolved.organizationId,
        async (tx) => {
          await tx.$queryRaw`select id from scorecard where id = ${resolved.id}::uuid for update`
          const current = await repository.findScorecardById(
            tx,
            resolved.organizationId,
            resolved.id,
          )
          if (current === null) throw notFound('Scorecard not found.')
          if (current.status !== 'DRAFT') {
            throw conflict(ErrorCode.CONFLICT, 'Only a draft scorecard can be submitted.')
          }
          const rubricVersion = await repository.findRubricVersionById(
            tx,
            resolved.organizationId,
            current.rubricVersionId,
          )
          if (rubricVersion === null) throw notFound('Rubric version not found.')

          const { totalScore, maxPossibleScore } = computeWeightedTotal(
            rubricVersion.criteria,
            criterionScores,
          )

          await repository.submitScorecard(tx, resolved.organizationId, resolved.id, {
            criterionScores,
            totalScore,
            maxPossibleScore,
            lock: false,
          })

          await audit.write(tx, {
            organizationId: resolved.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.ScorecardSubmitted,
            resourceType: 'scorecard',
            resourceId: resolved.id,
            summary: 'Submitted a scorecard.',
          })

          await outbox.write(tx, {
            eventType: 'judging.scorecard_submitted',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'scorecard',
            aggregateId: current.id,
            organizationId: current.organizationId,
            payload: {
              scorecardId: current.id,
              challengeId: current.challengeId,
            },
            dedupeKey: `judging.scorecard_submitted:${current.id}`,
          })

          const after = await repository.findScorecardById(tx, resolved.organizationId, resolved.id)
          if (after === null) throw notFound('Scorecard not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    // --- scorecards (organizer) + judging lifecycle -----------------------------
    async reopenScorecard(access, organizationId, challengeId, scorecardId, reason) {
      authorize(access, Permission.JudgingReopenScorecard)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const scorecard = await repository.findScorecardById(tx, organizationId, scorecardId)
          if (scorecard === null || scorecard.challengeId !== challengeId)
            throw notFound('Scorecard not found.')
          if (scorecard.status === 'DRAFT') {
            throw conflict(ErrorCode.CONFLICT, 'This scorecard is already a draft.')
          }

          await repository.reopenScorecard(tx, organizationId, scorecardId, reason)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ScorecardReopened,
            resourceType: 'scorecard',
            resourceId: scorecardId,
            summary: 'Reopened a scorecard.',
            reason,
          })
        },
        { actorUserId },
      )
    },

    async getProgress(access, organizationId, challengeId) {
      authorize(access, Permission.JudgingViewProgress)
      return transactions.withTenant(organizationId, async (tx) => {
        const scorecards = await repository.listScorecardsForChallenge(
          tx,
          organizationId,
          challengeId,
        )
        const assignments = await repository.listJudgeAssignmentsForChallenge(
          tx,
          organizationId,
          challengeId,
        )
        return {
          totalAssignments: assignments.filter((a) => a.status !== 'REASSIGNED').length,
          draftCount: scorecards.filter((s) => s.status === 'DRAFT').length,
          submittedCount: scorecards.filter((s) => s.status === 'SUBMITTED').length,
          lockedCount: scorecards.filter((s) => s.status === 'LOCKED').length,
          conflictCount: assignments.filter((a) => a.status === 'CONFLICT_DECLARED').length,
          recusedCount: assignments.filter((a) => a.status === 'RECUSED').length,
        }
      })
    },

    async finalizeJudging(access, organizationId, challengeId) {
      authorize(access, Permission.JudgingFinalize)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (challenge.judgingFinalizedAt !== null) {
            throw conflict(ErrorCode.CONFLICT, 'Judging has already been finalized.')
          }

          const scorecards = await repository.listScorecardsForChallenge(
            tx,
            organizationId,
            challengeId,
          )
          for (const scorecard of scorecards) {
            if (scorecard.status === 'SUBMITTED') {
              await repository.submitScorecard(tx, organizationId, scorecard.id, {
                criterionScores: scorecard.criterionScores,
                totalScore: scorecard.totalScore ?? 0,
                maxPossibleScore: scorecard.maxPossibleScore ?? 0,
                lock: true,
              })
            }
          }

          const updated = await tx.challenge.updateMany({
            where: { id: challengeId, organizationId, version: challenge.version },
            data: {
              status: 'RESULTS_READY',
              judgingFinalizedAt: new Date(),
              version: { increment: 1 },
            },
          })
          if (updated.count === 0) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.JudgingFinalized,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Finalized judging for "${challenge.title}", locking all submitted scorecards.`,
          })
        },
        { actorUserId },
      )
    },

    // --- results ---------------------------------------------------------------
    async getResults(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengePublishResults)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listResultsForChallenge(tx, organizationId, challengeId),
      )
    },

    async finalizeResults(access, organizationId, challengeId, selections) {
      authorize(access, Permission.ChallengePublishResults)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await tx.$queryRaw`select id from challenge where id = ${challengeId}::uuid for update`
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (challenge.judgingFinalizedAt === null) {
            throw conflict(ErrorCode.CONFLICT, 'Finalize judging before finalizing results.')
          }
          if (challenge.resultsFinalizedAt !== null) {
            throw conflict(ErrorCode.CONFLICT, 'Results have already been finalized.')
          }
          const uniqueSubmissionIds = new Set(selections.map((selection) => selection.submissionId))
          if (uniqueSubmissionIds.size !== selections.length) {
            throw badRequest('Each submission may be selected only once.')
          }

          const aggregates = await tx.$queryRaw<
            {
              submissionId: string
              trackId: string | null
              submissionVersionId: string
              aggregateScore: number
            }[]
          >`
            select s.id as "submissionId", s.track_id as "trackId",
                   s.final_version_id as "submissionVersionId",
                   coalesce(sum(sc.total_score) filter (where sc.status = 'LOCKED'), 0)::int
                     as "aggregateScore"
            from submission s
            left join judge_assignment ja
              on ja.submission_id = s.id
             and ja.organization_id = s.organization_id
             and ja.challenge_id = s.challenge_id
            left join scorecard sc
              on sc.judge_assignment_id = ja.id
             and sc.organization_id = ja.organization_id
             and sc.challenge_id = ja.challenge_id
            where s.organization_id = ${organizationId}::uuid
              and s.challenge_id = ${challengeId}::uuid
              and s.status = 'FINALIZED'
              and s.final_version_id is not null
            group by s.id, s.track_id, s.final_version_id
          `
          const aggregateBySubmission = new Map(
            aggregates.map((aggregate) => [aggregate.submissionId, aggregate]),
          )
          for (const selection of selections) {
            if (!aggregateBySubmission.has(selection.submissionId)) {
              throw badRequest(
                `Submission ${selection.submissionId} is not a finalized submission in this challenge.`,
              )
            }
          }

          for (const left of selections) {
            if (left.rank === undefined) continue
            const leftAggregate = aggregateBySubmission.get(left.submissionId)
            for (const right of selections) {
              if (right.submissionId === left.submissionId || right.rank === undefined) continue
              const rightAggregate = aggregateBySubmission.get(right.submissionId)
              if (
                left.rank === right.rank &&
                leftAggregate?.aggregateScore !== rightAggregate?.aggregateScore
              ) {
                throw badRequest('Only submissions with equal aggregate scores may share a rank.')
              }
              if (
                leftAggregate?.aggregateScore === rightAggregate?.aggregateScore &&
                left.rank !== right.rank &&
                (left.tieBreakDecision === undefined || right.tieBreakDecision === undefined)
              ) {
                throw badRequest(
                  'A tieBreakDecision is required for every tied submission assigned a different rank.',
                )
              }
            }
          }

          const now = await transactions.databaseNow(tx)
          const snapshotId = newId()
          await tx.resultSnapshot.create({
            data: {
              id: snapshotId,
              organizationId,
              challengeId,
              publicationVersion: 1,
              finalizedByUserId: actorUserId,
              finalizedAt: now,
            },
          })
          for (const selection of selections) {
            const aggregate = aggregateBySubmission.get(selection.submissionId)
            if (aggregate === undefined) throw new Error('Validated result aggregate disappeared.')
            await repository.createResult(tx, {
              id: newId(),
              organizationId,
              challengeId,
              snapshotId,
              submissionId: selection.submissionId,
              submissionVersionId: aggregate.submissionVersionId,
              trackId: aggregate.trackId,
              selectionType: selection.selectionType,
              rankLabel: selection.rankLabel ?? null,
              rank: selection.rank ?? null,
              aggregateScore: aggregate.aggregateScore,
              tieBreakDecision: selection.tieBreakDecision,
            })
          }

          const updated = await tx.challenge.updateMany({
            where: { id: challengeId, organizationId, version: challenge.version },
            data: {
              status: 'RESULTS_READY',
              resultsFinalizedAt: now,
              version: { increment: 1 },
            },
          })
          if (updated.count === 0) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ResultsFinalized,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Finalized immutable result snapshot ${snapshotId} for "${challenge.title}" (${selections.length} selection(s)).`,
          })

          return repository.listResultsForChallenge(tx, organizationId, challengeId)
        },
        { actorUserId },
      )
    },

    async publishResults(access, organizationId, challengeId, transaction) {
      authorize(access, Permission.ChallengePublishResults, { requireFreshSession: true })
      const actorUserId = access.actor?.userId

      const execute = async (tx: PrismaTransactionClient) => {
        const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
        if (challenge === null) throw notFound('Challenge not found.')
        if (challenge.resultsPublishedAt !== null) {
          throw conflict(ErrorCode.CONFLICT, 'Results are already published.')
        }

        const snapshot = await tx.resultSnapshot.findFirst({
          where: { organizationId, challengeId, status: 'FINALIZED' },
        })
        if (snapshot === null) {
          throw conflict(ErrorCode.CONFLICT, 'Finalize results before publishing.')
        }

        // `challengesRepository.setStatus`'s `fields` only maps to the
        // original DRAFT→OPEN `publishedAt` column — results publication is
        // a distinct timestamp (`resultsPublishedAt`), so this updates the
        // row directly rather than reusing that narrower helper.
        const now = await transactions.databaseNow(tx)
        const updated = await tx.challenge.updateMany({
          where: { id: challengeId, organizationId, version: challenge.version },
          data: {
            status: 'RESULTS_PUBLISHED',
            resultsPublishedAt: now,
            version: { increment: 1 },
          },
        })
        if (updated.count === 0) {
          throw conflict(
            ErrorCode.CONFLICT,
            'The challenge was modified concurrently. Reload and retry.',
          )
        }
        const snapshotUpdated = await tx.resultSnapshot.updateMany({
          where: { id: snapshot.id, organizationId, status: 'FINALIZED' },
          data: { status: 'PUBLISHED', publishedAt: now },
        })
        if (snapshotUpdated.count === 0) {
          throw conflict(ErrorCode.CONFLICT, 'The result snapshot changed concurrently.')
        }

        await audit.write(tx, {
          organizationId,
          actorType: 'USER',
          actorUserId,
          action: AuditAction.ResultsPublished,
          resourceType: 'challenge',
          resourceId: challengeId,
          summary: `Published results for "${challenge.title}".`,
        })

        await outbox.write(tx, {
          eventType: 'challenge.results_published',
          queueName: QueueName.NotificationFanout,
          aggregateType: 'challenge',
          aggregateId: challengeId,
          organizationId,
          dedupeKey: `challenge-results-published:${challengeId}:${challenge.version + 1}`,
          payload: { challengeId, organizationId },
        })
      }

      if (transaction !== undefined) return execute(transaction)
      await transactions.withTenant(organizationId, execute, { actorUserId })
    },

    async retractResults(access, organizationId, challengeId, reason) {
      authorize(access, Permission.ChallengePublishResults, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: 900,
      })
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (challenge.resultsPublishedAt === null) {
            throw conflict(ErrorCode.CONFLICT, 'Results are not currently published.')
          }

          const snapshot = await tx.resultSnapshot.findFirst({
            where: { organizationId, challengeId, status: 'PUBLISHED' },
          })
          if (snapshot === null) {
            throw conflict(ErrorCode.CONFLICT, 'The published result snapshot is unavailable.')
          }

          const now = await transactions.databaseNow(tx)

          const updated = await tx.challenge.updateMany({
            where: { id: challengeId, organizationId, version: challenge.version },
            data: {
              status: 'RESULTS_READY',
              resultsPublishedAt: null,
              resultsRetractedAt: now,
              version: { increment: 1 },
            },
          })
          if (updated.count === 0) {
            throw conflict(
              ErrorCode.CONFLICT,
              'The challenge was modified concurrently. Reload and retry.',
            )
          }
          const snapshotUpdated = await tx.resultSnapshot.updateMany({
            where: { id: snapshot.id, organizationId, status: 'PUBLISHED' },
            data: {
              status: 'RETRACTED',
              retractedAt: now,
              retractionReason: reason,
            },
          })
          if (snapshotUpdated.count === 0) {
            throw conflict(ErrorCode.CONFLICT, 'The result snapshot changed concurrently.')
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.ResultsRetracted,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Retracted published results for "${challenge.title}".`,
            reason,
          })
        },
        { actorUserId },
      )
    },

    // --- feedback ----------------------------------------------------------
    async releaseFeedback(access, organizationId, challengeId) {
      authorize(access, Permission.JudgingReleaseFeedback)
      const actorUserId = access.actor?.userId

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (challenge.feedbackReleasedAt !== null) {
            throw conflict(ErrorCode.CONFLICT, 'Feedback has already been released.')
          }

          const now = await transactions.databaseNow(tx)
          const released = await tx.challenge.updateMany({
            where: { id: challengeId, organizationId, feedbackReleasedAt: null },
            data: { feedbackReleasedAt: now },
          })
          if (released.count !== 1) {
            throw conflict(ErrorCode.CONFLICT, 'Feedback was released concurrently.')
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.FeedbackReleased,
            resourceType: 'challenge',
            resourceId: challengeId,
            summary: `Released judge feedback for "${challenge.title}".`,
          })
          await outbox.write(tx, {
            eventType: 'challenge.feedback_released',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge',
            aggregateId: challengeId,
            organizationId,
            dedupeKey: `challenge-feedback-released:${challengeId}`,
            payload: { challengeId },
          })
        },
        { actorUserId },
      )
    },

    async getFeedbackForSubmission(access, organizationId, challengeId, submissionId) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(organizationId, async (tx) => {
        const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
        if (challenge === null) throw notFound('Challenge not found.')

        const submission = await submissionsRepository.findById(tx, organizationId, submissionId)
        if (submission === null || submission.challengeId !== challengeId)
          throw notFound('Submission not found.')

        const isOrganizer = (() => {
          try {
            authorize(access, Permission.SubmissionViewAll)
            return true
          } catch {
            return false
          }
        })()
        if (!isOrganizer) {
          const member = await teamsRepository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )
          if (member === null || member.teamId !== submission.teamId) {
            throw forbidden('Only the owning team may view this feedback.')
          }
        }

        if (challenge.feedbackReleasedAt === null) {
          throw conflict(
            ErrorCode.CONFLICT,
            'Feedback has not been released for this challenge yet.',
          )
        }

        const scorecards = await repository.listScorecardsForSubmission(
          tx,
          organizationId,
          challengeId,
          submissionId,
        )
        return scorecards
          .filter((s) => s.status === 'LOCKED')
          .map((s) => ({
            criterionScores: s.criterionScores,
            totalScore: s.totalScore,
            maxPossibleScore: s.maxPossibleScore,
          }))
      })
    },
  }
}
