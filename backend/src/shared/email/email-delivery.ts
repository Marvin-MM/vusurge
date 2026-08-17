import { createHash } from 'node:crypto'
import type { AppConfig } from '../config/config.schema'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../database'
import type { EncryptionService } from '../encryption'
import { newId } from '../ids'
import { describeError, type Logger } from '../logging'
import type { OutboxWriter } from '../outbox'
import { QueueName } from '../queue'
import {
  type EmailMessage,
  type EmailProvider,
  isRetryableEmailProviderError,
} from './email-provider'

const DELIVERY_LEASE_FLOOR_MS = 60_000

export interface EmailDeliveryInput extends EmailMessage {
  readonly organizationId?: string
  readonly recipientUserId?: string
  /** Stable semantic origin such as `auth.verification` or `submission.finalized`. */
  readonly sourceType: string
  /** Stable per-recipient identity for the logical message. */
  readonly sourceKey: string
}

export interface EmailDeliveryManager {
  /** Persist the encrypted obligation and its outbox event in the caller's transaction. */
  enqueue(tx: PrismaTransactionClient, input: EmailDeliveryInput): Promise<string>
  /** Claim and execute one persisted obligation. Safe under duplicate workers. */
  deliver(deliveryId: string, organizationId: string | null, workerAttempt: number): Promise<void>
}

function contentHash(input: EmailDeliveryInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.organizationId ?? null,
        input.recipientUserId ?? null,
        input.to.trim().toLowerCase(),
        input.category,
        input.subject,
        input.text,
        input.disableTracking === true,
        input.sourceType,
      ]),
    )
    .digest('hex')
}

function bodyContext(deliveryId: string): string {
  return `email-delivery:${deliveryId}:body`
}

function validateInput(input: EmailDeliveryInput): void {
  if (input.sourceKey.length < 1 || input.sourceKey.length > 255) {
    throw new Error('Email delivery sourceKey must contain between 1 and 255 characters.')
  }
  if (input.sourceType.length < 1 || input.sourceType.length > 80) {
    throw new Error('Email delivery sourceType must contain between 1 and 80 characters.')
  }
  if (input.to.length > 320 || input.subject.length > 500) {
    throw new Error('Email delivery recipient or subject exceeds the database contract.')
  }
}

