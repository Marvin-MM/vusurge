import type { NotificationCategory } from '../../modules/notifications/notifications.repository'
import { notifyUser } from '../../modules/notifications/notify'
import { EmailCategory, EmailTemplates } from '../../shared/email'
import { enqueueJobEmail } from '../email-obligation'
import type { JobContext, JobHandler } from '../job-router'

/**
 * Handlers for challenge lifecycle outbox events that affect people who have
 * already registered. Every approved participant is notified by email and,
 * where the category is not one of the always-on ones, an in-app
 * notification that respects their preference.
 */

interface ChallengeScheduleEventPayload {
  challengeId: string
  organizationId: string
}

async function notifyApprovedParticipants(
  context: JobContext,
  payload: ChallengeScheduleEventPayload,
  build: (challengeTitle: string) => { subject: string; text: string },
  emailCategory: (typeof EmailCategory)[keyof typeof EmailCategory],
  notificationCategory: NotificationCategory,
  linkUrl = '/app/my-challenges',
): Promise<void> {
  const client = context.infrastructure.database.client

  // Challenge and participation are tenant-owned RLS tables. A worker uses
  // exactly the same transaction-scoped tenant context as the HTTP path; the
  // ambient Prisma client intentionally cannot see these rows under the
  // runtime role.
  const tenantData = await context.infrastructure.transactions.withTenant(
    payload.organizationId,
    async (tx) => {
      const challenge = await tx.challenge.findFirst({
        where: { id: payload.challengeId, organizationId: payload.organizationId },
        select: { title: true },
      })
      if (challenge === null) return null

      const participants = await tx.challengeParticipation.findMany({
        where: {
          organizationId: payload.organizationId,
          challengeId: payload.challengeId,
          status: 'APPROVED',
        },
        select: { userId: true },
      })
      return { challenge, participants }
    },
  )
  if (tenantData === null) return

  const { challenge, participants } = tenantData
  if (participants.length === 0) return

  const users = await client.user.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, email: true },
  })

  const { subject, text } = build(challenge.title)

  await Promise.all(
    users.map(async (user) => {
      await enqueueJobEmail(context, {
        to: user.email,
        recipientUserId: user.id,
        category: emailCategory,
        subject,
        text,
        sourceType: context.eventType,
        sourceKey: `${context.eventType}:${context.outboxEventId}:${user.id}`,
      })

      await notifyUser(context.infrastructure.transactions, {
        userId: user.id,
        sourceKey: `${context.outboxEventId}:${user.id}:${notificationCategory.toLowerCase()}`,
        organizationId: payload.organizationId,
        category: notificationCategory,
        title: subject,
        body: text.split('\n')[0] ?? subject,
        linkUrl,
      })
    }),
  )
}

function scheduleChangeEmail(challengeTitle: string): { subject: string; text: string } {
  return {
    subject: `Schedule change: ${challengeTitle}`,
    text: [
      `The schedule for "${challengeTitle}" has changed.`,
      '',
      'Check the challenge page for the updated dates.',
    ].join('\n'),
  }
}

export const handleChallengeRescheduled: JobHandler = async (context) => {
  const payload = context.payload as unknown as ChallengeScheduleEventPayload
  await notifyApprovedParticipants(
    context,
    payload,
    scheduleChangeEmail,
    EmailCategory.DeadlineChanged,
    'DEADLINE_CHANGED',
  )
}

export const handleChallengeDeadlineExtended: JobHandler = async (context) => {
  const payload = context.payload as unknown as ChallengeScheduleEventPayload & {
    newDeadline: string
  }
  await notifyApprovedParticipants(
    context,
    payload,
    (title) => ({
      subject: `Deadline extended: ${title}`,
      text: [
        `The submission deadline for "${title}" has been extended.`,
        '',
        `New deadline: ${payload.newDeadline}`,
      ].join('\n'),
    }),
    EmailCategory.DeadlineChanged,
    'DEADLINE_CHANGED',
  )
}

export const handleChallengeReopened: JobHandler = async (context) => {
  const payload = context.payload as unknown as ChallengeScheduleEventPayload & {
    newDeadline: string
  }
  await notifyApprovedParticipants(
    context,
    payload,
    (title) => ({
      subject: `Reopened for submissions: ${title}`,
      text: [
        `"${title}" has reopened for submissions.`,
        '',
        `New deadline: ${payload.newDeadline}`,
      ].join('\n'),
    }),
    EmailCategory.DeadlineChanged,
    'DEADLINE_CHANGED',
  )
}

export const handleChallengeCancelled: JobHandler = async (context) => {
  const payload = context.payload as unknown as ChallengeScheduleEventPayload & { reason?: string }
  await notifyApprovedParticipants(
    context,
    payload,
    (title) => ({
      subject: `Cancelled: ${title}`,
      text: [
        `"${title}" has been cancelled.`,
        ...(payload.reason !== undefined ? ['', payload.reason] : []),
      ].join('\n'),
    }),
    EmailCategory.DeadlineChanged,
    'DEADLINE_CHANGED',
  )
}

/** No recipients exist at publish time in the ordinary flow; still a real, complete handler. */
export const handleChallengePublished: JobHandler = async (context) => {
  const payload = context.payload as unknown as ChallengeScheduleEventPayload
  await notifyApprovedParticipants(
    context,
    payload,
    (title) => ({
      subject: `Now open: ${title}`,
      text: [`"${title}" is now open for registration.`].join('\n'),
    }),
    EmailCategory.DeadlineChanged,
    'DEADLINE_CHANGED',
  )
}

export const handleResultsPublished: JobHandler = async (context) => {
  const payload = context.payload as unknown as ChallengeScheduleEventPayload
  const webAppBaseUrl = context.infrastructure.config.app.webAppBaseUrl
  await notifyApprovedParticipants(
    context,
    payload,
    (title) =>
      EmailTemplates.resultsPublishedEmail({
        challengeTitle: title,
        resultsUrl: `${webAppBaseUrl}/app/results`,
      }),
    EmailCategory.ResultsPublished,
    'RESULTS_PUBLISHED',
    '/app/results',
  )
}
