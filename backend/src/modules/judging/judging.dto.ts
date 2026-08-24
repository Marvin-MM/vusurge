import { t } from 'elysia'
import { ActionReason, Uuid } from '../../shared/http'

const ChallengeStaffRole = t.Union([t.Literal('JUDGE'), t.Literal('MENTOR')])
const StaffInvitationStatus = t.Union([
  t.Literal('PENDING'),
  t.Literal('ACCEPTED'),
  t.Literal('DECLINED'),
  t.Literal('REVOKED'),
  t.Literal('EXPIRED'),
])
const StaffAssignmentStatus = t.Union([t.Literal('ACTIVE'), t.Literal('REMOVED')])
const JudgeAssignmentStatus = t.Union([
  t.Literal('ASSIGNED'),
  t.Literal('CONFLICT_DECLARED'),
  t.Literal('RECUSED'),
  t.Literal('REASSIGNED'),
])
const ScorecardStatus = t.Union([t.Literal('DRAFT'), t.Literal('SUBMITTED'), t.Literal('LOCKED')])

// --- staff invitations / assignments ----------------------------------------

export const CreateStaffInvitationBody = t.Object({
  role: ChallengeStaffRole,
  email: t.Optional(t.String({ format: 'email', maxLength: 320 })),
})

export const StaffInvitationResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  role: ChallengeStaffRole,
  email: t.Union([t.String(), t.Null()]),
  status: StaffInvitationStatus,
  expiresAt: t.String(),
  createdAt: t.String(),
})
export const StaffInvitationListResponse = t.Array(StaffInvitationResponse)

export const StaffAssignmentResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  userId: Uuid,
  role: ChallengeStaffRole,
  status: StaffAssignmentStatus,
  createdAt: t.String(),
})
export const StaffAssignmentListResponse = t.Array(StaffAssignmentResponse)

// --- rubrics -----------------------------------------------------------------

export const CreateRubricBody = t.Object({ name: t.String({ minLength: 2, maxLength: 200 }) })

export const RubricResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  name: t.String(),
  createdAt: t.String(),
})
export const RubricListResponse = t.Array(RubricResponse)

const RubricCriterionSchema = t.Object({
  key: t.String({ minLength: 1, maxLength: 60, pattern: '^[a-zA-Z][a-zA-Z0-9_]*$' }),
  label: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 1000 })),
  minScore: t.Integer(),
  maxScore: t.Integer(),
  weight: t.Integer({ minimum: 1 }),
})

export const CreateRubricVersionBody = t.Object({
  criteria: t.Array(RubricCriterionSchema, { minItems: 1, maxItems: 30 }),
  tieBreakPolicy: t.Optional(t.String({ maxLength: 1000 })),
  judgeCommentRules: t.Optional(t.String({ maxLength: 1000 })),
})

export const RubricVersionResponse = t.Object({
  id: Uuid,
  rubricId: Uuid,
  version: t.Integer(),
  criteria: t.Array(RubricCriterionSchema),
  tieBreakPolicy: t.Union([t.String(), t.Null()]),
  judgeCommentRules: t.Union([t.String(), t.Null()]),
  isActive: t.Boolean(),
  activatedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})
export const RubricVersionListResponse = t.Array(RubricVersionResponse)

// --- judge assignments ---------------------------------------------------------

export const CreateJudgeAssignmentBody = t.Object({ staffAssignmentId: Uuid, submissionId: Uuid })

export const JudgeAssignmentResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  organizationId: Uuid,
  staffAssignmentId: Uuid,
  submissionId: Uuid,
  status: JudgeAssignmentStatus,
  scorecardId: t.Union([Uuid, t.Null()]),
  scorecardStatus: t.Union([ScorecardStatus, t.Null()]),
  createdAt: t.String(),
})
export const JudgeAssignmentListResponse = t.Array(JudgeAssignmentResponse)

export const ReassignJudgeAssignmentBody = t.Object({
  newStaffAssignmentId: Uuid,
  reason: ActionReason,
})

// --- scorecards --------------------------------------------------------------

const CriterionScoreSchema = t.Object({
  criterionKey: t.String({ minLength: 1, maxLength: 60 }),
  score: t.Integer(),
  comment: t.Optional(t.String({ maxLength: 2000 })),
})

// Output only: some scorecard read paths (the raw-SQL `app_find_my_scorecard`
// function backing the judge's own GET/PATCH/submit routes) return `comment`
// as an explicit `null` rather than omitting the key, unlike the
// Prisma-relation path which normalizes null away. The response schema must
// accept both shapes.
const CriterionScoreOutputSchema = t.Object({
  criterionKey: t.String({ minLength: 1, maxLength: 60 }),
  score: t.Integer(),
  comment: t.Optional(t.Union([t.String({ maxLength: 2000 }), t.Null()])),
})

export const SaveScorecardBody = t.Object({
  criterionScores: t.Array(CriterionScoreSchema, { maxItems: 30 }),
})

export const ScorecardResponse = t.Object({
  id: Uuid,
  judgeAssignmentId: Uuid,
  rubricVersionId: Uuid,
  status: ScorecardStatus,
  criterionScores: t.Array(CriterionScoreOutputSchema),
  totalScore: t.Union([t.Integer(), t.Null()]),
  maxPossibleScore: t.Union([t.Integer(), t.Null()]),
  submittedAt: t.Union([t.String(), t.Null()]),
  lockedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const ReopenScorecardBody = t.Object({ reason: ActionReason })

export const JudgingProgressResponse = t.Object({
  totalAssignments: t.Integer(),
  draftCount: t.Integer(),
  submittedCount: t.Integer(),
  lockedCount: t.Integer(),
  conflictCount: t.Integer(),
  recusedCount: t.Integer(),
})

// --- results and feedback -----------------------------------------------------

export const ResultSelectionType = t.Union([
  t.Literal('WINNER'),
  t.Literal('FINALIST'),
  t.Literal('RANKED'),
  t.Literal('HONORABLE_MENTION'),
  t.Literal('DISQUALIFIED'),
])

export const FinalizeResultsBody = t.Object({
  selections: t.Array(
    t.Object({
      submissionId: Uuid,
      selectionType: ResultSelectionType,
      rank: t.Optional(t.Integer({ minimum: 1 })),
      rankLabel: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
      tieBreakDecision: t.Optional(t.String({ minLength: 1, maxLength: 2000 })),
    }),
    { minItems: 1, maxItems: 1000 },
  ),
})

export const SubmissionResultResponse = t.Object({
  id: Uuid,
  snapshotId: Uuid,
  challengeId: Uuid,
  submissionId: Uuid,
  submissionVersionId: Uuid,
  trackId: t.Union([Uuid, t.Null()]),
  selectionType: ResultSelectionType,
  rankLabel: t.Union([t.String(), t.Null()]),
  rank: t.Union([t.Integer(), t.Null()]),
  aggregateScore: t.Union([t.Integer(), t.Null()]),
  tieBreakDecision: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})
export const SubmissionResultListResponse = t.Array(SubmissionResultResponse)

export const RetractResultsBody = t.Object({ reason: ActionReason })

export const FeedbackEntryResponse = t.Object({
  criterionScores: t.Array(CriterionScoreOutputSchema),
  totalScore: t.Union([t.Integer(), t.Null()]),
  maxPossibleScore: t.Union([t.Integer(), t.Null()]),
})
export const FeedbackListResponse = t.Array(FeedbackEntryResponse)
