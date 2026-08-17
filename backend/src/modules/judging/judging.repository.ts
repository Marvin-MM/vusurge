import type { PrismaTransactionClient } from '../../shared/database'
import { newId } from '../../shared/ids'

export type ChallengeStaffRole = 'JUDGE' | 'MENTOR'
export type StaffInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'
export type StaffAssignmentStatus = 'ACTIVE' | 'REMOVED'
export type JudgeAssignmentStatus = 'ASSIGNED' | 'CONFLICT_DECLARED' | 'RECUSED' | 'REASSIGNED'
export type ScorecardStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED'

export interface RubricCriterion {
  key: string
  label: string
  description?: string
  minScore: number
  maxScore: number
  weight: number
}

export interface CriterionScore {
  criterionKey: string
  score: number
  comment?: string
}

export interface StaffInvitationRow {
  id: string
  organizationId: string
  challengeId: string
  role: ChallengeStaffRole
  email: string | null
  tokenHash: string
  status: StaffInvitationStatus
  invitedByUserId: string
  acceptedByUserId: string | null
  expiresAt: Date
  respondedAt: Date | null
  createdAt: Date
}

export interface StaffAssignmentRow {
  id: string
  organizationId: string
  challengeId: string
  userId: string
  role: ChallengeStaffRole
  status: StaffAssignmentStatus
  invitationId: string | null
  removedByUserId: string | null
  removedAt: Date | null
  createdAt: Date
}

export interface RubricRow {
  id: string
  organizationId: string
  challengeId: string
  name: string
  createdByUserId: string
  createdAt: Date
}

export interface RubricVersionRow {
  id: string
  organizationId: string
  rubricId: string
  version: number
  criteria: RubricCriterion[]
  tieBreakPolicy: string | null
  judgeCommentRules: string | null
  isActive: boolean
  createdByUserId: string
  activatedAt: Date | null
  createdAt: Date
}

interface PersistedRubricCriterion {
  key: string
  label: string
  description: string | null
  minScore: number
  maxScore: number
  weight: number
  displayOrder: number
}

type PersistedRubricVersion = Omit<RubricVersionRow, 'criteria'> & {
  totalWeight: number
  criteria: PersistedRubricCriterion[]
}

interface PersistedCriterionScore {
  score: number
  comment: string | null
  criterion: { key: string }
}

type PersistedScorecard = Omit<ScorecardRow, 'criterionScores'> & {
  criterionScores: PersistedCriterionScore[]
}

function mapRubricVersion(value: unknown): RubricVersionRow {
  const row = value as PersistedRubricVersion
  return {
    ...row,
    criteria: row.criteria
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((criterion) => ({
        key: criterion.key,
        label: criterion.label,
        ...(criterion.description === null ? {} : { description: criterion.description }),
        minScore: criterion.minScore,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
      })),
  }
}

function mapScorecard(value: unknown): ScorecardRow {
  const row = value as PersistedScorecard
  return {
    ...row,
    criterionScores: row.criterionScores.map((criterionScore) => ({
      criterionKey: criterionScore.criterion.key,
      score: criterionScore.score,
      ...(criterionScore.comment === null ? {} : { comment: criterionScore.comment }),
    })),
  }
}

const rubricVersionInclude = {
  criteria: { orderBy: { displayOrder: 'asc' as const } },
}

const scorecardInclude = {
  criterionScores: { include: { criterion: { select: { key: true } } } },
}

export interface JudgeAssignmentRow {
  id: string
  organizationId: string
  challengeId: string
  staffAssignmentId: string
  submissionId: string
  status: JudgeAssignmentStatus
  conflictDeclaredAt: Date | null
  recusedAt: Date | null
  createdAt: Date
}

export interface ScorecardRow {
  id: string
  organizationId: string
  challengeId: string
  judgeAssignmentId: string
  rubricVersionId: string
  status: ScorecardStatus
  criterionScores: CriterionScore[]
  totalScore: number | null
  maxPossibleScore: number | null
  submittedAt: Date | null
  lockedAt: Date | null
  reopenedAt: Date | null
  reopenReason: string | null
  createdAt: Date
}

export interface SubmissionResultRow {
  id: string
  organizationId: string
  challengeId: string
  snapshotId: string
  submissionId: string
  submissionVersionId: string
  trackId: string | null
  selectionType: 'WINNER' | 'FINALIST' | 'RANKED' | 'HONORABLE_MENTION' | 'DISQUALIFIED'
  rankLabel: string | null
  rank: number | null
  aggregateScore: number | null
  tieBreakDecision: string | null
  createdAt: Date
}

