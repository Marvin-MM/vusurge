import { notifyUser } from '../../modules/notifications/notify'
import { EmailCategory } from '../../shared/email'
import { newId } from '../../shared/ids'
import { QueueName } from '../../shared/queue'
import { enqueueJobEmail } from '../email-obligation'
import type { JobContext, JobHandler } from '../job-router'

async function usersById(context: JobContext, ids: readonly string[]) {
  if (ids.length === 0) return []
  return context.infrastructure.database.client.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, email: true },
  })
}

export const handleParticipationDecided: JobHandler = async (context) => {
  if (context.organizationId === null) return
  const payload = context.payload as unknown as {
    participationId: string
    challengeId: string
    status: 'APPROVED' | 'REJECTED' | 'DISQUALIFIED'
  }
  const data = await context.infrastructure.transactions.withTenant(
    context.organizationId,
    async (tx) => {
      const participation = await tx.challengeParticipation.findFirst({
        where: {
          id: payload.participationId,
          challengeId: payload.challengeId,
          organizationId: context.organizationId ?? undefined,
          status: payload.status,
        },
        select: { userId: true, decisionReason: true },
      })
      if (participation === null) return null
      const challenge = await tx.challenge.findUnique({
        where: { id: payload.challengeId },
        select: { title: true },
      })
      return challenge === null ? null : { participation, challenge }
    },
  )
  if (data === null) return
  const [user] = await usersById(context, [data.participation.userId])
  if (user === undefined) return
  const decision = payload.status.toLowerCase()
  const subject = `Challenge participation ${decision}: ${data.challenge.title}`
  const text = [
    subject,
    ...(data.participation.decisionReason ? ['', data.participation.decisionReason] : []),
  ].join('\n')
  const sourceKey = `${context.eventType}:${context.outboxEventId}:${user.id}`
  await enqueueJobEmail(context, {
    to: user.email,
    recipientUserId: user.id,
    category: EmailCategory.ParticipationDecision,
    subject,
    text,
    sourceType: context.eventType,
    sourceKey,
  })
  await notifyUser(context.infrastructure.transactions, {
    userId: user.id,
    organizationId: context.organizationId,
    category: 'PARTICIPATION_DECISION',
    title: subject,
    body: data.participation.decisionReason ?? `Your application was ${decision}.`,
    sourceKey,
  })
}

export const handleTeamMembershipChanged: JobHandler = async (context) => {
  if (context.organizationId === null) return
  const payload = context.payload as unknown as {
    teamId: string
    teamName: string
    challengeId: string
    affectedUserId: string
    action: 'JOINED' | 'LEFT' | 'REMOVED' | 'CAPTAIN_TRANSFERRED'
  }
  const label = {
    JOINED: `You joined team "${payload.teamName}".`,
    LEFT: `You left ${payload.teamName}.`,
    REMOVED: `You were removed from team "${payload.teamName}".`,
    CAPTAIN_TRANSFERRED: `You are now captain of team "${payload.teamName}".`,
  }[payload.action]
  await notifyUser(context.infrastructure.transactions, {
    userId: payload.affectedUserId,
    organizationId: context.organizationId,
    category: 'TEAM_MEMBERSHIP_CHANGE',
    title: 'Team membership changed',
    body: label,
    linkUrl: `/organizations/${context.organizationId}/challenges/${payload.challengeId}/teams/${payload.teamId}`,
    sourceKey: `${context.eventType}:${context.outboxEventId}:${payload.affectedUserId}`,
  })
}

