import { describe, expect, test } from 'bun:test'
import { loadConfig } from '../../src/shared/config'
import { CloudinaryImageProvider } from '../../src/shared/images'
import { createLogger } from '../../src/shared/logging'

const config = loadConfig({
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://ip_app:test@localhost:5432/test',
  CACHE_REDIS_URL: 'redis://localhost:6379',
  QUEUE_REDIS_URL: 'redis://localhost:6380',
  BETTER_AUTH_SECRET: 'test_better_auth_secret_at_least_32_chars',
  ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 9).toString('base64'),
  OBJECT_STORAGE_ENABLED: 'false',
  CLOUDINARY_ENABLED: 'true',
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-key',
  CLOUDINARY_API_SECRET: 'test-secret',
  CLOUDINARY_PRIVATE_DELIVERY_TTL_SECONDS: '120',
  LOG_LEVEL: 'fatal',
})

function provider(): CloudinaryImageProvider {
  return new CloudinaryImageProvider(config, createLogger(config))
}

describe('Cloudinary signed URLs', () => {
  test('signs the exact upload leaf and folder without duplicating the provider path', () => {
    const authorization = provider().createUploadAuthorization({
      publicId: '018f0000-0000-7000-8000-000000000001',
      folder: 'innovation-platform/user_avatar',
      deliveryType: 'authenticated',
    })

    expect(authorization.publicId).toBe('018f0000-0000-7000-8000-000000000001')
    expect(authorization.folder).toBe('innovation-platform/user_avatar')
    expect(authorization.signature).not.toBeEmpty()
  })

  test('authenticated delivery is signed and expires at the configured deadline', () => {
    const before = Date.now()
    const delivery = provider().getDeliveryUrl(
      'innovation-platform/user_avatar/018f0000-0000-7000-8000-000000000001',
      'authenticated',
      'png',
    )
    const parsed = new URL(delivery.url)
    const queryExpiry = Number(parsed.searchParams.get('expires_at')) * 1000

    expect(delivery.expiresAt).toBeInstanceOf(Date)
    expect(delivery.expiresAt?.getTime()).toBeGreaterThanOrEqual(before + 119_000)
    expect(delivery.expiresAt?.getTime()).toBeLessThanOrEqual(before + 121_000)
    expect(queryExpiry).toBe(Math.floor((delivery.expiresAt?.getTime() ?? 0) / 1000) * 1000)
    expect(parsed.searchParams.get('signature')).not.toBeNull()
  })

  test('refuses authenticated delivery before authoritative format confirmation', () => {
    expect(() =>
      provider().getDeliveryUrl(
        'innovation-platform/user_avatar/unconfirmed',
        'authenticated',
        null,
      ),
    ).toThrow(/confirmed format/)
  })

  test('an explicitly public upload URL does not pretend to expire', () => {
    const delivery = provider().getDeliveryUrl('innovation-platform/public/logo', 'upload', 'png')
    expect(delivery.expiresAt).toBeNull()
    expect(new URL(delivery.url).searchParams.get('expires_at')).toBeNull()
  })
})
