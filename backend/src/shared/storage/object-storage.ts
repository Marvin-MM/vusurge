import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { CircuitBreaker } from '../cache'
import type { AppConfig } from '../config/config.schema'
import type { Logger } from '../logging'
import { appMetrics } from '../observability'

/**
 * Private object storage boundary (master prompt section 22 / 24.1).
 *
 * Every part of the system that writes or reads a private file — currently
 * only CSV exports — depends on this interface, never on the S3 SDK
 * directly, the same boundary discipline as `EmailProvider`/`ImageProvider`.
 * Objects here are never public: the bucket has no public-read policy, and
 * the only way to read one back is a short-lived signed URL minted per
 * request.
 */
export interface ObjectStorage {
  putObject(key: string, body: string | Uint8Array, contentType: string): Promise<{ bytes: number }>
  presignUploadUrl(
    key: string,
    contentType: string,
    ttlSeconds: number,
    metadata: Readonly<Record<string, string>>,
  ): Promise<{ url: string; requiredHeaders: Readonly<Record<string, string>> }>
  inspectObject(key: string): Promise<{
    bytes: number
    contentType: string | null
    etag: string | null
    metadata: Readonly<Record<string, string>>
  }>
  readObject(key: string, maxBytes: number): Promise<Uint8Array>
  presignDownloadUrl(key: string, ttlSeconds: number): Promise<string>
  deleteObject(key: string): Promise<void>
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly sendSseHeaders: boolean
  private readonly requestTimeoutMs: number
  private readonly breaker: CircuitBreaker

  constructor(config: AppConfig, logger: Logger) {
    const { region, bucket, endpoint, accessKeyId, secretAccessKey, forcePathStyle } =
      config.objectStorage
    if (accessKeyId === undefined || secretAccessKey === undefined) {
      throw new Error('S3ObjectStorage requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.')
    }
    this.bucket = bucket
    this.sendSseHeaders = config.objectStorage.sendSseHeaders
    this.requestTimeoutMs = config.objectStorage.requestTimeoutMs
    this.breaker = new CircuitBreaker({
      name: 'object-storage',
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      onStateChange: (state) =>
        logger.warn({ circuit: 'object-storage', state }, 'Object-storage circuit changed state'),
    })
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  private async request<T>(
    operation: string,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (!this.breaker.canAttempt()) {
      throw new Error('Object-storage circuit is open; request deferred.')
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    try {
      const result = await work(controller.signal)
      this.breaker.recordSuccess()
      return result
    } catch (error) {
      this.breaker.recordFailure()
      appMetrics().uploadFailures.add(1, { provider: 's3', stage: operation })
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async putObject(key: string, body: string | Uint8Array, contentType: string) {
    const bytes = typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : body.byteLength
    await this.request('put', (abortSignal) =>
      this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ...(this.sendSseHeaders ? { ServerSideEncryption: 'AES256' as const } : {}),
        }),
        { abortSignal },
      ),
    )
    return { bytes }
  }

  async presignDownloadUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    })
  }

  async presignUploadUrl(
    key: string,
    contentType: string,
    ttlSeconds: number,
    metadata: Readonly<Record<string, string>>,
  ) {
    const requiredHeaders = {
      'content-type': contentType,
      ...(this.sendSseHeaders ? { 'x-amz-server-side-encryption': 'AES256' } : {}),
      ...Object.fromEntries(
        Object.entries(metadata).map(([name, value]) => [`x-amz-meta-${name}`, value]),
      ),
    }
    const signedHeaderNames = new Set(Object.keys(requiredHeaders))
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        Metadata: { ...metadata },
        ...(this.sendSseHeaders ? { ServerSideEncryption: 'AES256' as const } : {}),
      }),
      {
        expiresIn: ttlSeconds,
        // Keep security- and scope-bearing values in required HTTP headers
        // and bind every one into the signature. The default presigner may
        // hoist x-amz-* fields into the query or omit content-type from
        // SignedHeaders, which lets clients send contradictory headers and is
        // rejected by stricter S3-compatible providers such as MinIO.
        unhoistableHeaders: signedHeaderNames,
        signableHeaders: signedHeaderNames,
      },
    )
    return { url, requiredHeaders }
  }

  async inspectObject(key: string) {
    const response = await this.request('inspect', (abortSignal) =>
      this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal }),
    )
    return {
      bytes: response.ContentLength ?? 0,
      contentType: response.ContentType ?? null,
      etag: response.ETag?.replaceAll('"', '') ?? null,
      metadata: response.Metadata ?? {},
    }
  }

  async readObject(key: string, maxBytes: number): Promise<Uint8Array> {
    const response = await this.request('read', (abortSignal) =>
      this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal }),
    )
    if (response.ContentLength !== undefined && response.ContentLength > maxBytes) {
      throw new Error('Stored object exceeds the configured scanner size limit.')
    }
    const bytes = await response.Body?.transformToByteArray()
    if (bytes === undefined) throw new Error('Stored object body was empty.')
    if (bytes.byteLength > maxBytes) {
      throw new Error('Stored object exceeds the configured scanner size limit.')
    }
    return bytes
  }

  async deleteObject(key: string): Promise<void> {
    await this.request('delete', (abortSignal) =>
      this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal }),
    )
  }
}
