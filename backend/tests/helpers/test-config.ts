import { loadConfig } from '../../src/shared/config'
import type { AppConfig } from '../../src/shared/config/config.schema'

/**
 * Configuration for the test suite.
 *
 * Tests run against real PostgreSQL and real Redis — never Prisma mocks — so
 * that migrations, foreign keys, composite tenant constraints, partial unique
 * indexes, check constraints, and row-level security are all actually
 * exercised (master prompt section 41.2).
 *
 * Only the third-party providers are substituted, and only at their interface
 * boundary: a test must not depend on Resend, Cloudinary, or a live S3 account.
 */

export function loadTestConfig(overrides: Partial<Record<string, string>> = {}): AppConfig {
  const env: Record<string, string | undefined> = {
    // Default baseline for unit tests when running in isolated environments
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/innovation_platform_test',
    CACHE_REDIS_URL: 'redis://127.0.0.1:6379',
    QUEUE_REDIS_URL: 'redis://127.0.0.1:6380',
    BETTER_AUTH_SECRET: 'ci_better_auth_secret_at_least_32_chars',
    ENCRYPTION_MASTER_KEY: Buffer.from('ci_test_encryption_key_32_bytes').toString('base64'),
    ...process.env,
    APP_ENV: 'test',
    PROCESS_ROLE: 'api',
    LOG_LEVEL: process.env['TEST_LOG_LEVEL'] ?? 'error',
    LOG_PRETTY: 'false',
    // A dedicated test database when one is configured (local development),
    // so `bun test` cannot disturb seed data in the primary dev database. In
    // CI, TEST_DATABASE_URL is unset and DATABASE_URL already points at the
    // ephemeral CI database, so this is a no-op there.
    ...(process.env['TEST_DATABASE_URL'] ? { DATABASE_URL: process.env['TEST_DATABASE_URL'] } : {}),
    // Providers are exercised through fakes; enabling them would demand real
    // credentials for an offline test run.
    EMAIL_ENABLED: 'false',
    CLOUDINARY_ENABLED: 'false',
    S3_ACCESS_KEY_ID: overrides['S3_ACCESS_KEY_ID'] ?? 'test-access-key',
    S3_SECRET_ACCESS_KEY: overrides['S3_SECRET_ACCESS_KEY'] ?? 'test-secret-key',
    OBJECT_STORAGE_ENABLED:
      overrides['OBJECT_STORAGE_ENABLED'] ??
      (overrides['FEATURE_DOCUMENT_UPLOADS'] === 'true' ? 'true' : 'false'),
    MALWARE_SCANNER_ENABLED: overrides['MALWARE_SCANNER_ENABLED'] ?? 'false',
    FEATURE_DOCUMENT_UPLOADS: overrides['FEATURE_DOCUMENT_UPLOADS'] ?? 'false',
    FEATURE_SSE_NOTIFICATIONS: overrides['FEATURE_SSE_NOTIFICATIONS'] ?? 'false',
    FEATURE_SLACK_INTEGRATION: overrides['FEATURE_SLACK_INTEGRATION'] ?? 'false',
    FEATURE_DISCORD_INTEGRATION: overrides['FEATURE_DISCORD_INTEGRATION'] ?? 'false',
    OTEL_TRACING_ENABLED: 'false',
    OTEL_METRICS_ENABLED: 'false',
    // Rate limits are asserted explicitly by the tests that care about them.
    RATE_LIMIT_ENABLED: overrides['RATE_LIMIT_ENABLED'] ?? 'false',
    ...overrides,
  }

  return loadConfig(env)
}

/** The database the integration suite runs against. */
export function testDatabaseUrl(): string {
  const url = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL']
  if (url === undefined || url === '') {
    throw new Error(
      'TEST_DATABASE_URL (or DATABASE_URL) must point at a PostgreSQL database for the ' +
        'integration suite. Start the local stack with `docker compose up -d`.',
    )
  }
  return url
}

/** The migration-role connection.
 * With a single-credential model, this is identical to `testDatabaseUrl()`.
 * Kept for backwards-compat so existing test imports do not break.
 * @deprecated Use testDatabaseUrl() directly.
 */
export function testMigrationDatabaseUrl(): string {
  return testDatabaseUrl()
}
