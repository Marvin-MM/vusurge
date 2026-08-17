import type { AccessContext } from '../../shared/authorization'
import { badRequest } from '../../shared/errors'
import type { Page } from '../../shared/http'
import type { IdempotencyStore } from '../../shared/idempotency'
import { hashToken } from '../../shared/security'
import type {
  IntegrationDeliveryRow,
  IntegrationRow,
  IntegrationStatus,
} from './integrations.repository'
import type { IntegrationsService } from './integrations.service'

function serialize(row: IntegrationRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeDelivery(row: IntegrationDeliveryRow) {
  return {
    id: row.id,
    integrationId: row.integrationId,
    eventType: row.eventType,
    status: row.status,
    attempts: row.attempts,
    succeeded: row.succeeded,
    responseStatus: row.responseStatus,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeDeliveryPage(page: Page<IntegrationDeliveryRow>) {
  return {
    items: page.items.map(serializeDelivery),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

export function createIntegrationsController(
  service: IntegrationsService,
  idempotency: IdempotencyStore,
) {
  return {
    async connect(
      access: AccessContext,
      organizationId: string,
      provider: 'SLACK' | 'DISCORD',
      webhookUrl: string,
    ) {
      return serialize(await service.connect(access, organizationId, provider, webhookUrl))
    },

    async list(access: AccessContext, organizationId: string) {
      const rows = await service.list(access, organizationId)
      return rows.map(serialize)
    },

    async test(
      access: AccessContext,
      organizationId: string,
      integrationId: string,
      idempotencyKey: string | undefined,
    ) {
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw badRequest('An authenticated actor is required.')
      if (idempotencyKey === undefined) {
        throw badRequest('An Idempotency-Key header is required for this operation.')
      }
      await service.prepareTest(access, organizationId)
      const result = await idempotency.run(
        {
          actorUserId,
          operation: 'integration.test',
          key: idempotencyKey,
          organizationId,
          requestBody: { organizationId, integrationId },
        },
        async (tx) => ({
          status: 202,
          body: serializeDelivery(
            await service.test(
              access,
              organizationId,
              integrationId,
              `integration-test:${integrationId}:${hashToken(idempotencyKey).slice(0, 32)}`,
              tx,
            ),
          ),
        }),
      )
      return { status: result.status, body: result.value }
    },

    async update(
      access: AccessContext,
      organizationId: string,
      integrationId: string,
      patch: { status?: IntegrationStatus; webhookUrl?: string },
    ) {
      return serialize(await service.update(access, organizationId, integrationId, patch))
    },

    async remove(access: AccessContext, organizationId: string, integrationId: string) {
      await service.remove(access, organizationId, integrationId)
    },

    async listDeliveries(
      access: AccessContext,
      organizationId: string,
      integrationId: string,
      query: { limit?: number; cursor?: string },
    ) {
      return serializeDeliveryPage(
        await service.listDeliveries(access, organizationId, integrationId, query),
      )
    },
  }
}

export type IntegrationsController = ReturnType<typeof createIntegrationsController>
