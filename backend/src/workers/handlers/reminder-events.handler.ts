import { notifyUser } from '../../modules/notifications/notify'
import { EmailCategory } from '../../shared/email'
import { enqueueJobEmail } from '../email-obligation'
import type { JobHandler } from '../job-router'

interface ReminderDuePayload {
  reminderScheduleId: string
  revision: number
}

export const handleReminderDue: JobHandler = async (context) => {
  const payload = context.payload as unknown as ReminderDuePayload
  if (context.organizationId === null) return

  const data = await context.infrastructure.transactions.withTenant(
    context.organizationId,
    async (tx) => {
      const schedule = await tx.reminderSchedule.findFirst({
        where: {
          id: payload.reminderScheduleId,
          organizationId: context.organizationId ?? undefined,
          status: 'SENT',
          revision: payload.revision,
          lastDispatchedRevision: payload.revision,
        },
      })
      if (schedule === null) return null

      if (schedule.kind === 'PORTFOLIO_REVIEW') {
        if (schedule.innovationId === null) return null
        const innovation = await tx.innovation.findFirst({
          where: {
            id: schedule.innovationId,
            organizationId: context.organizationId ?? undefined,
          },
          select: { id: true, title: true, ownerUserId: true },
        })
        if (innovation === null) return null
        return {
          schedule,
          title: innovation.title,
          linkUrl: `/organizations/${context.organizationId}/innovations/${innovation.id}`,
          recipientIds: innovation.ownerUserId === null ? [] : [innovation.ownerUserId],
        }
      }

      if (schedule.challengeId === null) return null

      const challenge = await tx.challenge.findFirst({
        where: { id: schedule.challengeId, organizationId: context.organizationId ?? undefined },
        select: { id: true, title: true },
      })
      if (challenge === null) return null

      const recipientIds = new Set<string>()
      if (schedule.kind === 'REGISTRATION_DEADLINE') {
        const members = await tx.organizationMembership.findMany({
          where: { organizationId: context.organizationId ?? undefined, status: 'ACTIVE' },
          select: { userId: true },
        })
        for (const member of members) recipientIds.add(member.userId)
      } else if (schedule.kind === 'SUBMISSION_DEADLINE') {
        const participants = await tx.challengeParticipation.findMany({
          where: {
            organizationId: context.organizationId ?? undefined,
            challengeId: challenge.id,
            status: 'APPROVED',
          },
          select: { userId: true },
        })
        for (const participant of participants) recipientIds.add(participant.userId)
      } else if (schedule.kind === 'JUDGING_DEADLINE') {
        const judges = await tx.challengeStaffAssignment.findMany({
          where: {
            organizationId: context.organizationId ?? undefined,
            challengeId: challenge.id,
            role: 'JUDGE',
            status: 'ACTIVE',
          },
          select: { userId: true },
        })
        for (const judge of judges) recipientIds.add(judge.userId)
      }

      return {
        schedule,
        title: challenge.title,
        linkUrl: `/organizations/${context.organizationId}/challenges/${challenge.id}`,
        recipientIds: [...recipientIds],
      }
    },
  )
  if (data === null || data.recipientIds.length === 0) return

  const users = await context.infrastructure.database.client.user.findMany({
    where: { id: { in: data.recipientIds } },
    select: { id: true, email: true },
  })
  const isJudging = data.schedule.kind === 'JUDGING_DEADLINE'
  const isPortfolio = data.schedule.kind === 'PORTFOLIO_REVIEW'
  const targetLabel = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(data.schedule.targetAt)
  const subject = isPortfolio
    ? `Portfolio review reminder: ${data.title}`
    : isJudging
      ? `Judging deadline reminder: ${data.title}`
      : `${data.schedule.kind === 'REGISTRATION_DEADLINE' ? 'Registration' : 'Submission'} deadline reminder: ${data.title}`
  const text = `${subject}\n\n${isPortfolio ? 'Review date' : 'Deadline'}: ${targetLabel} (UTC)`
  const category = isJudging ? EmailCategory.JudgingReminder : EmailCategory.DeadlineReminder
  const notificationCategory = isPortfolio
    ? 'PORTFOLIO_UPDATE'
    : isJudging
      ? 'JUDGING_REMINDER'
      : 'DEADLINE_REMINDER'

  await Promise.all(
    users.map(async (user) => {
      const sourceKey = `reminder:${data.schedule.id}:${payload.revision}:${user.id}`
      await enqueueJobEmail(context, {
        to: user.email,
        recipientUserId: user.id,
        category,
        subject,
        text,
        sourceType: 'reminder.due',
        sourceKey,
      })
      await notifyUser(context.infrastructure.transactions, {
        userId: user.id,
        organizationId: context.organizationId ?? undefined,
        category: notificationCategory,
        title: subject,
        body: `${isPortfolio ? 'Review date' : 'Deadline'}: ${targetLabel} (UTC)`,
        linkUrl: data.linkUrl,
        sourceKey,
      })
    }),
  )
}