export const handleAnnouncementPublished: JobHandler = async (context) => {
  if (context.organizationId === null) return
  const payload = context.payload as unknown as { announcementId: string }
  const data = await context.infrastructure.transactions.withTenant(
    context.organizationId,
    async (tx) => {
      const announcement = await tx.announcement.findFirst({
        where: {
          id: payload.announcementId,
          organizationId: context.organizationId ?? undefined,
          isPublished: true,
        },
      })
      if (announcement === null) return null
      const now = await context.infrastructure.transactions.databaseNow(tx)
      if (announcement.expiresAt !== null && announcement.expiresAt <= now) return null

      const recipients =
        announcement.audience === 'CHALLENGE_PARTICIPANTS' && announcement.challengeId !== null
          ? await tx.challengeParticipation.findMany({
              where: {
                organizationId: context.organizationId ?? undefined,
                challengeId: announcement.challengeId,
                status: 'APPROVED',
              },
              select: { userId: true },
            })
          : await tx.organizationMembership.findMany({
              where: { organizationId: context.organizationId ?? undefined, status: 'ACTIVE' },
              select: { userId: true },
            })

      if (announcement.deliverIntegration) {
        const integrations = await tx.integration.findMany({
          where: { organizationId: context.organizationId ?? undefined, status: 'ACTIVE' },
          select: { id: true },
        })
        for (const integration of integrations) {
          const sourceKey = `announcement:${announcement.id}:${integration.id}`
          const delivery = await tx.integrationDelivery.upsert({
            where: { sourceKey },
            create: {
              id: newId(),
              organizationId: context.organizationId ?? '',
              integrationId: integration.id,
              eventType: 'announcement.published',
              sourceKey,
              message: `${announcement.title}\n\n${announcement.body}`.slice(0, 4000),
            },
            update: {},
          })
          await context.infrastructure.outbox.write(tx, {
            eventType: 'integration.delivery_requested',
            queueName: QueueName.Integrations,
            aggregateType: 'integration_delivery',
            aggregateId: delivery.id,
            organizationId: context.organizationId ?? undefined,
            dedupeKey: `integration-delivery-requested:${delivery.id}`,
            payload: {
              integrationDeliveryId: delivery.id,
              integrationId: integration.id,
            },
          })
        }
      }
      return { announcement, recipientIds: recipients.map((row) => row.userId) }
    },
  )
  if (data === null) return

  const users = await usersById(context, data.recipientIds)
  await Promise.all(
    users.map(async (user) => {
      const sourceKey = `${context.eventType}:${context.outboxEventId}:${user.id}`
      if (data.announcement.deliverEmail) {
        await enqueueJobEmail(context, {
          to: user.email,
          recipientUserId: user.id,
          category: EmailCategory.Announcement,
          subject: data.announcement.title,
          text: data.announcement.body,
          sourceType: context.eventType,
          sourceKey,
        })
      }
      if (data.announcement.deliverInApp) {
        await notifyUser(context.infrastructure.transactions, {
          userId: user.id,
          organizationId: context.organizationId ?? undefined,
          category: 'ANNOUNCEMENT',
          title: data.announcement.title,
          body: data.announcement.body.slice(0, 2000),
          sourceKey,
        })
      }
    }),
  )
}

export const handleFeedbackReleased: JobHandler = async (context) => {
  if (context.organizationId === null) return
  const payload = context.payload as unknown as { challengeId: string }
  const data = await context.infrastructure.transactions.withTenant(
    context.organizationId,
    async (tx) => {
      const challenge = await tx.challenge.findFirst({
        where: {
          id: payload.challengeId,
          organizationId: context.organizationId ?? undefined,
          feedbackReleasedAt: { not: null },
        },
        select: { title: true },
      })
      if (challenge === null) return null
      const participants = await tx.challengeParticipation.findMany({
        where: {
          organizationId: context.organizationId ?? undefined,
          challengeId: payload.challengeId,
          status: 'APPROVED',
        },
        select: { userId: true },
      })
      return { challenge, recipientIds: participants.map((row) => row.userId) }
    },
  )
  if (data === null) return
  const users = await usersById(context, data.recipientIds)
  const subject = `Judge feedback is available: ${data.challenge.title}`
  await Promise.all(
    users.map(async (user) => {
      const sourceKey = `${context.eventType}:${context.outboxEventId}:${user.id}`
      await enqueueJobEmail(context, {
        to: user.email,
        recipientUserId: user.id,
        category: EmailCategory.FeedbackReleased,
        subject,
        text: `${subject}\n\nSign in to view feedback for your submission.`,
        sourceType: context.eventType,
        sourceKey,
      })
      await notifyUser(context.infrastructure.transactions, {
        userId: user.id,
        organizationId: context.organizationId ?? undefined,
        category: 'FEEDBACK_RELEASED',
        title: subject,
        body: 'Sign in to view feedback for your submission.',
        sourceKey,
      })
    }),
  )
}
