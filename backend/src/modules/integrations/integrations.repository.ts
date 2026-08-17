import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type IntegrationProvider = 'SLACK' | 'DISCORD'
export type IntegrationStatus = 'ACTIVE' | 'DISABLED'
type StoredIntegrationStatus = IntegrationStatus | 'DELETED'

export interface IntegrationRow {
  id: string
  organizationId: string
  provider: IntegrationProvider
  webhookUrlCiphertext: string
  status: IntegrationStatus
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}

interface StoredIntegrationRow extends Omit<IntegrationRow, 'status'> {
  status: StoredIntegrationStatus
}

function asVisibleIntegration(row: StoredIntegrationRow): IntegrationRow {
  if (row.status === 'DELETED') {
    throw new Error('A deleted integration reached a public repository result.')
  }
  return row as IntegrationRow
}

export interface IntegrationDeliveryRow {
  id: string
  organizationId: string
  integrationId: string
  eventType: string
  status: 'PENDING' | 'SENDING' | 'SUCCEEDED' | 'FAILED'
  attempts: number
  succeeded: boolean | null
  responseStatus: number | null
  errorMessage: string | null
  createdAt: Date
}

export interface IntegrationsRepository {
  upsert(
    tx: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      provider: IntegrationProvider
      webhookUrlCiphertext: string
      createdByUserId: string
    },
  ): Promise<IntegrationRow>
  findById(
    tx: PrismaTransactionClient,
    organizationId: string,
    id: string,
  ): Promise<IntegrationRow | null>
  findByProvider(
    tx: PrismaTransactionClient,
    organizationId: string,
    provider: IntegrationProvider,
  ): Promise<StoredIntegrationRow | null>
  list(tx: PrismaTransactionClient, organizationId: string): Promise<IntegrationRow[]>
  update(
    tx: PrismaTransactionClient,
    id: string,
    patch: { status?: IntegrationStatus; webhookUrlCiphertext?: string },
  ): Promise<IntegrationRow>
  softDelete(
    tx: PrismaTransactionClient,
    organizationId: string,
    id: string,
    replacementCiphertext: string,
  ): Promise<void>
  recordDelivery(
    tx: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      integrationId: string
      eventType: string
      sourceKey: string
      message: string
    },
  ): Promise<IntegrationDeliveryRow>
  listDeliveries(
    tx: PrismaTransactionClient,
    organizationId: string,
    integrationId: string,
    page: PageRequest,
  ): Promise<Page<IntegrationDeliveryRow>>
}

export function createIntegrationsRepository(): IntegrationsRepository {
  return {
    async upsert(tx, input) {
      const row = await tx.integration.upsert({
        where: {
          organizationId_provider: {
            organizationId: input.organizationId,
            provider: input.provider,
          },
        },
        create: {
          id: input.id,
          organizationId: input.organizationId,
          provider: input.provider,
          webhookUrlCiphertext: input.webhookUrlCiphertext,
          createdByUserId: input.createdByUserId,
        },
        update: {
          webhookUrlCiphertext: input.webhookUrlCiphertext,
          status: 'ACTIVE',
        },
      })
      return asVisibleIntegration(row)
    },

    async findById(tx, organizationId, id) {
      const row = await tx.integration.findFirst({
        where: { id, organizationId, status: { not: 'DELETED' } },
      })
      return row === null ? null : asVisibleIntegration(row)
    },

    async findByProvider(tx, organizationId, provider) {
      return tx.integration.findFirst({ where: { organizationId, provider } })
    },

    async list(tx, organizationId) {
      const rows = await tx.integration.findMany({
        where: { organizationId, status: { not: 'DELETED' } },
        orderBy: { createdAt: 'asc' },
      })
      return rows.map(asVisibleIntegration)
    },

    async update(tx, id, patch) {
      return asVisibleIntegration(await tx.integration.update({ where: { id }, data: patch }))
    },

    async softDelete(tx, organizationId, id, replacementCiphertext) {
      await tx.integration.updateMany({
        where: { id, organizationId, status: { not: 'DELETED' } },
        data: { status: 'DELETED', webhookUrlCiphertext: replacementCiphertext },
      })
    },

    async recordDelivery(tx, input) {
      return tx.integrationDelivery.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          integrationId: input.integrationId,
          eventType: input.eventType,
          sourceKey: input.sourceKey,
          message: input.message,
        },
      })
    },

    async listDeliveries(tx, organizationId, integrationId, page) {
      const rows = await tx.integrationDelivery.findMany({
        where: {
          organizationId,
          integrationId,
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },
  }
}
