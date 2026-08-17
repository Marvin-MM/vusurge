import type { Logger } from '../logging'
import type {
  ConfirmedImageMetadata,
  ImageDeliveryAuthorization,
  ImageDeliveryType,
  ImageProvider,
  UploadAuthorization,
  UploadAuthorizationParams,
} from './image-provider'

/**
 * A provider that never talks to Cloudinary.
 *
 * Used when `CLOUDINARY_ENABLED=false` (local development, most test runs).
 * It implements the same interface as `CloudinaryImageProvider`, so every
 * caller — including the media module — behaves identically whether or not a
 * real account is configured. `verifyUpload` always confirms: there is no
 * real upload to check against, so it stands in for "the client's upload
 * succeeded" the same way this provider stands in for delivery as a whole.
 * Production must not run with this provider: configuration validation
 * requires `CLOUDINARY_ENABLED` to be true in production.
 */
export class NullImageProvider implements ImageProvider {
  constructor(
    private readonly logger: Logger,
    private readonly privateDeliveryTtlSeconds: number,
  ) {}

  createUploadAuthorization(params: UploadAuthorizationParams): UploadAuthorization {
    this.logger.info(
      { publicId: params.publicId, purpose: params.folder },
      'Image upload is disabled; issuing a placeholder authorization instead of a real Cloudinary signature',
    )
    return {
      uploadUrl: 'https://null-provider.invalid/upload',
      cloudName: 'null-provider',
      apiKey: 'null-provider',
      timestamp: Math.floor(Date.now() / 1000),
      signature: 'null-provider',
      folder: params.folder,
      publicId: params.publicId,
      type: params.deliveryType,
    }
  }

  async verifyUpload(
    publicId: string,
    _deliveryType: ImageDeliveryType,
  ): Promise<ConfirmedImageMetadata | null> {
    this.logger.info({ publicId }, 'Image upload is disabled; treating the upload as verified')
    return { format: 'jpg', bytes: 102_400, width: 512, height: 512 }
  }

  getDeliveryUrl(
    publicId: string,
    deliveryType: ImageDeliveryType,
    _format: string | null,
  ): ImageDeliveryAuthorization {
    const expiresAt =
      deliveryType === 'authenticated'
        ? new Date(Date.now() + this.privateDeliveryTtlSeconds * 1000)
        : null
    const query = expiresAt === null ? '' : `?expires_at=${Math.floor(expiresAt.getTime() / 1000)}`
    return {
      url: `https://null-provider.invalid/${deliveryType}/${publicId}${query}`,
      expiresAt,
    }
  }

  async destroy(): Promise<void> {}
}
