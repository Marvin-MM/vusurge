import { featureDisabled } from '../errors'
import type { Logger } from '../logging'
import type { ObjectStorage } from './object-storage'

/**
 * Used only when `OBJECT_STORAGE_ENABLED` is false. Exports fail loudly with
 * a clear "feature disabled" error rather than silently pretending to store
 * a file, so a misconfigured deployment surfaces at the first export
 * request, not as a mysteriously empty download later.
 */
export class NullObjectStorage implements ObjectStorage {
  constructor(private readonly logger: Logger) {}

  async putObject(): Promise<{ bytes: number }> {
    this.logger.warn('Object storage is disabled; refusing to write an export file.')
    throw featureDisabled('exports')
  }

  async presignDownloadUrl(): Promise<string> {
    throw featureDisabled('exports')
  }

  async presignUploadUrl(): Promise<{
    url: string
    requiredHeaders: Readonly<Record<string, string>>
  }> {
    throw featureDisabled('document_uploads')
  }

  async inspectObject(): Promise<{
    bytes: number
    contentType: string | null
    etag: string | null
    metadata: Readonly<Record<string, string>>
  }> {
    throw featureDisabled('document_uploads')
  }

  async readObject(): Promise<Uint8Array> {
    throw featureDisabled('document_uploads')
  }

  async deleteObject(): Promise<void> {
    // A no-op delete is safe: there is nothing stored to remove.
  }
}
