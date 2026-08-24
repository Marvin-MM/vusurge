import { notifyUser } from '../../modules/notifications/notify'
import { EmailCategory, EmailTemplates } from '../../shared/email'
import { enqueueJobEmail } from '../email-obligation'
import type { JobHandler } from '../job-router'

interface SupportTicketUpdatedPayload {
  ticketId: string
  userId: string
  subject: string
  summary: string
}

export const handleSupportTicketUpdated: JobHandler = async (context) => {
  const payload = context.payload as unknown as SupportTicketUpdatedPayload
  const user = await context.infrastructure.database.client.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  })
  if (user === null) return

  const ticketUrl = `${context.infrastructure.config.app.webAppBaseUrl}/app/support/${payload.ticketId}`
  const { subject, text } = EmailTemplates.supportTicketUpdateEmail({
    subject: payload.subject,
    summary: payload.summary,
    ticketUrl,
  })

  await enqueueJobEmail(context, {
    to: user.email,
    recipientUserId: payload.userId,
    category: EmailCategory.SupportTicketUpdate,
    subject,
    text,
    sourceType: 'support_ticket.updated',
    sourceKey: `support-ticket-updated:${context.outboxEventId}:${payload.userId}`,
  })

  await notifyUser(context.infrastructure.transactions, {
    userId: payload.userId,
    sourceKey: `${context.outboxEventId}:${payload.userId}:support-update-notification`,
    category: 'SUPPORT_TICKET_UPDATE',
    title: subject,
    body: payload.summary,
    linkUrl: ticketUrl,
  })
}
