import { createHmac } from 'node:crypto'
import type { AppConfig } from '../../shared/config/config.schema'
import type { TenantTransactionRunner } from '../../shared/database'
import { ErrorCode, unauthenticated } from '../../shared/errors'
import { newId } from '../../shared/ids'
import type { Logger } from '../../shared/logging'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { secureCompare } from '../../shared/security'
import type { WebhooksRepository } from './webhooks.repository'

/**
 * Resend webhooks are delivered through Svix, whose documented verification
 * method this implements: HMAC-SHA256 over `{id}.{timestamp}.{body}`, keyed
 * by the base64 portion of the `whsec_...` signing secret, compared against
 * one or more `v1,<signature>` candidates (Svix rotates keys by sending
 * several). A timestamp outside the tolerance window is rejected even with a
 * valid signature, closing the replay window ahead of the receipt's own
 * idempotency check (master prompt section 34.37, threat list item 16).
 */
const REPLAY_TOLERANCE_SECONDS = 300

export interface ResendWebhookHeaders {
  readonly svixId: string | undefined
  readonly svixTimestamp: string | undefined
  readonly svixSignature: string | undefined
}

export interface WebhooksService {
  receiveResendWebhook(rawBody: string, headers: ResendWebhookHeaders): Promise<void>
}

function verifySignature(secret: string, headers: ResendWebhookHeaders, rawBody: string): boolean {
  const { svixId, svixTimestamp, svixSignature } = headers
  if (svixId === undefined || svixTimestamp === undefined || svixSignature === undefined) {
    return false
  }

  const timestampSeconds = Number(svixTimestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > REPLAY_TOLERANCE_SECONDS) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = createHmac('sha256', secretBytes).update(signedContent, 'utf8').digest('base64')

  return svixSignature.split(' ').some((candidate) => {
    const [version, signature] = candidate.split(',')
    return version === 'v1' && signature !== undefined && secureCompare(signature, expected)
  })
}

export function createWebhooksService(
  repository: WebhooksRepository,
  transactions: TenantTransactionRunner,
  outbox: OutboxWriter,
  config: AppConfig,
  logger: Logger,
): WebhooksService {
  return {
    async receiveResendWebhook(rawBody, headers) {
      const secret = config.email.webhookSigningSecret
      if (secret === undefined || !verifySignature(secret, headers, rawBody)) {
        logger.warn(
          { provider: 'resend', svixId: headers.svixId },
          'Rejected a Resend webhook request with an invalid or unverifiable signature',
        )
        throw unauthenticated('Invalid webhook signature.', ErrorCode.WEBHOOK_SIGNATURE_INVALID)
      }

      let event: { type?: unknown; data?: unknown; created_at?: unknown }
      try {
        event = JSON.parse(rawBody) as { type?: unknown; data?: unknown; created_at?: unknown }
      } catch {
        throw unauthenticated('Malformed webhook payload.', ErrorCode.WEBHOOK_SIGNATURE_INVALID)
      }

      const eventType = typeof event.type === 'string' ? event.type : 'unknown'
      // svix-id is Svix's own de-duplication identifier for this delivery,
      // present on every message; verified above so it is trustworthy here.
      const providerEventId = headers.svixId as string

      await transactions.withPlatformAccess(
        async (tx) => {
          const webhookEventId = newId()
          const isNew = await repository.createReceiptIfNew(tx, {
            id: webhookEventId,
            provider: 'resend',
            providerEventId,
            eventType,
            payload: event as Record<string, unknown>,
          })
          // A provider retry or true replay of an already-received event: the
          // receipt row already exists, so there is nothing further to commit
          // in this transaction (master prompt 34.37: replay is a no-op).
          if (!isNew) return

          await outbox.write(tx, {
            eventType: 'webhook.resend_event_received',
            queueName: QueueName.Email,
            aggregateType: 'webhook_event',
            aggregateId: webhookEventId,
            dedupeKey: `webhook-resend-received:${webhookEventId}`,
            payload: {
              webhookEventId,
              eventType,
              data: event.data ?? null,
              providerOccurredAt:
                typeof event.created_at === 'string' ? event.created_at : new Date().toISOString(),
            },
          })
        },
        { purpose: 'Persist a verified provider webhook and its durable processing obligation.' },
      )
    },
  }
}
