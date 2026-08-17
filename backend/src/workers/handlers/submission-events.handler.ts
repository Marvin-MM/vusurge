import { notifyUser } from '../../modules/notifications/notify'
import { EmailCategory } from '../../shared/email'
import { enqueueJobEmail } from '../email-obligation'
import type { JobHandler } from '../job-router'

interface SubmissionFinalizedPayload {
  submissionId: string
  challengeId: string
  teamId: string
}

export const handleSubmissionFinalized: JobHandler = async (context) => {
  const payload = context.payload as unknown as SubmissionFinalizedPayload
  const organizationId = context.organizationId
  if (organizationId === null) throw new Error('Submission finalization is missing organizationId.')

  const data = await context.infrastructure.transactions.withTenant(organizationId, async (tx) => {
    const submission = await tx.submission.findFirst({
      where: {
        id: payload.submissionId,
        organizationId,
        challengeId: payload.challengeId,
        teamId: payload.teamId,
        status: 'FINALIZED',
      },
      select: { id: true },
    })
    if (submission === null) return null
    const [challenge, members] = await Promise.all([
      tx.challenge.findUnique({ where: { id: payload.challengeId }, select: { title: true } }),
      tx.challengeTeamMember.findMany({
        where: { organizationId, challengeId: payload.challengeId, teamId: payload.teamId },
        select: { userId: true },
      }),
    ])
    return challenge === null ? null : { challenge, members }
  })
  if (data === null) return

  const users = await context.infrastructure.database.client.user.findMany({
    where: { id: { in: data.members.map((member) => member.userId) } },
    select: { id: true, email: true },
  })
  const subject = `Submission confirmed: ${data.challenge.title}`
  const text = `Your team's final submission for "${data.challenge.title}" was received successfully.`

  await Promise.all(
    users.map(async (user) => {
      await enqueueJobEmail(context, {
        to: user.email,
        recipientUserId: user.id,
        category: EmailCategory.SubmissionConfirmation,
        subject,
        text,
        sourceType: 'submission.finalized',
        sourceKey: `${context.outboxEventId}:${user.id}:submission-confirmation`,
      })
      await notifyUser(context.infrastructure.transactions, {
        userId: user.id,
        sourceKey: `${context.outboxEventId}:${user.id}:submission-finalized-notification`,
        organizationId,
        category: 'SUBMISSION_FINALIZED',
        title: subject,
        body: text,
        linkUrl: `/organizations/${organizationId}/challenges/${payload.challengeId}/submission`,
      })
    }),
  )
}
