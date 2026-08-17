import type { ResendWebhookHeaders, WebhooksService } from './webhooks.service'

export function createWebhooksController(service: WebhooksService) {
  return {
    async receiveResend(rawBody: string, headers: ResendWebhookHeaders) {
      await service.receiveResendWebhook(rawBody, headers)
    },
  }
}

export type WebhooksController = ReturnType<typeof createWebhooksController>
