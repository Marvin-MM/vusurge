import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Client } from 'pg'
import { createVerifiedUser } from '../helpers/auth-flow'
import { flushOutbox } from '../helpers/outbox-flush'
import { createPlatformSuperadmin } from '../helpers/platform-fixtures'
import { createTestApp, type TestApp } from '../helpers/test-app'
import { connectMigrationSql, resetDatabase } from '../helpers/test-database'

/**
 * Phase 4 judging: staff invitations, rubric versioning, judge assignments,
 * scorecards with server-computed weighted totals, judging/results
 * finalization, and feedback release (master prompt section 17).
 */

let app: TestApp
let migration: Client

beforeAll(async () => {
  app = await createTestApp()
  migration = await connectMigrationSql()
})

afterAll(async () => {
  await app.dispose()
  await migration.end()
})

beforeEach(async () => {
  await resetDatabase(migration)
})

async function setupFinalizedSubmission(): Promise<{
  owner: { cookie: string }
  organizationId: string
  challengeId: string
  submissionId: string
  participant: { cookie: string; userId: string; email: string }
}> {
  const owner = await createVerifiedUser(app)
  const slug = `judge-org-${crypto.randomUUID().slice(0, 8)}`
  const application = await app.request<{ id: string }>(
    'POST',
    '/api/v1/organization-applications',
    {
      body: {
        name: `Judging Org ${crypto.randomUUID()}`,
        requestedSlug: slug,
        organizationType: 'COMPANY',
        description: 'A judging-module fixture organization.',
        requesterRelationship: 'Founder',
        requestedVisibility: 'PRIVATE',
        acceptedTermsVersion: '1.0',
      },
      headers: { 'idempotency-key': crypto.randomUUID() },
      cookies: owner.cookie,
    },
  )
  const superadmin = await createPlatformSuperadmin(app)
  const approval = await app.request<{ organizationId: string }>(
    'POST',
    `/api/v1/platform/organization-applications/${application.body.id}/approve`,
    { body: {}, cookies: superadmin.cookie },
  )
  const organizationId = approval.body.organizationId

  const created = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges`,
    {
      body: {
        title: 'Judged Challenge',
        slug: `judged-challenge-${crypto.randomUUID().slice(0, 6)}`,
        participationPolicy: 'OPEN_AUTHENTICATED',
        minTeamSize: 1,
        maxTeamSize: 3,
      },
      cookies: owner.cookie,
    },
  )
  const challengeId = created.body.id
  const submissionDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/reschedule`,
    { body: { submissionDeadline, reason: 'Set the initial deadline.' }, cookies: owner.cookie },
  )
  await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/publish`,
    { body: {}, cookies: owner.cookie },
  )

  const participant = await createVerifiedUser(app)
  const registered = await app.request<{ status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
    { body: {}, cookies: participant.cookie },
  )
  expect(registered.body.status).toBe('APPROVED')

  const submission = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions`,
    { cookies: participant.cookie },
  )
  await app.request(
    'PATCH',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submission.body.id}/draft`,
    {
      body: { title: 'A great idea', problemStatement: 'x', solutionDescription: 'y' },
      cookies: participant.cookie,
    },
  )
  const finalized = await app.request<{ status: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submission.body.id}/finalize`,
    { headers: { 'idempotency-key': crypto.randomUUID() }, cookies: participant.cookie },
  )
  expect(finalized.body.status).toBe('FINALIZED')

  return {
    owner,
    organizationId,
    challengeId,
    submissionId: submission.body.id,
    participant: {
      cookie: participant.cookie,
      userId: participant.userId,
      email: participant.email,
    },
  }
}

