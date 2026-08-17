import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, IdempotencyKey, Uuid } from '../../shared/http'
import type { IntegrationsController } from './integrations.controller'
import {
  ConnectIntegrationBody,
  IntegrationDeliveryListResponse,
  IntegrationDeliveryResponse,
  IntegrationListResponse,
  IntegrationResponse,
  UpdateIntegrationBody,
} from './integrations.dto'

export function integrationsRoutes(controller: IntegrationsController, auth: AuthPlugin) {
  return new Elysia({ name: 'integrations-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId/integrations',
      ({ access, params }) => controller.list(access, params.organizationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: IntegrationListResponse, ...CommonErrorResponses },
        detail: { tags: ['Integrations'], summary: 'List organization integrations' },
      },
    )
    .post(
      '/organizations/:organizationId/integrations/slack',
      async ({ access, params, body, set }) => {
        const result = await controller.connect(
          access,
          params.organizationId,
          'SLACK',
          body.webhookUrl,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: ConnectIntegrationBody,
        response: { 201: IntegrationResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Integrations'],
          summary: 'Connect a Slack incoming webhook',
          description: 'Requires a fresh session. Replaces any existing Slack connection.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/integrations/discord',
      async ({ access, params, body, set }) => {
        const result = await controller.connect(
          access,
          params.organizationId,
          'DISCORD',
          body.webhookUrl,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: ConnectIntegrationBody,
        response: { 201: IntegrationResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Integrations'],
          summary: 'Connect a Discord incoming webhook',
          description: 'Requires a fresh session. Replaces any existing Discord connection.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/integrations/:integrationId/test',
      async ({ access, params, headers, set }) => {
        const result = await controller.test(
          access,
          params.organizationId,
          params.integrationId,
          headers['idempotency-key'],
        )
        set.status = result.status
        return result.body
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, integrationId: Uuid }),
        headers: t.Object({ 'idempotency-key': IdempotencyKey }),
        response: { 202: IntegrationDeliveryResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Integrations'],
          summary: 'Queue a test message',
          description: 'Requires a fresh session and Idempotency-Key.',
        },
      },
    )
    .patch(
      '/organizations/:organizationId/integrations/:integrationId',
      ({ access, params, body }) =>
        controller.update(access, params.organizationId, params.integrationId, body),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, integrationId: Uuid }),
        body: UpdateIntegrationBody,
        response: { 200: IntegrationResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Integrations'],
          summary: 'Update an integration',
          description: 'Enable/disable, or rotate the webhook URL. Requires a fresh session.',
        },
      },
    )
    .delete(
      '/organizations/:organizationId/integrations/:integrationId',
      async ({ access, params, set }) => {
        await controller.remove(access, params.organizationId, params.integrationId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, integrationId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Integrations'],
          summary: 'Remove an integration',
          description: 'Requires a fresh session.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/integrations/:integrationId/deliveries',
      ({ access, params, query }) =>
        controller.listDeliveries(access, params.organizationId, params.integrationId, query),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid, integrationId: Uuid }),
        query: t.Object({
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 512 })),
        }),
        response: { 200: IntegrationDeliveryListResponse, ...CommonErrorResponses },
        detail: { tags: ['Integrations'], summary: 'List recent delivery attempts' },
      },
    )
}
