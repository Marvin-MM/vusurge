import { AuditAction } from '../../shared/audit'
import { newId } from '../../shared/ids'
import type { JobHandler } from '../job-router'

interface ResendWebhookEventReceivedPayload {
  webhookEventId: string
  eventType: string
  data: unknown
  providerOccurredAt: string
}

function extractRecipients(data: unknown): string[] {
  if (data === null || typeof data !== 'object') return []
  const to = (data as Record<string, unknown>).to
  if (typeof to === 'string') return [to]
  if (Array.isArray(to)) return to.filter((value): value is string => typeof value === 'string')
  return []
}

function providerMessageId(data: unknown): string | null {
  if (data === null || typeof data !== 'object') return null
  const value = (data as Record<string, unknown>).email_id
  return typeof value === 'string' && value.length > 0 ? value : null
}

function deliveryStatus(eventType: string) {
  if (eventType === 'email.bounced') return 'BOUNCED' as const
  if (eventType === 'email.complained') return 'COMPLAINED' as const
  if (eventType === 'email.failed') return 'FAILED' as const
  if (eventType === 'email.suppressed') return 'SUPPRESSED' as const
  if (eventType === 'email.sent' || eventType === 'email.delivered') return 'SENT' as const
  return null
}

/**
 * Processes a persisted Resend webhook event asynchronously (master prompt
 * 34.37: the route only verifies the signature and persists the receipt;
 * every consequence happens here). Only bounce and complaint events have a
 * consequence — they suppress future sends to the affected address. Delivery
 * state is updated by provider event time, so a delayed older webhook cannot
 * overwrite a newer bounce/complaint/result.
 */
export const handleResendWebhookEventReceived: JobHandler = async (context) => {
  const payload = context.payload as unknown as ResendWebhookEventReceivedPayload

  const reason =
    payload.eventType === 'email.bounced'
      ? ('BOUNCE' as const)
      : payload.eventType === 'email.complained'
        ? ('COMPLAINT' as const)
        : null
  const occurredAtCandidate = new Date(payload.providerOccurredAt)
  const occurredAt = Number.isNaN(occurredAtCandidate.getTime()) ? new Date() : occurredAtCandidate
  const messageId = providerMessageId(payload.data)
  const status = deliveryStatus(payload.eventType)

  await context.infrastructure.transactions.withPlatformAccess(
    async (tx) => {
      if (reason !== null) {
        for (const email of extractRecipients(payload.data)) {
          // Use the row's real id — an existing suppression (a second bounce
          // for the same address) is updated in place, not re-created, so the
          // audited resourceId must come from the upsert result, not a
          // freshly generated id that would only be correct on first insert.
          const suppression = await tx.emailSuppression.upsert({
            where: { email },
            create: { id: newId(), email, reason },
            update: { reason },
          })

          await context.infrastructure.audit.write(tx, {
            actorType: 'SYSTEM',
            action: AuditAction.EmailSuppressed,
            resourceType: 'email_suppression',
            resourceId: suppression.id,
            summary: `Suppressed ${email} after a Resend "${payload.eventType}" event.`,
          })
        }
      }

      if (messageId !== null && status !== null) {
        await tx.emailDelivery.updateMany({
          where: {
            providerMessageId: messageId,
            OR: [{ lastProviderEventAt: null }, { lastProviderEventAt: { lt: occurredAt } }],
            ...(status === 'SENT' ? { status: { notIn: ['BOUNCED', 'COMPLAINED'] } } : {}),
          },
          data: {
            status,
            lastProviderEventAt: occurredAt,
            ...(status === 'SENT' ? { sentAt: occurredAt } : {}),
          },
        })
      }

      await tx.webhookEvent.update({
        where: { id: payload.webhookEventId },
        data: { processedAt: await context.infrastructure.transactions.databaseNow(tx) },
      })
    },
    { purpose: 'Apply a verified provider webhook to global email delivery state.' },
  )
}
