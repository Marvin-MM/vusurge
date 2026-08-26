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
    // config.ts defaults OBJECT_STORAGE_ENABLED to true, which triggers the
    // cross-field validator to require S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY.
    // Unit tests that don't exercise object storage must not need real S3
    // credentials — disable it here and let tests that need it override explicitly.
    OBJECT_STORAGE_ENABLED: overrides['OBJECT_STORAGE_ENABLED'] ?? 'false',
    MALWARE_SCANNER_ENABLED: overrides['MALWARE_SCANNER_ENABLED'] ?? 'false',
    FEATURE_DOCUMENT_UPLOADS: overrides['FEATURE_DOCUMENT_UPLOADS'] ?? 'false',
    FEATURE_SSE_NOTIFICATIONS: overrides['FEATURE_SSE_NOTIFICATIONS'] ?? 'false',
    FEATURE_SLACK_INTEGRATION: overrides['FEATURE_SLACK_INTEGRATION'] ?? 'false',
    FEATURE_DISCORD_INTEGRATION: overrides['FEATURE_DISCORD_INTEGRATION'] ?? 'false',
    OTEL_TRACING_ENABLED: 'false',
    OTEL_METRICS_ENABLED: 'false',
    // Rate limits are asserted explicitly by the tests that care about them.
    RATE_LIMIT_ENABLED: overrides['RATE_LIMIT_ENABLED'] ?? 'false',
    // Self-contained required credentials: unit tests must not fail because an
    // enclosing CI job set these to an invalid value (e.g. wrong byte length).
    // Values are throwaway CI-only constants; they never touch a real database.
    //   ci_unit_test_auth_secret_32chars = 32 chars, satisfies ≥32 requirement
    //   ci_encryption_key_exactly_32byte = base64(32 bytes), verified by:
    //     echo -n "Y2lfZW5jcnlwdGlvbl9rZXlfZXhhY3RseV8zMmJ5dGU=" | base64 -d | wc -c
    BETTER_AUTH_SECRET:
      overrides['BETTER_AUTH_SECRET'] ?? 'ci_unit_test_auth_secret_32chars',
    ENCRYPTION_MASTER_KEY:
      overrides['ENCRYPTION_MASTER_KEY'] ?? 'Y2lfZW5jcnlwdGlvbl9rZXlfZXhhY3RseV8zMmJ5dGU=',
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

/** The migration-role connection, used to assert privilege separation. */
export function testMigrationDatabaseUrl(): string {
  const url = process.env['TEST_MIGRATION_DATABASE_URL'] ?? process.env['MIGRATION_DATABASE_URL']
  if (url === undefined || url === '') {
    throw new Error('MIGRATION_DATABASE_URL must be set for the integration suite.')
  }
  return url
}
