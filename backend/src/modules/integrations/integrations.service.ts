import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { AppConfig } from '../../shared/config'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import type { EncryptionService, SealedValue } from '../../shared/encryption'
import { featureDisabled, forbidden, notFound } from '../../shared/errors'
import type { Page, PaginationLimits } from '../../shared/http'
import { toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import { validateIntegrationWebhookUrl } from '../../shared/integrations'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import { assertSafeToFetch } from '../../shared/security'
import type {
  IntegrationDeliveryRow,
  IntegrationRow,
  IntegrationStatus,
  IntegrationsRepository,
} from './integrations.repository'

/**
 * Outbound-only Slack/Discord integrations (master prompt section 18).
 *
 * The webhook URL is never stored or returned in plaintext: `connect`
 * encrypts it before the row is written, and every read-path method
 * (`list`, `get`) returns the row exactly as stored — ciphertext, never
 * `open()`ed. Only `test()` and the (not-yet-built) announcement/reminder
 * fan-out ever decrypt it, and only to make the one outbound call.
 */

function encodeSealed(sealed: SealedValue): string {
  return `${sealed.keyVersion}.${sealed.ciphertext}`
}

function encryptionContext(organizationId: string, integrationId: string): string {
  return `integration:${organizationId}:${integrationId}`
}

export interface IntegrationsService {
  connect(
    access: AccessContext,
    organizationId: string,
    provider: 'SLACK' | 'DISCORD',
    webhookUrl: string,
  ): Promise<IntegrationRow>
  list(access: AccessContext, organizationId: string): Promise<IntegrationRow[]>
  prepareTest(access: AccessContext, organizationId: string): Promise<void>
  test(
    access: AccessContext,
    organizationId: string,
    integrationId: string,
    sourceKey: string,
    transaction: PrismaTransactionClient,
  ): Promise<IntegrationDeliveryRow>
  update(
    access: AccessContext,
    organizationId: string,
    integrationId: string,
    patch: { status?: IntegrationStatus; webhookUrl?: string },
  ): Promise<IntegrationRow>
  remove(access: AccessContext, organizationId: string, integrationId: string): Promise<void>
  listDeliveries(
    access: AccessContext,
    organizationId: string,
    integrationId: string,
    query: { limit?: number; cursor?: string },
  ): Promise<Page<IntegrationDeliveryRow>>
}

export function createIntegrationsService(
  repository: IntegrationsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  encryption: EncryptionService,
  rateLimiter: RateLimiter,
  config: AppConfig,
  limits: PaginationLimits,
): IntegrationsService {
  return {
    async connect(access, organizationId, provider, webhookUrl) {
      authorize(access, Permission.OrganizationManageIntegrations, { requireFreshSession: true })
      if (provider === 'SLACK' && !config.features.slackIntegration) {
        throw featureDisabled('slack_integration')
      }
      if (provider === 'DISCORD' && !config.features.discordIntegration) {
        throw featureDisabled('discord_integration')
      }
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      const providerUrl = validateIntegrationWebhookUrl(provider, webhookUrl)
      const normalized = (await assertSafeToFetch(providerUrl.toString(), 'webhookUrl')).toString()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const current = await repository.findByProvider(tx, organizationId, provider)
          const integrationId = current?.id ?? newId()
          const sealed = encryption.seal(
            normalized,
            encryptionContext(organizationId, integrationId),
          )
          const integration = await repository.upsert(tx, {
            id: integrationId,
            organizationId,
            provider,
            webhookUrlCiphertext: encodeSealed(sealed),
            createdByUserId: actorUserId,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.IntegrationCreated,
            resourceType: 'integration',
            resourceId: integration.id,
            summary: `Connected a ${provider} integration.`,
          })

          return integration
        },
        { actorUserId },
      )
    },

    async list(access, organizationId) {
      authorize(access, Permission.OrganizationManageIntegrations)
      return transactions.withTenant(organizationId, (tx) => repository.list(tx, organizationId))
    },

    async prepareTest(access, organizationId) {
      authorize(access, Permission.OrganizationManageIntegrations, { requireFreshSession: true })
      await rateLimiter.enforce(RateLimitPolicies.IntegrationTest, { organizationId })
    },

    async test(access, organizationId, integrationId, sourceKey, transaction) {
      authorize(access, Permission.OrganizationManageIntegrations, { requireFreshSession: true })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      const integration = await repository.findById(transaction, organizationId, integrationId)
      if (integration === null) throw notFound('Integration not found.')
      if (
        (integration.provider === 'SLACK' && !config.features.slackIntegration) ||
        (integration.provider === 'DISCORD' && !config.features.discordIntegration)
      ) {
        throw featureDisabled(`${integration.provider.toLowerCase()}_integration`)
      }
      if (integration.status !== 'ACTIVE') {
        throw forbidden('This integration is disabled.')
      }

      const delivery = await repository.recordDelivery(transaction, {
        id: newId(),
        organizationId,
        integrationId: integration.id,
        eventType: 'integration.test',
        sourceKey,
        message:
          'This is a test message from your Innovation Platform integration. If you can see this, the connection is working.',
      })
      await audit.write(transaction, {
        organizationId,
        actorType: 'USER',
        actorUserId,
        action: AuditAction.IntegrationDeliveryRequested,
        resourceType: 'integration_delivery',
        resourceId: delivery.id,
        summary: `Queued a test message for the ${integration.provider} integration.`,
      })
      await outbox.write(transaction, {
        eventType: 'integration.delivery_requested',
        queueName: QueueName.Integrations,
        aggregateType: 'integration_delivery',
        aggregateId: delivery.id,
        organizationId,
        payload: { integrationDeliveryId: delivery.id, integrationId: integration.id },
        dedupeKey: `integration-delivery-requested:${delivery.id}`,
      })
      return delivery
    },

    async update(access, organizationId, integrationId, patch) {
      authorize(access, Permission.OrganizationManageIntegrations, { requireFreshSession: true })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      const existing = await transactions.withTenant(organizationId, (tx) =>
        repository.findById(tx, organizationId, integrationId),
      )
      if (existing === null) throw notFound('Integration not found.')
      const safeWebhookUrl =
        patch.webhookUrl === undefined
          ? undefined
          : (
              await assertSafeToFetch(
                validateIntegrationWebhookUrl(existing.provider, patch.webhookUrl).toString(),
                'webhookUrl',
              )
            ).toString()

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const webhookUrlCiphertext =
            safeWebhookUrl === undefined
              ? undefined
              : encodeSealed(
                  encryption.seal(safeWebhookUrl, encryptionContext(organizationId, integrationId)),
                )

          const updated = await repository.update(tx, integrationId, {
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(webhookUrlCiphertext !== undefined ? { webhookUrlCiphertext } : {}),
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action:
              webhookUrlCiphertext !== undefined
                ? AuditAction.IntegrationCredentialRotated
                : AuditAction.IntegrationUpdated,
            resourceType: 'integration',
            resourceId: integrationId,
            summary: `Updated the ${existing.provider} integration.`,
          })

          return updated
        },
        { actorUserId },
      )
    },

    async remove(access, organizationId, integrationId) {
      authorize(access, Permission.OrganizationManageIntegrations, { requireFreshSession: true })
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const existing = await repository.findById(tx, organizationId, integrationId)
          if (existing === null) throw notFound('Integration not found.')

          const replacement = encryption.seal(
            '[deleted integration credential]',
            encryptionContext(organizationId, integrationId),
          )
          await repository.softDelete(tx, organizationId, integrationId, encodeSealed(replacement))

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.IntegrationDeleted,
            resourceType: 'integration',
            resourceId: integrationId,
            summary: `Removed the ${existing.provider} integration.`,
          })
        },
        { actorUserId },
      )
    },

    async listDeliveries(access, organizationId, integrationId, query) {
      authorize(access, Permission.OrganizationManageIntegrations)
      const page = toPageRequest(query, limits)
      return transactions.withTenant(organizationId, async (tx) => {
        const integration = await repository.findById(tx, organizationId, integrationId)
        if (integration === null) throw notFound('Integration not found.')
        return repository.listDeliveries(tx, organizationId, integrationId, page)
      })
    },
  }
}
