import { notifyUser } from '../../modules/notifications/notify'
import { EmailCategory, EmailTemplates } from '../../shared/email'
import { enqueueJobEmail } from '../email-obligation'
import type { JobHandler } from '../job-router'

interface StaffInvitationCreatedPayload {
  email: string
  token: string
  role: string
  challengeTitle: string
}

interface JudgeAssignmentCreatedPayload {
  assignmentId: string
  judgeUserId: string
}

interface ScorecardSubmittedPayload {
  scorecardId: string
  challengeId: string
}

export const handleChallengeStaffInvitationCreated: JobHandler = async (context) => {
  const payload = context.payload as unknown as StaffInvitationCreatedPayload

  const acceptUrl = `${context.infrastructure.config.app.webAppBaseUrl}/challenge-staff-invitations/${payload.token}/accept`
  const { subject, text } = EmailTemplates.challengeStaffInviteEmail({
    challengeTitle: payload.challengeTitle,
    role: payload.role,
    acceptUrl,
  })

  // The invitee may not have an account yet — only fan out an in-app
  // notification when one already exists to receive it.
  const invitee = await context.infrastructure.database.client.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  })
  await enqueueJobEmail(context, {
    to: payload.email,
    ...(invitee === null ? {} : { recipientUserId: invitee.id }),
    category: EmailCategory.ChallengeStaffInvite,
    subject,
    text,
    sourceType: 'challenge.staff_invitation_created',
    sourceKey: `challenge-staff-invitation:${context.outboxEventId}:${payload.email.toLowerCase()}`,
  })
  if (invitee !== null) {
    await notifyUser(context.infrastructure.transactions, {
      userId: invitee.id,
      sourceKey: `${context.outboxEventId}:${invitee.id}:staff-invite-notification`,
      organizationId: context.organizationId ?? undefined,
      category: 'JUDGING_ASSIGNMENT',
      title: subject,
      body: `You've been invited to serve as ${payload.role.toLowerCase()} for "${payload.challengeTitle}".`,
    })
  }
}

export const handleJudgeAssignmentCreated: JobHandler = async (context) => {
  const payload = context.payload as unknown as JudgeAssignmentCreatedPayload
  const user = await context.infrastructure.database.client.user.findUnique({
    where: { id: payload.judgeUserId },
    select: { email: true },
  })
  if (user === null) return

  const { subject, text } = EmailTemplates.judgingAssignmentEmail({
    dashboardUrl: `${context.infrastructure.config.app.webAppBaseUrl}/judging/assignments`,
  })

  await enqueueJobEmail(context, {
    to: user.email,
    recipientUserId: payload.judgeUserId,
    category: EmailCategory.JudgingAssignment,
    subject,
    text,
    sourceType: 'judging.assignment_created',
    sourceKey: `judge-assignment:${context.outboxEventId}:${payload.judgeUserId}`,
  })

  await notifyUser(context.infrastructure.transactions, {
    userId: payload.judgeUserId,
    sourceKey: `${context.outboxEventId}:${payload.judgeUserId}:judge-assignment-notification`,
    organizationId: context.organizationId ?? undefined,
    category: 'JUDGING_ASSIGNMENT',
    title: subject,
    body: text.split('\n')[0] ?? subject,
  })
}

export const handleScorecardSubmitted: JobHandler = async (context) => {
  const payload = context.payload as unknown as ScorecardSubmittedPayload
  const organizationId = context.organizationId
  if (organizationId === null) throw new Error('Scorecard submission is missing organizationId.')

  const recipients = await context.infrastructure.transactions.withTenant(
    organizationId,
    async (tx) => {
      const scorecard = await tx.scorecard.findFirst({
        where: {
          id: payload.scorecardId,
          organizationId,
          challengeId: payload.challengeId,
          status: { in: ['SUBMITTED', 'LOCKED'] },
        },
        select: { id: true },
      })
      if (scorecard === null) return []
      return tx.organizationMembership.findMany({
        where: {
          organizationId,
          status: 'ACTIVE',
          role: { in: ['ORG_OWNER', 'ORG_ADMIN', 'CHALLENGE_MANAGER'] },
        },
        select: { userId: true },
      })
    },
  )

  await Promise.all(
    recipients.map((recipient) =>
      notifyUser(context.infrastructure.transactions, {
        userId: recipient.userId,
        sourceKey: `${context.outboxEventId}:${recipient.userId}:scorecard-progress-notification`,
        organizationId,
        category: 'JUDGING_REMINDER',
        title: 'A judge submitted a scorecard',
        body: 'Judging progress has been updated.',
        linkUrl: `/organizations/${organizationId}/challenges/${payload.challengeId}/judging/progress`,
      }),
    ),
  )
}
