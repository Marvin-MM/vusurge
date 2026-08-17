import { Elysia, t } from 'elysia'
import type { WebhooksController } from './webhooks.controller'
import { WebhookAckResponse } from './webhooks.dto'

/**
 * Inbound provider webhooks (master prompt section 34.37).
 *
 * Mounted outside `/api/v1` and never behind `.use(auth)`: these requests
 * carry no session cookie and are authenticated entirely by the provider's
 * signature. No `body` schema is declared, so Elysia never parses or
 * reserializes the payload — the handler reads `request.text()` itself,
 * which is the only way to obtain the exact bytes the signature was computed
 * over. Re-serializing a JSON-parsed body (`JSON.stringify(parsed)`) is not
 * equivalent to the original bytes and would make verification unreliable.
 */
export function webhooksRoutes(controller: WebhooksController) {
  return new Elysia({ name: 'webhooks-routes' }).post(
    '/webhooks/resend',
    async ({ request, headers, set }) => {
      const rawBody = await request.text()
      await controller.receiveResend(rawBody, {
        svixId: headers['svix-id'],
        svixTimestamp: headers['svix-timestamp'],
        svixSignature: headers['svix-signature'],
      })
      set.status = 200
      return { received: true }
    },
    {
      headers: t.Object({
        'svix-id': t.Optional(t.String()),
        'svix-timestamp': t.Optional(t.String()),
        'svix-signature': t.Optional(t.String()),
      }),
      response: { 200: WebhookAckResponse },
      detail: {
        tags: ['Webhooks'],
        summary: 'Resend inbound webhook',
        description: 'Authenticated by Svix signature headers, not by session cookie.',
      },
    },
  )
}
