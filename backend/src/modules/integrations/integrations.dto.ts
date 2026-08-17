import { t } from 'elysia'
import { HttpsUrl, PageOf, Uuid } from '../../shared/http'

export const IntegrationProvider = t.Union([t.Literal('SLACK'), t.Literal('DISCORD')])
export const IntegrationStatus = t.Union([t.Literal('ACTIVE'), t.Literal('DISABLED')])

export const ConnectIntegrationBody = t.Object({
  webhookUrl: HttpsUrl,
})

export const UpdateIntegrationBody = t.Object({
  status: t.Optional(IntegrationStatus),
  webhookUrl: t.Optional(HttpsUrl),
})

// Never includes the ciphertext or any decrypted material (master prompt:
// "Do not return decrypted webhook secrets").
export const IntegrationResponse = t.Object({
  id: Uuid,
  organizationId: Uuid,
  provider: IntegrationProvider,
  status: IntegrationStatus,
  createdByUserId: Uuid,
  createdAt: t.String(),
  updatedAt: t.String(),
})

export const IntegrationListResponse = t.Array(IntegrationResponse)

export const IntegrationDeliveryResponse = t.Object({
  id: Uuid,
  integrationId: Uuid,
  eventType: t.String(),
  status: t.Union([
    t.Literal('PENDING'),
    t.Literal('SENDING'),
    t.Literal('SUCCEEDED'),
    t.Literal('FAILED'),
  ]),
  attempts: t.Integer(),
  succeeded: t.Union([t.Boolean(), t.Null()]),
  responseStatus: t.Union([t.Integer(), t.Null()]),
  errorMessage: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const IntegrationDeliveryListResponse = PageOf(IntegrationDeliveryResponse)