export interface JudgingRepository {
  // --- staff invitations ---------------------------------------------------
  createStaffInvitation(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      role: ChallengeStaffRole
      email?: string
      tokenHash: string
      invitedByUserId: string
      expiresAt: Date
    },
  ): Promise<StaffInvitationRow>
  findStaffInvitationByTokenHash(
    client: PrismaTransactionClient,
    tokenHash: string,
  ): Promise<StaffInvitationRow | null>
  findStaffInvitationById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<StaffInvitationRow | null>
  listStaffInvitations(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<StaffInvitationRow[]>
  setStaffInvitationStatus(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    status: StaffInvitationStatus,
    acceptedByUserId?: string,
  ): Promise<void>

  // --- staff assignments -----------------------------------------------------
  createStaffAssignment(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      userId: string
      role: ChallengeStaffRole
      invitationId?: string
    },
  ): Promise<StaffAssignmentRow>
  findStaffAssignmentById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<StaffAssignmentRow | null>
  findStaffAssignmentByChallengeAndUser(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    userId: string,
  ): Promise<StaffAssignmentRow | null>
  listStaffAssignments(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    filters: { status?: StaffAssignmentStatus; role?: ChallengeStaffRole },
  ): Promise<StaffAssignmentRow[]>
  removeStaffAssignment(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    removedByUserId: string,
  ): Promise<void>

  // --- rubrics -----------------------------------------------------------
  createRubric(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      name: string
      createdByUserId: string
    },
  ): Promise<RubricRow>
  findRubricById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<RubricRow | null>
  listRubrics(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<RubricRow[]>

  createRubricVersion(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      rubricId: string
      challengeId: string
      criteria: RubricCriterion[]
      tieBreakPolicy?: string
      judgeCommentRules?: string
      createdByUserId: string
    },
  ): Promise<RubricVersionRow>
  findRubricVersionById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<RubricVersionRow | null>
  findActiveRubricVersionForChallenge(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<RubricVersionRow | null>
  listRubricVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    rubricId: string,
  ): Promise<RubricVersionRow[]>
  deactivateAllRubricVersions(
    client: PrismaTransactionClient,
    organizationId: string,
    rubricId: string,
  ): Promise<void>
  activateRubricVersion(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<void>

  // --- judge assignments ---------------------------------------------------
  createJudgeAssignment(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      staffAssignmentId: string
      submissionId: string
    },
  ): Promise<JudgeAssignmentRow>
  findJudgeAssignmentById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<JudgeAssignmentRow | null>
  listJudgeAssignmentsForChallenge(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<JudgeAssignmentRow[]>
  listJudgeAssignmentsForStaff(
    client: PrismaTransactionClient,
    organizationId: string,
    staffAssignmentId: string,
  ): Promise<JudgeAssignmentRow[]>
  countLiveAssignmentsForStaff(
    client: PrismaTransactionClient,
    organizationId: string,
    staffAssignmentId: string,
  ): Promise<number>
  setJudgeAssignmentStatus(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    status: JudgeAssignmentStatus,
    timestampField?: 'conflictDeclaredAt' | 'recusedAt',
  ): Promise<void>

  // --- scorecards ----------------------------------------------------------
  createScorecard(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      judgeAssignmentId: string
      rubricVersionId: string
    },
  ): Promise<ScorecardRow>
  findScorecardById(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<ScorecardRow | null>
  findScorecardByAssignment(
    client: PrismaTransactionClient,
    organizationId: string,
    judgeAssignmentId: string,
  ): Promise<ScorecardRow | null>
  listScorecardsForChallenge(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<ScorecardRow[]>
  listScorecardsForSubmission(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    submissionId: string,
  ): Promise<ScorecardRow[]>
  saveScorecardDraft(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    criterionScores: CriterionScore[],
  ): Promise<void>
  submitScorecard(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    input: {
      criterionScores: CriterionScore[]
      totalScore: number
      maxPossibleScore: number
      lock: boolean
    },
  ): Promise<void>
  reopenScorecard(
    client: PrismaTransactionClient,
    organizationId: string,
    id: string,
    reason: string,
  ): Promise<void>

  // --- results -------------------------------------------------------------
  createResult(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      snapshotId: string
      submissionId: string
      submissionVersionId: string
      trackId?: string | null
      selectionType: SubmissionResultRow['selectionType']
      rankLabel: string | null
      rank: number | null
      aggregateScore: number | null
      tieBreakDecision?: string
    },
  ): Promise<void>
  listResultsForChallenge(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<SubmissionResultRow[]>
  findResultForSubmission(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    submissionId: string,
  ): Promise<SubmissionResultRow | null>

  // --- narrow SECURITY DEFINER self lookups -------------------------------
  /** Every live judge assignment for one user, across every organization they judge for. */
  listJudgeAssignmentsAcrossOrgsForUser(
    client: PrismaTransactionClient,
    userId: string,
  ): Promise<(JudgeAssignmentRow & { staffUserId: string })[]>
  /** Resolves a judge assignment's organization + owning staff user, before tenant context is known. */
  findJudgeAssignmentWithOwner(
    client: PrismaTransactionClient,
    id: string,
    userId: string,
  ): Promise<(JudgeAssignmentRow & { staffUserId: string }) | null>
  /** Resolves a scorecard's organization + owning judge, before tenant context is known. */
  findScorecardByAssignmentWithOwner(
    client: PrismaTransactionClient,
    judgeAssignmentId: string,
    userId: string,
  ): Promise<(ScorecardRow & { staffUserId: string }) | null>
}

export function createJudgingRepository(): JudgingRepository {
  return {
    async createStaffInvitation(client, input) {
      return client.challengeStaffInvitation.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          role: input.role,
          email: input.email,
          tokenHash: input.tokenHash,
          invitedByUserId: input.invitedByUserId,
          expiresAt: input.expiresAt,
        },
      }) as unknown as Promise<StaffInvitationRow>
    },

    async findStaffInvitationByTokenHash(client, tokenHash) {
      return client.challengeStaffInvitation.findUnique({
        where: { tokenHash },
      }) as unknown as Promise<StaffInvitationRow | null>
    },

    async findStaffInvitationById(client, organizationId, id) {
      return client.challengeStaffInvitation.findFirst({
        where: { id, organizationId },
      }) as unknown as Promise<StaffInvitationRow | null>
    },

    async listStaffInvitations(client, organizationId, challengeId) {
      const rows = await client.challengeStaffInvitation.findMany({
        where: { organizationId, challengeId },
        orderBy: { createdAt: 'desc' },
      })
      return rows as unknown as StaffInvitationRow[]
    },

    async setStaffInvitationStatus(client, organizationId, id, status, acceptedByUserId) {
      await client.challengeStaffInvitation.updateMany({
        where: { id, organizationId },
        data: { status, respondedAt: new Date(), acceptedByUserId },
      })
    },

    async createStaffAssignment(client, input) {
      return client.challengeStaffAssignment.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          userId: input.userId,
          role: input.role,
          invitationId: input.invitationId,
        },
      })
    },

    async findStaffAssignmentById(client, organizationId, id) {
      return client.challengeStaffAssignment.findFirst({ where: { id, organizationId } })
    },

    async findStaffAssignmentByChallengeAndUser(client, organizationId, challengeId, userId) {
      return client.challengeStaffAssignment.findFirst({
        where: { organizationId, challengeId, userId },
      })
    },

    async listStaffAssignments(client, organizationId, challengeId, filters) {
      return client.challengeStaffAssignment.findMany({
        where: {
          organizationId,
          challengeId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.role ? { role: filters.role } : {}),
        },
        orderBy: { createdAt: 'asc' },
      })
    },

    async removeStaffAssignment(client, organizationId, id, removedByUserId) {
      await client.challengeStaffAssignment.updateMany({
        where: { id, organizationId },
        data: { status: 'REMOVED', removedAt: new Date(), removedByUserId },
      })
    },

    async createRubric(client, input) {
      return client.rubric.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          name: input.name,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findRubricById(client, organizationId, id) {
      return client.rubric.findFirst({ where: { id, organizationId } })
    },

    async listRubrics(client, organizationId, challengeId) {
      return client.rubric.findMany({
        where: { organizationId, challengeId },
        orderBy: { createdAt: 'desc' },
      })
    },

    async createRubricVersion(client, input) {
      await client.$queryRaw`select id from rubric where id = ${input.rubricId}::uuid for update`
      const latest = await client.rubricVersion.findFirst({
        where: { organizationId: input.organizationId, rubricId: input.rubricId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      await client.rubricVersion.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          rubricId: input.rubricId,
          challengeId: input.challengeId,
          version: (latest?.version ?? 0) + 1,
          totalWeight: input.criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
          tieBreakPolicy: input.tieBreakPolicy,
          judgeCommentRules: input.judgeCommentRules,
          createdByUserId: input.createdByUserId,
        },
      })
      await client.rubricCriterion.createMany({
        data: input.criteria.map((criterion, displayOrder) => ({
          id: newId(),
          organizationId: input.organizationId,
          rubricVersionId: input.id,
          key: criterion.key,
          label: criterion.label,
          description: criterion.description,
          minScore: criterion.minScore,
          maxScore: criterion.maxScore,
          weight: criterion.weight,
          displayOrder,
        })),
      })
      const row = await client.rubricVersion.findUniqueOrThrow({
        where: { id: input.id },
        include: rubricVersionInclude,
      })
      return mapRubricVersion(row)
    },

    async findRubricVersionById(client, organizationId, id) {
      return client.rubricVersion
        .findFirst({
          where: { id, organizationId },
          include: rubricVersionInclude,
        })
        .then((row) => (row === null ? null : mapRubricVersion(row)))
    },

    async findActiveRubricVersionForChallenge(client, organizationId, challengeId) {
      const rows = await client.rubricVersion.findMany({
        where: { organizationId, isActive: true, rubric: { challengeId } },
        take: 1,
        include: rubricVersionInclude,
      })
      return rows[0] === undefined ? null : mapRubricVersion(rows[0])
    },

    async listRubricVersions(client, organizationId, rubricId) {
      const rows = await client.rubricVersion.findMany({
        where: { organizationId, rubricId },
        orderBy: { version: 'desc' },
        include: rubricVersionInclude,
      })
      return rows.map(mapRubricVersion)
    },

    async deactivateAllRubricVersions(client, organizationId, rubricId) {
      await client.rubricVersion.updateMany({
        where: { organizationId, rubricId, isActive: true },
        data: { isActive: false },
      })
    },

    async activateRubricVersion(client, organizationId, id) {
      await client.rubricVersion.updateMany({
        where: { id, organizationId },
        data: { isActive: true, activatedAt: new Date() },
      })
    },

    async createJudgeAssignment(client, input) {
      return client.judgeAssignment.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          staffAssignmentId: input.staffAssignmentId,
          submissionId: input.submissionId,
        },
      })
    },

    async findJudgeAssignmentById(client, organizationId, id) {
      return client.judgeAssignment.findFirst({ where: { id, organizationId } })
    },

    async listJudgeAssignmentsForChallenge(client, organizationId, challengeId) {
      return client.judgeAssignment.findMany({
        where: { organizationId, challengeId },
        orderBy: { createdAt: 'asc' },
      })
    },

    async listJudgeAssignmentsForStaff(client, organizationId, staffAssignmentId) {
      return client.judgeAssignment.findMany({
        where: { organizationId, staffAssignmentId },
        orderBy: { createdAt: 'asc' },
      })
    },

    async countLiveAssignmentsForStaff(client, organizationId, staffAssignmentId) {
      return client.judgeAssignment.count({
        where: { organizationId, staffAssignmentId, status: { not: 'REASSIGNED' } },
      })
    },

    async setJudgeAssignmentStatus(client, organizationId, id, status, timestampField) {
      await client.judgeAssignment.updateMany({
        where: { id, organizationId },
        data: {
          status,
          ...(timestampField ? { [timestampField]: new Date() } : {}),
        },
      })
    },

    async createScorecard(client, input) {
      const row = await client.scorecard.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          judgeAssignmentId: input.judgeAssignmentId,
          rubricVersionId: input.rubricVersionId,
        },
        include: scorecardInclude,
      })
      return mapScorecard(row)
    },

    async findScorecardById(client, organizationId, id) {
      return client.scorecard
        .findFirst({
          where: { id, organizationId },
          include: scorecardInclude,
        })
        .then((row) => (row === null ? null : mapScorecard(row)))
    },

    async findScorecardByAssignment(client, organizationId, judgeAssignmentId) {
      return client.scorecard
        .findFirst({
          where: { organizationId, judgeAssignmentId },
          include: scorecardInclude,
        })
        .then((row) => (row === null ? null : mapScorecard(row)))
    },

    async listScorecardsForChallenge(client, organizationId, challengeId) {
      const rows = await client.scorecard.findMany({
        where: { organizationId, challengeId },
        include: scorecardInclude,
      })
      return rows.map(mapScorecard)
    },

    async listScorecardsForSubmission(client, organizationId, challengeId, submissionId) {
      const rows = await client.scorecard.findMany({
        where: {
          organizationId,
          challengeId,
          judgeAssignment: { submissionId },
        },
        include: scorecardInclude,
      })
      return rows.map(mapScorecard)
    },

    async saveScorecardDraft(client, organizationId, id, criterionScores) {
      const scorecard = await client.scorecard.findFirstOrThrow({
        where: { id, organizationId },
        select: { rubricVersionId: true },
      })
      const criteria = await client.rubricCriterion.findMany({
        where: { organizationId, rubricVersionId: scorecard.rubricVersionId },
        select: { id: true, key: true },
      })
      const criterionByKey = new Map(criteria.map((criterion) => [criterion.key, criterion.id]))
      await client.criterionScore.deleteMany({ where: { organizationId, scorecardId: id } })
      if (criterionScores.length > 0) {
        await client.criterionScore.createMany({
          data: criterionScores.map((criterionScore) => ({
            id: newId(),
            organizationId,
            scorecardId: id,
            rubricVersionId: scorecard.rubricVersionId,
            criterionId: criterionByKey.get(criterionScore.criterionKey) as string,
            score: criterionScore.score,
            comment: criterionScore.comment,
          })),
        })
      }
    },

    async submitScorecard(client, organizationId, id, input) {
      await this.saveScorecardDraft(client, organizationId, id, input.criterionScores)
      await client.scorecard.updateMany({
        where: { id, organizationId, status: input.lock ? 'SUBMITTED' : 'DRAFT' },
        data: {
          status: input.lock ? 'LOCKED' : 'SUBMITTED',
          totalScore: input.totalScore,
          maxPossibleScore: input.maxPossibleScore,
          submittedAt: new Date(),
          ...(input.lock ? { lockedAt: new Date() } : {}),
        },
      })
    },

    async reopenScorecard(client, organizationId, id, reason) {
      await client.scorecard.updateMany({
        where: { id, organizationId },
        data: { status: 'DRAFT', reopenedAt: new Date(), reopenReason: reason },
      })
    },

    async createResult(client, input) {
      await client.submissionResult.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          snapshotId: input.snapshotId,
          submissionId: input.submissionId,
          submissionVersionId: input.submissionVersionId,
          trackId: input.trackId,
          selectionType: input.selectionType,
          rankLabel: input.rankLabel,
          rank: input.rank,
          aggregateScore: input.aggregateScore,
          tieBreakDecision: input.tieBreakDecision,
        },
      })
    },

    async listResultsForChallenge(client, organizationId, challengeId) {
      return client.submissionResult.findMany({
        where: { organizationId, challengeId },
        orderBy: [{ rank: 'asc' }, { aggregateScore: 'desc' }],
      })
    },

    async findResultForSubmission(client, organizationId, challengeId, submissionId) {
      return client.submissionResult.findFirst({
        where: { organizationId, challengeId, submissionId },
      })
    },

    async listJudgeAssignmentsAcrossOrgsForUser(client, userId) {
      return client.$queryRaw<(JudgeAssignmentRow & { staffUserId: string })[]>`
        select id, organization_id as "organizationId", challenge_id as "challengeId",
               staff_assignment_id as "staffAssignmentId", submission_id as "submissionId",
               assignment_status as status, conflict_declared_at as "conflictDeclaredAt",
               recused_at as "recusedAt", created_at as "createdAt",
               staff_user_id as "staffUserId"
        from app_list_my_judge_assignments(${userId}::uuid)
      `
    },

    async findJudgeAssignmentWithOwner(client, id, userId) {
      const rows = await client.$queryRaw<(JudgeAssignmentRow & { staffUserId: string })[]>`
        select id, organization_id as "organizationId", challenge_id as "challengeId",
               staff_assignment_id as "staffAssignmentId", submission_id as "submissionId",
               assignment_status as status, conflict_declared_at as "conflictDeclaredAt",
               recused_at as "recusedAt", created_at as "createdAt",
               staff_user_id as "staffUserId"
        from app_find_my_judge_assignment(${id}::uuid, ${userId}::uuid)
      `
      return rows[0] ?? null
    },

    async findScorecardByAssignmentWithOwner(client, judgeAssignmentId, userId) {
      const rows = await client.$queryRaw<(ScorecardRow & { staffUserId: string })[]>`
        select id, organization_id as "organizationId", challenge_id as "challengeId",
               judge_assignment_id as "judgeAssignmentId",
               rubric_version_id as "rubricVersionId", scorecard_status as status,
               total_score as "totalScore", max_possible_score as "maxPossibleScore",
               submitted_at as "submittedAt", locked_at as "lockedAt",
               reopened_at as "reopenedAt", reopen_reason as "reopenReason",
               created_at as "createdAt", staff_user_id as "staffUserId",
               criterion_scores as "criterionScores"
        from app_find_my_scorecard(${judgeAssignmentId}::uuid, ${userId}::uuid)
      `
      return rows[0] ?? null
    },
  }
}