export function createEmailDeliveryManager(dependencies: {
  transactions: TenantTransactionRunner
  outbox: OutboxWriter
  encryption: EncryptionService
  provider: EmailProvider
  config: AppConfig
  logger: Logger
}): EmailDeliveryManager {
  const { transactions, outbox, encryption, provider, config, logger } = dependencies

  function inScope<T>(
    organizationId: string | null,
    work: (tx: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    if (organizationId !== null) {
      return transactions.withTenant(organizationId, work, {
        isolationLevel: 'Serializable',
      })
    }
    return transactions.withPlatformAccess(work, {
      purpose: 'Process a global authentication or system email delivery obligation.',
      isolationLevel: 'Serializable',
    })
  }

  return {
    async enqueue(tx, input) {
      validateInput(input)
      const id = newId()
      const sealed = encryption.seal(input.text, bodyContext(id))
      const expectedHash = contentHash(input)

      const delivery = await tx.emailDelivery.upsert({
        where: { sourceKey: input.sourceKey },
        create: {
          id,
          organizationId: input.organizationId,
          recipientUserId: input.recipientUserId,
          recipientEmail: input.to.trim().toLowerCase(),
          category: input.category,
          subject: input.subject,
          bodyCiphertext: sealed.ciphertext,
          bodyKeyVersion: sealed.keyVersion,
          disableTracking: input.disableTracking === true,
          sourceType: input.sourceType,
          sourceKey: input.sourceKey,
          contentHash: expectedHash,
        },
        update: {},
        select: { id: true, contentHash: true },
      })

      if (delivery.contentHash !== expectedHash) {
        throw new Error(
          `Email delivery source key "${input.sourceKey}" was reused for different content.`,
        )
      }

      await outbox.write(tx, {
        eventType: 'email.delivery_requested',
        queueName: QueueName.Email,
        aggregateType: 'email_delivery',
        aggregateId: delivery.id,
        organizationId: input.organizationId,
        dedupeKey: `email-delivery-requested:${delivery.id}`,
        payload: { emailDeliveryId: delivery.id },
      })
      return delivery.id
    },

    async deliver(deliveryId, organizationId, workerAttempt) {
      const claim = await inScope(organizationId, async (tx) => {
        await tx.$queryRaw`select id from email_delivery where id = ${deliveryId}::uuid for update`
        const delivery = await tx.emailDelivery.findUnique({ where: { id: deliveryId } })
        if (delivery === null) {
          throw new Error(`Email delivery ${deliveryId} does not exist in the declared scope.`)
        }
        if (['SENT', 'SUPPRESSED', 'BOUNCED', 'COMPLAINED', 'FAILED'].includes(delivery.status)) {
          return null
        }

        const now = await transactions.databaseNow(tx)
        if (
          delivery.status === 'SENDING' &&
          delivery.leaseExpiresAt !== null &&
          delivery.leaseExpiresAt > now
        ) {
          throw new EmailDeliveryBusyError(deliveryId)
        }

        const attemptNumber = delivery.attempts + 1
        const attemptId = newId()
        const leaseMs = Math.max(
          DELIVERY_LEASE_FLOOR_MS,
          config.email.requestTimeoutMs * config.email.maxAttempts + 10_000,
        )
        await tx.emailDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'SENDING',
            attempts: attemptNumber,
            leaseExpiresAt: new Date(now.getTime() + leaseMs),
            lastError: null,
          },
        })
        await tx.emailDeliveryAttempt.create({
          data: {
            id: attemptId,
            emailDeliveryId: deliveryId,
            attemptNumber,
          },
        })

        return {
          attemptId,
          attemptNumber,
          recipientEmail: delivery.recipientEmail,
          category: delivery.category,
          subject: delivery.subject,
          text: encryption.open(
            {
              ciphertext: delivery.bodyCiphertext,
              keyVersion: delivery.bodyKeyVersion,
            },
            bodyContext(delivery.id),
          ),
          sourceKey: delivery.sourceKey,
          disableTracking: delivery.disableTracking,
        }
      })

      if (claim === null) return

      try {
        const result = await provider.send({
          to: claim.recipientEmail,
          category: claim.category as EmailMessage['category'],
          subject: claim.subject,
          text: claim.text,
          idempotencyKey: claim.sourceKey,
          disableTracking: claim.disableTracking,
        })

        await inScope(organizationId, async (tx) => {
          const now = await transactions.databaseNow(tx)
          await tx.emailDeliveryAttempt.update({
            where: { id: claim.attemptId },
            data: {
              outcome: result.suppressed ? 'SUPPRESSED' : 'SENT',
              providerMessageId: result.providerMessageId,
              finishedAt: now,
            },
          })
          await tx.emailDelivery.updateMany({
            where: {
              id: deliveryId,
              status: 'SENDING',
              attempts: claim.attemptNumber,
            },
            data: {
              status: result.suppressed ? 'SUPPRESSED' : 'SENT',
              providerMessageId: result.suppressed ? null : result.providerMessageId,
              sentAt: result.suppressed ? null : now,
              leaseExpiresAt: null,
              nextAttemptAt: now,
              lastError: null,
            },
          })
        })
      } catch (error) {
        const finalAttempt =
          !isRetryableEmailProviderError(error) || workerAttempt >= config.worker.outbox.maxAttempts
        const message = (error instanceof Error ? error.message : 'Email provider failed').slice(
          0,
          1000,
        )
        await inScope(organizationId, async (tx) => {
          const now = await transactions.databaseNow(tx)
          const delayMs = Math.min(1_000 * 2 ** Math.max(workerAttempt - 1, 0), 60_000)
          await tx.emailDeliveryAttempt.update({
            where: { id: claim.attemptId },
            data: {
              outcome: finalAttempt ? 'PERMANENT_FAILURE' : 'RETRYABLE_FAILURE',
              error: message,
              finishedAt: now,
            },
          })
          await tx.emailDelivery.updateMany({
            where: {
              id: deliveryId,
              status: 'SENDING',
              attempts: claim.attemptNumber,
            },
            data: {
              status: finalAttempt ? 'FAILED' : 'PENDING',
              lastError: message,
              leaseExpiresAt: null,
              nextAttemptAt: new Date(now.getTime() + delayMs),
            },
          })
        })
        logger.error(
          { err: describeError(error), emailDeliveryId: deliveryId, workerAttempt },
          'Email delivery attempt failed',
        )
        throw error
      }
    },
  }
}

export class EmailDeliveryBusyError extends Error {
  constructor(deliveryId: string) {
    super(`Email delivery ${deliveryId} is already leased by another worker.`)
    this.name = 'EmailDeliveryBusyError'
  }
}
