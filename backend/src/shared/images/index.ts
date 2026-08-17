import type { AppConfig } from '../config/config.schema'
import type { Logger } from '../logging'
import { CloudinaryImageProvider } from './cloudinary-provider'
import { NullImageProvider } from './null-provider'

export { CloudinaryImageProvider } from './cloudinary-provider'
export type {
  ConfirmedImageMetadata,
  ImageDeliveryAuthorization,
  ImageDeliveryType,
  ImageProvider,
  UploadAuthorization,
  UploadAuthorizationParams,
} from './image-provider'
export { NullImageProvider } from './null-provider'

/** Select the configured provider. Production always uses Cloudinary. */
export function createImageProvider(config: AppConfig, logger: Logger) {
  if (config.cloudinary.enabled) {
    return new CloudinaryImageProvider(config, logger)
  }
  return new NullImageProvider(logger, config.cloudinary.privateDeliveryTtlSeconds)
}
