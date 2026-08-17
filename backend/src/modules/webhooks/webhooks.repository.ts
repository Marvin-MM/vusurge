import type { PrismaTransactionClient } from '../../shared/database'

export interface CreateReceiptInput {
  id: string
  provider: string
  providerEventId: string
  eventType: string
  payload: Record<string, unknown>
}

export interface WebhooksRepository {
  /** Returns true only when this call performed the insert (a genuinely new event). */
  createReceiptIfNew(tx: PrismaTransactionClient, input: CreateReceiptInput): Promise<boolean>
}

export function createWebhooksRepository(): WebhooksRepository {
  return {
    async createReceiptIfNew(tx, input) {
      const result = await tx.webhookEvent.createMany({
        data: [
          {
            id: input.id,
            provider: input.provider,
            providerEventId: input.providerEventId,
            eventType: input.eventType,
            payload: input.payload as never,
          },
        ],
        skipDuplicates: true,
      })
      return result.count === 1
    },
  }
}
