import { AuditAction } from '../../shared/audit'
import type { SealedValue } from '../../shared/encryption'
import { newId } from '../../shared/ids'
import type { JobHandler } from '../job-router'

interface IntegrationDeliveryRequestedPayload {
  integrationDeliveryId: string
  integrationId: string
}

function decodeSealed(stored: string): SealedValue {
  const separator = stored.indexOf('.')
  return {
    keyVersion: Number(stored.slice(0, separator)),
    ciphertext: stored.slice(separator + 1),
  }
}

function encryptionContext(organizationId: string, integrationId: string): string {
  return `integration:${organizationId}:${integrationId}`
}

export const handleIntegrationDeliveryRequested: JobHandler = async (context) => {
  const payload = context.payload as unknown as IntegrationDeliveryRequestedPayload
  const organizationId = context.organizationId
  if (organizationId === null) throw new Error('Integration delivery is missing organizationId.')

  const claimed = await context.infrastructure.transactions.withTenant(
    organizationId,
    async (tx) => {
      await tx.$queryRaw`select id from integration_delivery where id = ${payload.integrationDeliveryId}::uuid for update`
      const delivery = await tx.integrationDelivery.findFirst({
        where: {
          id: payload.integrationDeliveryId,
          organizationId,
          integrationId: payload.integrationId,
        },
      })
      if (delivery === null || delivery.status === 'SUCCEEDED' || delivery.status === 'FAILED') {
        return null
      }
      const integration = await tx.integration.findFirst({
        where: { id: payload.integrationId, organizationId },
      })
      const attemptNumber = delivery.attempts + 1
      const attemptId = newId()
      const now = await context.infrastructure.transactions.databaseNow(tx)
      await tx.integrationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENDING', attempts: attemptNumber, lastAttemptAt: now },
      })
      await tx.integrationDeliveryAttempt.create({
        data: {
          id: attemptId,
          organizationId,
          integrationDeliveryId: delivery.id,
          attemptNumber,
        },
      })
      return { delivery, integration, attemptId }
    },
    { isolationLevel: 'Serializable' },
  )
  if (claimed === null) return

  let result = {
    succeeded: false,
    retryable: false,
    responseStatus: null as number | null,
    errorMessage: 'Integration no longer exists or is disabled.' as string | null,
  }
  if (claimed.integration?.status === 'ACTIVE') {
    const webhookUrl = context.infrastructure.encryption.open(
      decodeSealed(claimed.integration.webhookUrlCiphertext),
      encryptionContext(organizationId, claimed.integration.id),
    )
    result = await context.infrastructure.integrationWebhookTransport.send(
      claimed.integration.provider,
      webhookUrl,
      claimed.delivery.message,
    )
  }

  const finalAttempt =
    !result.retryable || context.attempt >= context.infrastructure.config.worker.outbox.maxAttempts
  await context.infrastructure.transactions.withTenant(organizationId, async (tx) => {
    const now = await context.infrastructure.transactions.databaseNow(tx)
    await tx.integrationDeliveryAttempt.update({
      where: { id: claimed.attemptId },
      data: {
        outcome: result.succeeded
          ? 'SUCCEEDED'
          : finalAttempt
            ? 'PERMANENT_FAILURE'
            : 'RETRYABLE_FAILURE',
        responseStatus: result.responseStatus,
        errorMessage: result.errorMessage,
        finishedAt: now,
      },
    })
    await tx.integrationDelivery.update({
      where: { id: claimed.delivery.id },
      data: result.succeeded
        ? {
            status: 'SUCCEEDED',
            succeeded: true,
            responseStatus: result.responseStatus,
            errorMessage: null,
            completedAt: now,
          }
        : finalAttempt
          ? {
              status: 'FAILED',
              succeeded: false,
              responseStatus: result.responseStatus,
              errorMessage: result.errorMessage,
              completedAt: now,
            }
          : {
              status: 'PENDING',
              succeeded: null,
              responseStatus: result.responseStatus,
              errorMessage: result.errorMessage,
              completedAt: null,
            },
    })

    if (result.succeeded || finalAttempt) {
      await context.infrastructure.audit.write(tx, {
        organizationId,
        actorType: 'SYSTEM',
        action: AuditAction.IntegrationTested,
        resourceType: 'integration_delivery',
        resourceId: claimed.delivery.id,
        summary: result.succeeded
          ? `Delivered ${claimed.delivery.eventType} to ${claimed.integration?.provider ?? 'integration'}.`
          : `Integration delivery failed permanently: ${result.errorMessage ?? 'unknown error'}`,
      })
    }
  })

  if (!result.succeeded && !finalAttempt) {
    throw new Error(result.errorMessage ?? 'Retryable integration delivery failure.')
  }
}
