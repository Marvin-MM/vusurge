import type { ObjectStorage } from '../../src/shared/storage'

interface StoredObject {
  readonly body: Uint8Array
  readonly contentType: string
  readonly metadata: Readonly<Record<string, string>>
}

/**
 * An in-memory object storage provider for integration tests.
 *
 * Implements the ObjectStorage interface using an in-memory Map so integration
 * tests do not require an active MinIO or AWS S3 instance.
 */
export interface FakeObjectStorage extends ObjectStorage {
  readonly objects: Map<string, StoredObject>
  clear(): void
}

export function createFakeObjectStorage(): FakeObjectStorage {
  const objects = new Map<string, StoredObject>()

  return {
    objects,

    async putObject(
      key: string,
      body: string | Uint8Array,
      contentType: string,
    ): Promise<{ bytes: number }> {
      const data = typeof body === 'string' ? Buffer.from(body, 'utf8') : body
      objects.set(key, {
        body: data,
        contentType,
        metadata: {},
      })
      return { bytes: data.byteLength }
    },

    async presignUploadUrl(
      key: string,
      contentType: string,
      _ttlSeconds: number,
      metadata: Readonly<Record<string, string>>,
    ) {
      const requiredHeaders: Record<string, string> = {
        'content-type': contentType,
        ...Object.fromEntries(
          Object.entries(metadata).map(([name, value]) => [`x-amz-meta-${name}`, value]),
        ),
      }
      return {
        url: `https://fake-s3.local/upload/${encodeURIComponent(key)}`,
        requiredHeaders,
      }
    },

    async inspectObject(key: string) {
      const stored = objects.get(key)
      if (stored === undefined) {
        throw new Error(`Object not found in fake storage: ${key}`)
      }
      return {
        bytes: stored.body.byteLength,
        contentType: stored.contentType,
        etag: 'fake-etag',
        metadata: stored.metadata,
      }
    },

    async readObject(key: string, maxBytes: number): Promise<Uint8Array> {
      const stored = objects.get(key)
      if (stored === undefined) {
        throw new Error(`Object not found in fake storage: ${key}`)
      }
      if (stored.body.byteLength > maxBytes) {
        throw new Error('Stored object exceeds the configured scanner size limit.')
      }
      return stored.body
    },

    async presignDownloadUrl(key: string, _ttlSeconds: number): Promise<string> {
      return `https://fake-s3.local/download/${encodeURIComponent(key)}`
    },

    async deleteObject(key: string): Promise<void> {
      objects.delete(key)
    },

    clear(): void {
      objects.clear()
    },
  }
}
