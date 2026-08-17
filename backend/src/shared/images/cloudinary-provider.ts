import { v2 as cloudinary } from 'cloudinary'
import { CircuitBreaker } from '../cache'
import type { AppConfig } from '../config/config.schema'
import type { Logger } from '../logging'
import { appMetrics } from '../observability'
import type {
  ConfirmedImageMetadata,
  ImageDeliveryAuthorization,
  ImageDeliveryType,
  ImageProvider,
  UploadAuthorization,
  UploadAuthorizationParams,
} from './image-provider'

/**
 * Cloudinary-backed signed upload authority.
 *
 * The API never proxies the actual image bytes: it signs a narrow set of
 * upload parameters (public ID, folder, delivery type) with the account
 * secret, the client uploads directly to Cloudinary, and the API verifies
 * the result against Cloudinary's own Admin API before any domain record is
 * allowed to reference it (master prompt section 22.1). The secret never
 * leaves the server.
 */
export class CloudinaryImageProvider implements ImageProvider {
  private readonly cloudName: string
  private readonly apiKey: string
  private readonly breaker: CircuitBreaker

  constructor(
    private readonly config: AppConfig,
    logger: Logger,
  ) {
    const { cloudName, apiKey, apiSecret } = config.cloudinary
    if (cloudName === undefined || apiKey === undefined || apiSecret === undefined) {
      throw new Error('CloudinaryImageProvider requires cloud name, API key, and API secret.')
    }
    this.cloudName = cloudName
    this.apiKey = apiKey
    this.breaker = new CircuitBreaker({
      name: 'cloudinary',
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      onStateChange: (state) =>
        logger.warn({ circuit: 'cloudinary', state }, 'Cloudinary circuit changed state'),
    })
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
      timeout: config.cloudinary.requestTimeoutMs,
    })
  }

  createUploadAuthorization(params: UploadAuthorizationParams): UploadAuthorization {
    const timestamp = Math.floor(Date.now() / 1000)
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      public_id: params.publicId,
      folder: params.folder,
      type: params.deliveryType,
    }
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.config.cloudinary.apiSecret ?? '',
    )

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      signature,
      folder: params.folder,
      publicId: params.publicId,
      type: params.deliveryType,
    }
  }

  async verifyUpload(
    publicId: string,
    deliveryType: ImageDeliveryType,
  ): Promise<ConfirmedImageMetadata | null> {
    if (!this.breaker.canAttempt()) throw new Error('Cloudinary circuit is open; request deferred.')
    try {
      const resource = await cloudinary.api.resource(publicId, {
        type: deliveryType,
        resource_type: 'image',
        timeout: this.config.cloudinary.requestTimeoutMs,
      })
      this.breaker.recordSuccess()
      return {
        format: resource.format,
        bytes: resource.bytes,
        width: resource.width,
        height: resource.height,
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        this.breaker.recordSuccess()
        return null
      }
      this.breaker.recordFailure()
      appMetrics().uploadFailures.add(1, { provider: 'cloudinary', stage: 'inspect' })
      throw error
    }
  }

  getDeliveryUrl(
    publicId: string,
    deliveryType: ImageDeliveryType,
    format: string | null,
  ): ImageDeliveryAuthorization {
    if (deliveryType === 'authenticated') {
      if (format === null || format === '') {
        throw new Error('A confirmed format is required for authenticated image delivery.')
      }
      const expiresAt = new Date(
        Date.now() + this.config.cloudinary.privateDeliveryTtlSeconds * 1000,
      )
      return {
        url: cloudinary.utils.private_download_url(publicId, format, {
          resource_type: 'image',
          type: 'authenticated',
          expires_at: Math.floor(expiresAt.getTime() / 1000),
        }),
        expiresAt,
      }
    }

    return {
      url: cloudinary.url(publicId, {
        type: 'upload',
        secure: true,
        fetch_format: 'auto',
        quality: 'auto',
      }),
      expiresAt: null,
    }
  }

  async destroy(publicId: string, deliveryType: ImageDeliveryType): Promise<void> {
    if (!this.breaker.canAttempt()) throw new Error('Cloudinary circuit is open; request deferred.')
    try {
      await cloudinary.uploader.destroy(publicId, {
        type: deliveryType,
        resource_type: 'image',
      })
      this.breaker.recordSuccess()
    } catch (error) {
      this.breaker.recordFailure()
      appMetrics().uploadFailures.add(1, { provider: 'cloudinary', stage: 'delete' })
      throw error
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'http_code' in error &&
    (error as { http_code: unknown }).http_code === 404
  )
}
