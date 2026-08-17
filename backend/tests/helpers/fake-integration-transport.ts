import type {
  IntegrationProviderKind,
  IntegrationWebhookTransport,
  WebhookDispatchResult,
} from '../../src/shared/integrations'

export interface FakeIntegrationWebhookTransport extends IntegrationWebhookTransport {
  readonly sent: { provider: IntegrationProviderKind; webhookUrl: string; text: string }[]
  respondNext(result: WebhookDispatchResult): void
  clear(): void
}

export function createFakeIntegrationWebhookTransport(): FakeIntegrationWebhookTransport {
  const sent: { provider: IntegrationProviderKind; webhookUrl: string; text: string }[] = []
  const results: WebhookDispatchResult[] = []

  return {
    sent,
    async send(provider, webhookUrl, text) {
      sent.push({ provider, webhookUrl, text })
      return (
        results.shift() ?? {
          succeeded: true,
          retryable: false,
          responseStatus: 204,
          errorMessage: null,
        }
      )
    },
    respondNext(result): void {
      results.push(result)
    },
    clear(): void {
      sent.length = 0
      results.length = 0
    },
  }
}
