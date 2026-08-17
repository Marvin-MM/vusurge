/**
 * The Cloudinary image boundary (master prompt section 22.1).
 *
 * Every part of the system that issues an upload authorization, verifies an
 * uploaded image, resolves a delivery URL, or deletes an asset depends on
 * this interface, never on the Cloudinary SDK directly — the same boundary
 * discipline as `EmailProvider`. Cloudinary is image-only: nothing here
 * accepts or returns arbitrary file types.
 */

export type ImageDeliveryType = 'upload' | 'authenticated'

export interface UploadAuthorizationParams {
  readonly publicId: string
  readonly folder: string
  readonly deliveryType: ImageDeliveryType
}

export interface UploadAuthorization {
  readonly uploadUrl: string
  readonly cloudName: string
  readonly apiKey: string
  readonly timestamp: number
  readonly signature: string
  readonly folder: string
  readonly publicId: string
  readonly type: ImageDeliveryType
}

export interface ConfirmedImageMetadata {
  readonly format: string
  readonly bytes: number
  readonly width: number
  readonly height: number
}

export interface ImageDeliveryAuthorization {
  readonly url: string
  /** Null only for an explicitly public, non-expiring provider URL. */
  readonly expiresAt: Date | null
}

export interface ImageProvider {
  createUploadAuthorization(params: UploadAuthorizationParams): UploadAuthorization
  /**
   * Confirms an upload actually exists at the provider with the claimed
   * public ID, returning its authoritative metadata. Never trusts
   * client-supplied width/height/bytes — this is what the domain record
   * gets associated with. Returns null if no such resource exists.
   */
  verifyUpload(
    publicId: string,
    deliveryType: ImageDeliveryType,
  ): Promise<ConfirmedImageMetadata | null>
  getDeliveryUrl(
    publicId: string,
    deliveryType: ImageDeliveryType,
    format: string | null,
  ): ImageDeliveryAuthorization
  destroy(publicId: string, deliveryType: ImageDeliveryType): Promise<void>
}
