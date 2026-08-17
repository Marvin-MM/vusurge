import { describe, expect, test } from 'bun:test'
import { ConfigurationError, loadConfig } from '../../src/shared/config'

/**
 * Configuration validation.
 *
 * A misconfigured deployment must fail at boot with a precise message, not
 * halfway through serving traffic. These tests cover the cross-field rules a
 * flat schema cannot express, and the production-only rules that stop an
 * insecure configuration from ever reaching production.
 */

const BASE_ENV: Record<string, string> = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://ip_app:secret@localhost:5432/app',
  CACHE_REDIS_URL: 'redis://localhost:6379',
  QUEUE_REDIS_URL: 'redis://localhost:6380',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'),
  OBJECT_STORAGE_ENABLED: 'false',
}

function load(overrides: Record<string, string | undefined> = {}) {
  return loadConfig({ ...BASE_ENV, ...overrides })
}

function expectIssue(overrides: Record<string, string | undefined>, fragment: string): void {
  try {
    load(overrides)
    throw new Error(`Expected configuration to be rejected for: ${fragment}`)
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigurationError)
    const issues = (error as ConfigurationError).issues.join('\n')
    expect(issues).toContain(fragment)
  }
}

describe('required values', () => {
  test('accepts a complete development configuration', () => {
    const config = load()
    expect(config.app.environment).toBe('development')
    expect(config.database.url).toContain('postgresql://')
  })

  test('rejects a missing database URL', () => {
    expectIssue({ DATABASE_URL: undefined }, 'DATABASE_URL is required')
  })

  test('rejects a missing auth secret', () => {
    expectIssue({ BETTER_AUTH_SECRET: undefined }, 'BETTER_AUTH_SECRET is required')
  })

  test('rejects an encryption key that is not 32 bytes', () => {
    expectIssue(
      { ENCRYPTION_MASTER_KEY: Buffer.alloc(16, 1).toString('base64') },
      'must be exactly 32 bytes',
    )
  })

  test('rejects a non-boolean flag rather than guessing', () => {
    expect(() => load({ EMAIL_ENABLED: 'maybe' })).toThrow(ConfigurationError)
  })

  test('rejects a non-integer numeric setting', () => {
    expect(() => load({ PORT: '3000.5' })).toThrow(ConfigurationError)
  })
})

describe('feature-gated providers', () => {
  test('does not require Resend credentials when email is disabled', () => {
    const config = load({ EMAIL_ENABLED: 'false' })
    expect(config.email.enabled).toBe(false)
  })

  test('requires Resend credentials when email is enabled', () => {
    expectIssue({ EMAIL_ENABLED: 'true' }, 'RESEND_API_KEY is required')
  })

  test('requires Cloudinary credentials when image storage is enabled', () => {
    expectIssue({ CLOUDINARY_ENABLED: 'true' }, 'CLOUDINARY_CLOUD_NAME')
  })

  test('requires S3 credentials when object storage is enabled', () => {
    expectIssue({ OBJECT_STORAGE_ENABLED: 'true' }, 'S3_ACCESS_KEY_ID')
  })

  test('requires object storage when document uploads are enabled', () => {
    expectIssue(
      { FEATURE_DOCUMENT_UPLOADS: 'true', OBJECT_STORAGE_ENABLED: 'false' },
      'FEATURE_DOCUMENT_UPLOADS requires OBJECT_STORAGE_ENABLED',
    )
  })

  test('requires OAuth credentials only when the provider is enabled', () => {
    expect(load({ GOOGLE_OAUTH_ENABLED: 'false' }).auth.google.enabled).toBe(false)
    expectIssue({ GOOGLE_OAUTH_ENABLED: 'true' }, 'GOOGLE_CLIENT_ID')
  })
})

