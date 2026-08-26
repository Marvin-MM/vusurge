import type { Server } from 'bun'
import type { ObjectStorage } from '../../src/shared/storage'

interface StoredObject {
  readonly body: Uint8Array
  readonly contentType: string
  readonly metadata: Readonly<Record<string, string>>
}

/**
 * An in-memory object storage provider with a lightweight local HTTP server
 * for presigned upload and download testing.
 *
 * Implements the ObjectStorage interface so integration and E2E tests can
 * exercise file uploads, downloads, malware scans, and data exports without
 * requiring a live MinIO / AWS S3 deployment.
 */
export interface FakeObjectStorage extends ObjectStorage {
  readonly objects: Map<string, StoredObject>
  clear(): void
  dispose(): void
}

export function createFakeObjectStorage(): FakeObjectStorage {
  const objects = new Map<string, StoredObject>()

  const server: Server<unknown> = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      const key = decodeURIComponent(url.pathname.replace(/^\/objects\//, ''))

      if (req.method === 'PUT') {
        const body = new Uint8Array(await req.arrayBuffer())
        const contentType = req.headers.get('content-type') ?? 'application/octet-stream'
        const metadata: Record<string, string> = {}
        for (const [headerKey, headerVal] of req.headers.entries()) {
          if (headerKey.startsWith('x-amz-meta-')) {
            metadata[headerKey.replace('x-amz-meta-', '')] = headerVal
          }
        }
        objects.set(key, { body, contentType, metadata })
        return new Response(null, { status: 200 })
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const stored = objects.get(key)
        if (stored === undefined) {
          return new Response('Not Found', { status: 404 })
        }
        if (req.method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'content-type': stored.contentType,
              'content-length': String(stored.body.byteLength),
            },
          })
        }
        return new Response(stored.body, {
          status: 200,
          headers: {
            'content-type': stored.contentType,
            'content-length': String(stored.body.byteLength),
          },
        })
      }

      if (req.method === 'DELETE') {
        objects.delete(key)
        return new Response(null, { status: 204 })
      }

      return new Response('Method Not Allowed', { status: 405 })
    },
  })

  const baseUrl = `http://127.0.0.1:${server.port}/objects`
  server.unref()

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
        url: `${baseUrl}/${encodeURIComponent(key)}`,
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
      return `${baseUrl}/${encodeURIComponent(key)}`
    },

    async deleteObject(key: string): Promise<void> {
      objects.delete(key)
    },

    clear(): void {
      objects.clear()
    },

    dispose(): void {
      server.stop(true)
      objects.clear()
    },
  }
}
