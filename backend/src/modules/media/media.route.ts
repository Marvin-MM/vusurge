import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { MediaController } from './media.controller'
import {
  ConfirmUploadBody,
  DeliveryUrlResponse,
  MediaAssetResponse,
  UploadAuthorizationBody,
  UploadAuthorizationResponse,
} from './media.dto'

export function mediaRoutes(controller: MediaController, auth: AuthPlugin) {
  return new Elysia({ name: 'media-routes' })
    .use(auth)
    .post(
      '/media/images/upload-authorization',
      ({ access, body }) => controller.createUploadAuthorization(access, body),
      {
        requireAuth: true,
        body: UploadAuthorizationBody,
        response: { 200: UploadAuthorizationResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Media'],
          summary: 'Request a signed Cloudinary upload authorization',
          description:
            'The client uploads directly to Cloudinary with the returned parameters, then calls ' +
            'confirm. Organization-scoped purposes carry organizationId; challenge/resource purposes ' +
            'also carry their exact challengeId/resourceId. The immutable binding and caller policy ' +
            'are rechecked when a domain record attaches the confirmed asset.',
        },
      },
    )
    .post('/media/images/confirm', ({ access, body }) => controller.confirm(access, body.assetId), {
      requireAuth: true,
      body: ConfirmUploadBody,
      response: { 200: MediaAssetResponse, ...CommonErrorResponses },
      detail: {
        tags: ['Media'],
        summary: 'Confirm an uploaded image',
        description:
          'Verifies the upload against Cloudinary directly; never trusts client-supplied metadata.',
      },
    })
    .get(
      '/media/images/:assetId/delivery',
      ({ access, params }) => controller.getDeliveryUrl(access, params.assetId),
      {
        requireAuth: true,
        params: t.Object({ assetId: Uuid }),
        response: { 200: DeliveryUrlResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Media'],
          summary: 'Get a delivery URL for a confirmed image',
          description: 'Signed for authenticated/private assets; a stable public URL otherwise.',
        },
      },
    )
    .get(
      '/public/media/images/:assetId/delivery',
      ({ params, access }) => controller.getPublicDeliveryUrl(params.assetId, access.ipAddress),
      {
        params: t.Object({ assetId: Uuid }),
        response: { 200: DeliveryUrlResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Public', 'Media'],
          summary: 'Get a public-eligible image delivery URL',
          description:
            'Returns a short-lived signed URL only while the confirmed asset is attached to an explicitly public, non-suspended resource.',
        },
      },
    )
    .delete(
      '/media/images/:assetId',
      async ({ access, params, set }) => {
        await controller.remove(access, params.assetId)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ assetId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Media'], summary: 'Delete a media asset' },
      },
    )
}