async function inviteAndAcceptJudge(
  owner: { cookie: string },
  organizationId: string,
  challengeId: string,
): Promise<{ cookie: string; userId: string; staffAssignmentId: string }> {
  const judge = await createVerifiedUser(app)
  const invitation = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/staff-invitations`,
    { body: { role: 'JUDGE', email: judge.email }, cookies: owner.cookie },
  )
  expect(invitation.status).toBe(201)

  await flushOutbox(app.infrastructure)
  const sent = app.infrastructure.fakeEmail.latestTo(judge.email)
  expect(sent).toBeDefined()
  const acceptUrl = app.infrastructure.fakeEmail.extractUrl(sent as NonNullable<typeof sent>)
  const token = new URL(acceptUrl).pathname.split('/').at(-2)

  const accepted = await app.request<{ id: string }>(
    'POST',
    `/api/v1/challenge-staff-invitations/${token}/accept`,
    { cookies: judge.cookie },
  )
  expect(accepted.status).toBe(200)

  return { cookie: judge.cookie, userId: judge.userId, staffAssignmentId: accepted.body.id }
}

async function activatedRubric(
  owner: { cookie: string },
  organizationId: string,
  challengeId: string,
): Promise<void> {
  const rubric = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/rubrics`,
    { body: { name: 'Main Rubric' }, cookies: owner.cookie },
  )
  const version = await app.request<{ id: string }>(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/rubrics/${rubric.body.id}/versions`,
    {
      body: {
        criteria: [
          { key: 'innovation', label: 'Innovation', minScore: 0, maxScore: 10, weight: 2 },
          { key: 'execution', label: 'Execution', minScore: 0, maxScore: 10, weight: 1 },
        ],
      },
      cookies: owner.cookie,
    },
  )
  const activated = await app.request(
    'POST',
    `/api/v1/organizations/${organizationId}/challenges/${challengeId}/rubrics/${rubric.body.id}/versions/${version.body.id}/activate`,
    { cookies: owner.cookie },
  )
  expect(activated.status).toBe(200)
}

describe('judging: staff invitations', () => {
  test('invite, accept, and list staff', async () => {
    const { owner, organizationId, challengeId } = await setupFinalizedSubmission()
    const judge = await inviteAndAcceptJudge(owner, organizationId, challengeId)
    expect(judge.staffAssignmentId).toBeTruthy()

    const staff = await app.request<{ userId: string; role: string }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/staff`,
      { cookies: owner.cookie },
    )
    expect(staff.status).toBe(200)
    expect(staff.body).toHaveLength(1)
    expect(staff.body[0]?.role).toBe('JUDGE')
  })
})