describe('production hardening', () => {
  const PRODUCTION: Record<string, string> = {
    ...BASE_ENV,
    APP_ENV: 'production',
    PUBLIC_BASE_URL: 'https://api.example.org',
    WEB_APP_BASE_URL: 'https://app.example.org',
    TRUSTED_ORIGINS: 'https://app.example.org',
    EMAIL_ENABLED: 'true',
    RESEND_API_KEY: 're_test_key',
    RESEND_WEBHOOK_SECRET: 'whsec_test',
    QUEUE_REDIS_URL: 'redis://queue.internal:6379',
    CACHE_REDIS_URL: 'redis://cache.internal:6379',
    // Image and object storage are both required in production: avatars,
    // logos, covers and screenshots need Cloudinary, and exports need S3.
    CLOUDINARY_CLOUD_NAME: 'example-cloud',
    CLOUDINARY_API_KEY: 'cloudinary-key',
    CLOUDINARY_API_SECRET: 'cloudinary-secret',
    OBJECT_STORAGE_ENABLED: 'true',
    S3_ACCESS_KEY_ID: 's3-key',
    S3_SECRET_ACCESS_KEY: 's3-secret',
  }

  test('accepts a hardened production configuration', () => {
    const config = loadConfig(PRODUCTION)
    expect(config.app.environment).toBe('production')
    // The OpenAPI console defaults off in production while the specification
    // remains buildable.
    expect(config.features.openApiUi).toBe(false)
  })

  test('rejects a plaintext public base URL', () => {
    expect(() => loadConfig({ ...PRODUCTION, PUBLIC_BASE_URL: 'http://api.example.org' })).toThrow(
      /must use https in production/,
    )
  })

  test('rejects a plaintext trusted origin', () => {
    expect(() =>
      loadConfig({
        ...PRODUCTION,
        TRUSTED_ORIGINS: 'https://ok.example.org,http://bad.example.org',
      }),
    ).toThrow(/must use https in production/)
  })

  test('rejects sharing one Redis between the cache and BullMQ', () => {
    // The cache needs a TTL-friendly eviction policy; BullMQ requires
    // noeviction. One server cannot satisfy both.
    expect(() =>
      loadConfig({
        ...PRODUCTION,
        CACHE_REDIS_URL: 'redis://shared.internal:6379',
        QUEUE_REDIS_URL: 'redis://shared.internal:6379',
      }),
    ).toThrow(/separate Redis deployments/)
  })

  test('rejects disabling email in production', () => {
    expect(() => loadConfig({ ...PRODUCTION, EMAIL_ENABLED: 'false' })).toThrow(
      /EMAIL_ENABLED must be true in production/,
    )
  })

  test('requires a webhook signing secret in production', () => {
    expect(() => loadConfig({ ...PRODUCTION, RESEND_WEBHOOK_SECRET: undefined })).toThrow(
      /RESEND_WEBHOOK_SECRET is required in production/,
    )
  })

  test('rejects pretty logging in production', () => {
    expect(() => loadConfig({ ...PRODUCTION, LOG_PRETTY: 'true' })).toThrow(
      /LOG_PRETTY must be false in production/,
    )
  })

  test('requires private object storage in production', () => {
    expect(() => loadConfig({ ...PRODUCTION, OBJECT_STORAGE_ENABLED: 'false' })).toThrow(
      /OBJECT_STORAGE_ENABLED must be true in production/,
    )
  })

  test('requires Cloudinary image storage in production', () => {
    expect(() => loadConfig({ ...PRODUCTION, CLOUDINARY_ENABLED: 'false' })).toThrow(
      /CLOUDINARY_ENABLED must be true in production/,
    )
  })

  test('rejects a database URL with TLS disabled', () => {
    expect(() =>
      loadConfig({
        ...PRODUCTION,
        DATABASE_URL: 'postgresql://ip_app:secret@db:5432/app?sslmode=disable',
      }),
    ).toThrow(/must not disable TLS/)
  })
})

describe('string format validation', () => {
  test('rejects a base URL that is not an absolute URL', () => {
    // Regression: TypeBox performs no format checking unless the format is
    // registered, which previously depended on Elysia being imported first.
    expect(() => load({ PUBLIC_BASE_URL: '/relative/path' })).toThrow(ConfigurationError)
  })
})

describe('bounds', () => {
  test('rejects a default page size larger than the maximum', () => {
    expectIssue(
      { PAGINATION_DEFAULT_PAGE_SIZE: '90', PAGINATION_MAX_PAGE_SIZE: '50' },
      'cannot exceed',
    )
  })

  test('caps submission screenshots at four', () => {
    expect(() => load({ UPLOAD_MAX_SUBMISSION_SCREENSHOTS: '5' })).toThrow(ConfigurationError)
    expect(load({ UPLOAD_MAX_SUBMISSION_SCREENSHOTS: '4' }).uploads.maxSubmissionScreenshots).toBe(
      4,
    )
  })
})
