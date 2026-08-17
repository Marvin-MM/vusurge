import type { AppConfig } from '../config/config.schema'
import type { Logger } from '../logging'
import { NullObjectStorage } from './null-storage'
import { S3ObjectStorage } from './object-storage'

export { NullObjectStorage } from './null-storage'
export type { ObjectStorage } from './object-storage'
export { S3ObjectStorage } from './object-storage'

/** Select the configured provider. Production always uses S3-compatible storage. */
export function createObjectStorage(config: AppConfig, logger: Logger) {
  if (config.objectStorage.enabled) {
    return new S3ObjectStorage(config, logger)
  }
  return new NullObjectStorage(logger)
}