describe('judging: rubrics and scoring', () => {
  test('full workflow: assign → score → submit → finalize judging → finalize/publish results → release feedback', async () => {
    const { owner, organizationId, challengeId, submissionId, participant } =
      await setupFinalizedSubmission()
    const judge = await inviteAndAcceptJudge(owner, organizationId, challengeId)

    // Assigning before any rubric is active is rejected.
    const assignWithoutRubric = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judge-assignments`,
      { body: { staffAssignmentId: judge.staffAssignmentId, submissionId }, cookies: owner.cookie },
    )
    expect(assignWithoutRubric.status).toBe(409)

    await activatedRubric(owner, organizationId, challengeId)

    const assignment = await app.request<{ id: string; status: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judge-assignments`,
      { body: { staffAssignmentId: judge.staffAssignmentId, submissionId }, cookies: owner.cookie },
    )
    expect(assignment.status).toBe(201)
    expect(assignment.body.status).toBe('ASSIGNED')

    // The judge sees it in their own cross-organization assignment list.
    const myAssignments = await app.request<
      { id: string; organizationId: string; challengeId: string }[]
    >('GET', '/api/v1/judging/assignments', {
      cookies: judge.cookie,
    })
    expect(myAssignments.status).toBe(200)
    expect(myAssignments.body.map((a) => a.id)).toContain(assignment.body.id)
    // organizationId must be present so a judge UI can resolve org-scoped
    // detail routes from a bare assignment (previously fetched but dropped
    // by the serializer).
    const ownAssignment = myAssignments.body.find((a) => a.id === assignment.body.id)
    expect(ownAssignment?.organizationId).toBe(organizationId)
    expect(ownAssignment?.challengeId).toBe(challengeId)

    // An assigned judge can view the submission they're scoring, even
    // though they hold no organization membership and no
    // submission.view_all permission — access is granted purely by the
    // active judge assignment (previously a 404 for any non-owner/non-staff
    // actor, which made scoring impossible in practice).
    const judgeSubmissionView = await app.request<{ id: string }>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}`,
      { cookies: judge.cookie },
    )
    expect(judgeSubmissionView.status).toBe(200)
    expect(judgeSubmissionView.body.id).toBe(submissionId)

    // A different, non-owning judge cannot see or score this assignment.
    const otherJudge = await inviteAndAcceptJudge(owner, organizationId, challengeId)
    const forbiddenGet = await app.request(
      'GET',
      `/api/v1/judging/assignments/${assignment.body.id}/scorecard`,
      { cookies: otherJudge.cookie },
    )
    expect(forbiddenGet.status).toBe(404)

    // ...nor can they view the submission itself — they hold a judge
    // assignment for this challenge, but not for this specific submission.
    const otherJudgeSubmissionView = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}`,
      { cookies: otherJudge.cookie },
    )
    expect(otherJudgeSubmissionView.status).toBe(403)

    const draft = await app.request<{ status: string }>(
      'PATCH',
      `/api/v1/judging/assignments/${assignment.body.id}/scorecard`,
      {
        body: { criterionScores: [{ criterionKey: 'innovation', score: 8 }] },
        cookies: judge.cookie,
      },
    )
    expect(draft.status).toBe(200)
    expect(draft.body.status).toBe('DRAFT')

    // Re-fetching the scorecard must succeed even though the just-saved
    // criterion score has no comment. GET .../scorecard is served by a
    // different (raw-SQL) repository path than the PATCH/submit responses,
    // which previously returned `comment: null` instead of omitting the key
    // — a shape the response schema rejected outright with a 422, making it
    // impossible for a judge to ever reload their own in-progress scorecard.
    const reGet = await app.request<{
      criterionScores: { criterionKey: string; comment?: string | null }[]
    }>('GET', `/api/v1/judging/assignments/${assignment.body.id}/scorecard`, {
      cookies: judge.cookie,
    })
    expect(reGet.status).toBe(200)
    const innovationScore = reGet.body.criterionScores.find((c) => c.criterionKey === 'innovation')
    expect(innovationScore?.comment ?? null).toBeNull()

    // Submitting without every criterion scored is rejected.
    const incompleteSubmit = await app.request(
      'POST',
      `/api/v1/judging/assignments/${assignment.body.id}/scorecard/submit`,
      {
        body: { criterionScores: [{ criterionKey: 'innovation', score: 8 }] },
        cookies: judge.cookie,
      },
    )
    expect(incompleteSubmit.status).toBe(400)

    // 8*2 (innovation) + 6*1 (execution) = 22, out of a max of 10*2+10*1=30.
    // Exact integer arithmetic — asserted precisely, not approximately.
    const submitted = await app.request<{
      status: string
      totalScore: number
      maxPossibleScore: number
    }>('POST', `/api/v1/judging/assignments/${assignment.body.id}/scorecard/submit`, {
      body: {
        criterionScores: [
          { criterionKey: 'innovation', score: 8 },
          { criterionKey: 'execution', score: 6 },
        ],
      },
      cookies: judge.cookie,
    })
    expect(submitted.status).toBe(200)
    expect(submitted.body.status).toBe('SUBMITTED')
    expect(submitted.body.totalScore).toBe(22)
    expect(submitted.body.maxPossibleScore).toBe(30)

    const organizerAssignments = await app.request<
      { id: string; scorecardId: string | null; scorecardStatus: string | null }[]
    >(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judge-assignments`,
      { cookies: owner.cookie },
    )
    expect(organizerAssignments.status).toBe(200)
    expect(organizerAssignments.body.find((item) => item.id === assignment.body.id)).toMatchObject({
      scorecardId: expect.any(String),
      scorecardStatus: 'SUBMITTED',
    })

    // Progress shows aggregate counts only.
    const progress = await app.request<{ submittedCount: number; totalAssignments: number }>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judging/progress`,
      { cookies: owner.cookie },
    )
    expect(progress.status).toBe(200)
    expect(progress.body.totalAssignments).toBe(1)
    expect(progress.body.submittedCount).toBe(1)

    const judgingFinalized = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judging/finalize`,
      { cookies: owner.cookie },
    )
    expect(judgingFinalized.status).toBe(204)

    // The scorecard is now locked and cannot be edited without a reopen.
    const editAfterFinalize = await app.request(
      'PATCH',
      `/api/v1/judging/assignments/${assignment.body.id}/scorecard`,
      { body: { criterionScores: [] }, cookies: judge.cookie },
    )
    expect(editAfterFinalize.status).toBe(409)

    const resultsFinalized = await app.request<
      { id: string; rank: number; aggregateScore: number }[]
    >(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/results/finalize`,
      {
        body: {
          selections: [
            {
              submissionId,
              selectionType: 'WINNER',
              rank: 1,
              rankLabel: 'Winner',
            },
          ],
        },
        cookies: owner.cookie,
      },
    )
    expect(resultsFinalized.status).toBe(200)
    expect(resultsFinalized.body).toHaveLength(1)
    expect(resultsFinalized.body[0]?.rank).toBe(1)
    expect(resultsFinalized.body[0]?.aggregateScore).toBe(22)

    const duplicateFinalize = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/results/finalize`,
      {
        body: {
          selections: [{ submissionId, selectionType: 'WINNER', rank: 1 }],
        },
        cookies: owner.cookie,
      },
    )
    expect(duplicateFinalize.status).toBe(409)

    await expect(
      app.infrastructure.transactions.withTenant(organizationId, (tx) =>
        tx.submissionResult.update({
          where: { id: resultsFinalized.body[0]?.id as string },
          data: { rank: 2 },
        }),
      ),
    ).rejects.toThrow('finalized result decisions are immutable')

    const published = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/results/publish`,
      {
        headers: { 'idempotency-key': crypto.randomUUID() },
        cookies: owner.cookie,
      },
    )
    expect(published.status).toBe(204)

    // Feedback is not visible before release.
    const feedbackBeforeRelease = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/feedback`,
      { cookies: participant.cookie },
    )
    expect(feedbackBeforeRelease.status).toBe(409)

    const released = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/feedback/release`,
      { cookies: owner.cookie },
    )
    expect(released.status).toBe(204)
    await flushOutbox(app.infrastructure)
    expect(app.infrastructure.fakeEmail.latestTo(participant.email)?.subject).toContain(
      'Judge feedback is available',
    )
    const feedbackNotifications = await app.request<{ items: { category: string }[] }>(
      'GET',
      '/api/v1/me/notifications',
      { cookies: participant.cookie },
    )
    expect(
      feedbackNotifications.body.items.some(
        (notification) => notification.category === 'FEEDBACK_RELEASED',
      ),
    ).toBe(true)

    const feedback = await app.request<{ totalScore: number }[]>(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/feedback`,
      { cookies: participant.cookie },
    )
    expect(feedback.status).toBe(200)
    expect(feedback.body).toHaveLength(1)
    expect(feedback.body[0]?.totalScore).toBe(22)

    // An unrelated user cannot view this team's feedback.
    const stranger = await createVerifiedUser(app)
    const strangerFeedback = await app.request(
      'GET',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/feedback`,
      { cookies: stranger.cookie },
    )
    expect(strangerFeedback.status).toBe(403)
  })

  test('a judge cannot be assigned to their own rubric-less challenge twice, and reassignment blocks once scored', async () => {
    const { owner, organizationId, challengeId, submissionId } = await setupFinalizedSubmission()
    const judge = await inviteAndAcceptJudge(owner, organizationId, challengeId)
    await activatedRubric(owner, organizationId, challengeId)

    const assignment = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judge-assignments`,
      { body: { staffAssignmentId: judge.staffAssignmentId, submissionId }, cookies: owner.cookie },
    )
    expect(assignment.status).toBe(201)

    await app.request(
      'POST',
      `/api/v1/judging/assignments/${assignment.body.id}/scorecard/submit`,
      {
        body: {
          criterionScores: [
            { criterionKey: 'innovation', score: 5 },
            { criterionKey: 'execution', score: 5 },
          ],
        },
        cookies: judge.cookie,
      },
    )

    const otherJudge = await inviteAndAcceptJudge(owner, organizationId, challengeId)
    const reassign = await app.request(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judge-assignments/${assignment.body.id}/reassign`,
      {
        body: {
          newStaffAssignmentId: otherJudge.staffAssignmentId,
          reason: 'Testing reassignment blocking.',
        },
        cookies: owner.cookie,
      },
    )
    expect(reassign.status).toBe(409)
  })

  test('declare-conflict and recuse are self-service and ownership-checked', async () => {
    const { owner, organizationId, challengeId, submissionId } = await setupFinalizedSubmission()
    const judge = await inviteAndAcceptJudge(owner, organizationId, challengeId)
    await activatedRubric(owner, organizationId, challengeId)

    const assignment = await app.request<{ id: string }>(
      'POST',
      `/api/v1/organizations/${organizationId}/challenges/${challengeId}/judge-assignments`,
      { body: { staffAssignmentId: judge.staffAssignmentId, submissionId }, cookies: owner.cookie },
    )

    const otherJudge = await inviteAndAcceptJudge(owner, organizationId, challengeId)
    const forbiddenConflict = await app.request(
      'POST',
      `/api/v1/judging/assignments/${assignment.body.id}/declare-conflict`,
      { cookies: otherJudge.cookie },
    )
    expect(forbiddenConflict.status).toBe(404)

    const conflict = await app.request<{ status: string }>(
      'POST',
      `/api/v1/judging/assignments/${assignment.body.id}/declare-conflict`,
      { cookies: judge.cookie },
    )
    expect(conflict.status).toBe(200)
    expect(conflict.body.status).toBe('CONFLICT_DECLARED')

    const recused = await app.request<{ status: string }>(
      'POST',
      `/api/v1/judging/assignments/${assignment.body.id}/recuse`,
      { cookies: judge.cookie },
    )
    expect(recused.status).toBe(200)
    expect(recused.body.status).toBe('RECUSED')
  })
})
