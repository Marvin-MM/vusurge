import { Value } from '@sinclair/typebox/value'
import {
  type AppConfig,
  type AppEnvironment,
  ConfigSchema,
  type LogLevel,
  type ProcessRole,
} from './config.schema'
// Imported for its registration side effect: without it, `format` keywords in
// the configuration schema are not validated at all.
import { REGISTERED_FORMATS } from './formats'

/**
 * Reads the process environment, coerces it into the configuration contract,
 * validates it, and applies the cross-field rules that a flat schema cannot
 * express (for example: "Resend credentials are required when email is on").
 *
 * Nothing here reads the environment lazily. If configuration is wrong the
 * process must fail at boot, loudly, before it can accept a single request.
 */

export class ConfigurationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join('\n  - ')}`)
    this.name = 'ConfigurationError'
  }
}

type Env = Record<string, string | undefined>

function str(env: Env, key: string, fallback?: string): string | undefined {
  const raw = env[key]
  if (raw === undefined || raw.trim() === '') return fallback
  return raw.trim()
}

function bool(env: Env, key: string, fallback: boolean): boolean {
  const raw = str(env, key)
  if (raw === undefined) return fallback
  const normalized = raw.toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  throw new ConfigurationError([`${key} must be a boolean value, received "${raw}"`])
}

function int(env: Env, key: string, fallback: number): number {
  const raw = str(env, key)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) {
    throw new ConfigurationError([`${key} must be an integer, received "${raw}"`])
  }
  return parsed
}

function list(env: Env, key: string, fallback: string[]): string[] {
  const raw = str(env, key)
  if (raw === undefined) return fallback
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value
}

const DEFAULT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const DEFAULT_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
]

export function loadConfig(env: Env = process.env as Env): AppConfig {
  // Touch the registry so the module cannot be eliminated as unused.
  void REGISTERED_FORMATS

  const environment = (str(env, 'APP_ENV', 'development') ?? 'development') as AppEnvironment
  const isProduction = environment === 'production'

  const candidate: AppConfig = {
    app: {
      environment,
      processRole: (str(env, 'PROCESS_ROLE', 'api') ?? 'api') as ProcessRole,
      serviceName: str(env, 'SERVICE_NAME', 'innovation-platform-backend') as string,
      version: str(env, 'BUILD_VERSION', '0.1.0') as string,
      publicBaseUrl: str(env, 'PUBLIC_BASE_URL', 'http://localhost:3000') as string,
      webAppBaseUrl: str(env, 'WEB_APP_BASE_URL', 'http://localhost:3001') as string,
      host: str(env, 'HOST', '0.0.0.0') as string,
      port: int(env, 'PORT', 3000),
      trustedOrigins: list(env, 'TRUSTED_ORIGINS', ['http://localhost:3001']),
      allowInsecureOrigins: bool(env, 'ALLOW_INSECURE_ORIGINS', false),
      trustedProxyCidrs: list(env, 'TRUSTED_PROXY_CIDRS', []),
      maxRequestBodyBytes: int(env, 'MAX_REQUEST_BODY_BYTES', 1_048_576),
      shutdownTimeoutMs: int(env, 'SHUTDOWN_TIMEOUT_MS', 25_000),
    },

    database: {
      url: str(env, 'DATABASE_URL', '') as string,
      listenerUrl: optional(str(env, 'DATABASE_LISTENER_URL')),
      poolMax: int(env, 'DATABASE_POOL_MAX', 10),
      connectionTimeoutMs: int(env, 'DATABASE_CONNECTION_TIMEOUT_MS', 5_000),
      idleTimeoutMs: int(env, 'DATABASE_IDLE_TIMEOUT_MS', 30_000),
      statementTimeoutMs: int(env, 'DATABASE_STATEMENT_TIMEOUT_MS', 30_000),
      maxSerializationRetries: int(env, 'DATABASE_MAX_SERIALIZATION_RETRIES', 3),
      slowQueryThresholdMs: int(env, 'DATABASE_SLOW_QUERY_THRESHOLD_MS', 500),
    },

    auth: {
      secret: str(env, 'BETTER_AUTH_SECRET', '') as string,
      basePath: str(env, 'AUTH_BASE_PATH', '/api/v1/auth') as string,
      sessionExpiresInSeconds: int(env, 'AUTH_SESSION_EXPIRES_IN_SECONDS', 60 * 60 * 24 * 7),
      sessionUpdateAgeSeconds: int(env, 'AUTH_SESSION_UPDATE_AGE_SECONDS', 60 * 60 * 24),
      freshSessionMaxAgeSeconds: int(env, 'AUTH_FRESH_SESSION_MAX_AGE_SECONDS', 15 * 60),
      cookiePrefix: str(env, 'AUTH_COOKIE_PREFIX', 'ip') as string,
      cookieDomain: optional(str(env, 'AUTH_COOKIE_DOMAIN')),
      google: {
        enabled: bool(env, 'GOOGLE_OAUTH_ENABLED', false),
        clientId: optional(str(env, 'GOOGLE_CLIENT_ID')),
        clientSecret: optional(str(env, 'GOOGLE_CLIENT_SECRET')),
      },
      github: {
        enabled: bool(env, 'GITHUB_OAUTH_ENABLED', false),
        clientId: optional(str(env, 'GITHUB_CLIENT_ID')),
        clientSecret: optional(str(env, 'GITHUB_CLIENT_SECRET')),
      },
    },

    cacheRedis: {
      url: str(env, 'CACHE_REDIS_URL', '') as string,
      keyPrefix: str(env, 'CACHE_REDIS_KEY_PREFIX', 'ip:cache:') as string,
      commandTimeoutMs: int(env, 'CACHE_REDIS_COMMAND_TIMEOUT_MS', 250),
      circuitBreakerThreshold: int(env, 'CACHE_CIRCUIT_BREAKER_THRESHOLD', 5),
      circuitBreakerResetMs: int(env, 'CACHE_CIRCUIT_BREAKER_RESET_MS', 10_000),
    },

    queueRedis: {
      url: str(env, 'QUEUE_REDIS_URL', '') as string,
      keyPrefix: str(env, 'QUEUE_REDIS_KEY_PREFIX', 'ip:queue') as string,
    },

    worker: {
      concurrency: {
        email: int(env, 'WORKER_CONCURRENCY_EMAIL', 10),
        notificationFanout: int(env, 'WORKER_CONCURRENCY_NOTIFICATION_FANOUT', 8),
        reminders: int(env, 'WORKER_CONCURRENCY_REMINDERS', 4),
        integrations: int(env, 'WORKER_CONCURRENCY_INTEGRATIONS', 4),
        analytics: int(env, 'WORKER_CONCURRENCY_ANALYTICS', 2),
        exports: int(env, 'WORKER_CONCURRENCY_EXPORTS', 2),
        mediaCleanup: int(env, 'WORKER_CONCURRENCY_MEDIA_CLEANUP', 2),
        cacheMaintenance: int(env, 'WORKER_CONCURRENCY_CACHE_MAINTENANCE', 2),
        outboxDispatch: int(env, 'WORKER_CONCURRENCY_OUTBOX_DISPATCH', 1),
      },
      outbox: {
        batchSize: int(env, 'OUTBOX_BATCH_SIZE', 100),
        // Fallback sweep for the LISTEN/NOTIFY relay, not the primary
        // dispatch trigger: notifications drive dispatch, this only bounds
        // the damage of a missed one. 5 minutes matches
        // OUTBOX_STALE_ENQUEUED_AFTER_MS, the other outbox safety net, so a
        // missed notification costs the same worst-case delay as a crashed
        // worker. On hosted Postgres (Neon), activity more frequent than the
        // compute suspend timeout also keeps the compute permanently awake.
        pollIntervalMs: int(env, 'OUTBOX_POLL_INTERVAL_MS', 300_000),
        staleEnqueuedAfterMs: int(env, 'OUTBOX_STALE_ENQUEUED_AFTER_MS', 300_000),
        maxAttempts: int(env, 'OUTBOX_MAX_ATTEMPTS', 10),
      },
      schedulers: {
        enabled: bool(env, 'WORKER_SCHEDULERS_ENABLED', true),
        retentionEveryMs: int(env, 'RETENTION_SCHEDULER_EVERY_MS', 3_600_000),
        // 5-minute cadence: these sweeps reconcile minute-scale staleness
        // windows (5-minute outbox leases, 24-hour reminder lead), so a
        // tighter interval only multiplies idle Redis traffic. Outbox
        // recovery additionally does not wait for this timer: the relay's
        // reconciliation notifies on reclaim.
        reconciliationEveryMs: int(env, 'RECONCILIATION_SCHEDULER_EVERY_MS', 300_000),
        remindersEveryMs: int(env, 'REMINDER_SCHEDULER_EVERY_MS', 300_000),
        analyticsRepairEveryMs: int(env, 'ANALYTICS_REPAIR_SCHEDULER_EVERY_MS', 900_000),
        reminderLeadHours: int(env, 'REMINDER_LEAD_HOURS', 24),
      },
    },

    email: {
      enabled: bool(env, 'EMAIL_ENABLED', isProduction),
      resendApiKey: optional(str(env, 'RESEND_API_KEY')),
      fromAddress: str(env, 'EMAIL_FROM_ADDRESS', 'no-reply@localhost') as string,
      fromName: str(env, 'EMAIL_FROM_NAME', 'Innovation Platform') as string,
      replyToAddress: optional(str(env, 'EMAIL_REPLY_TO_ADDRESS')),
      webhookSigningSecret: optional(str(env, 'RESEND_WEBHOOK_SECRET')),
      requestTimeoutMs: int(env, 'EMAIL_REQUEST_TIMEOUT_MS', 10_000),
      maxAttempts: int(env, 'EMAIL_MAX_ATTEMPTS', 5),
    },

    cloudinary: {
      enabled: bool(env, 'CLOUDINARY_ENABLED', isProduction),
      cloudName: optional(str(env, 'CLOUDINARY_CLOUD_NAME')),
      apiKey: optional(str(env, 'CLOUDINARY_API_KEY')),
      apiSecret: optional(str(env, 'CLOUDINARY_API_SECRET')),
      folderPrefix: str(env, 'CLOUDINARY_FOLDER_PREFIX', 'innovation-platform') as string,
      uploadSignatureTtlSeconds: int(env, 'CLOUDINARY_UPLOAD_SIGNATURE_TTL_SECONDS', 300),
      privateDeliveryTtlSeconds: int(env, 'CLOUDINARY_PRIVATE_DELIVERY_TTL_SECONDS', 900),
      requestTimeoutMs: int(env, 'CLOUDINARY_REQUEST_TIMEOUT_MS', 10_000),
    },

    objectStorage: {
      enabled: bool(env, 'OBJECT_STORAGE_ENABLED', true),
      endpoint: optional(str(env, 'S3_ENDPOINT')),
      region: str(env, 'S3_REGION', 'us-east-1') as string,
      bucket: str(env, 'S3_BUCKET', 'innovation-platform-private') as string,
      accessKeyId: optional(str(env, 'S3_ACCESS_KEY_ID')),
      secretAccessKey: optional(str(env, 'S3_SECRET_ACCESS_KEY')),
      forcePathStyle: bool(env, 'S3_FORCE_PATH_STYLE', true),
      // AWS supports SSE-S3 headers. Local MinIO requires a configured KMS for
      // the same header, so its development default relies on private local
      // disk while production bucket encryption remains an operator gate.
      sendSseHeaders: bool(env, 'S3_SEND_SSE_HEADERS', str(env, 'S3_ENDPOINT') === undefined),
      uploadUrlTtlSeconds: int(env, 'S3_UPLOAD_URL_TTL_SECONDS', 600),
      downloadUrlTtlSeconds: int(env, 'S3_DOWNLOAD_URL_TTL_SECONDS', 300),
      requestTimeoutMs: int(env, 'S3_REQUEST_TIMEOUT_MS', 10_000),
    },

    malwareScanner: {
      enabled: bool(env, 'MALWARE_SCANNER_ENABLED', false),
      host: str(env, 'MALWARE_SCANNER_HOST', '127.0.0.1') as string,
      port: int(env, 'MALWARE_SCANNER_PORT', 3310),
      timeoutMs: int(env, 'MALWARE_SCANNER_TIMEOUT_MS', 15_000),
    },

    features: {
      sseNotifications: bool(env, 'FEATURE_SSE_NOTIFICATIONS', false),
      documentUploads: bool(env, 'FEATURE_DOCUMENT_UPLOADS', false),
      slackIntegration: bool(env, 'FEATURE_SLACK_INTEGRATION', false),
      discordIntegration: bool(env, 'FEATURE_DISCORD_INTEGRATION', false),
      unlistedChallenges: bool(env, 'FEATURE_UNLISTED_CHALLENGES', true),
      openAuthenticatedParticipation: bool(env, 'FEATURE_OPEN_AUTHENTICATED_PARTICIPATION', true),
      mentorRole: bool(env, 'FEATURE_MENTOR_ROLE', true),
      directInnovationIntake: bool(env, 'FEATURE_DIRECT_INNOVATION_INTAKE', true),
      openApiUi: bool(env, 'FEATURE_OPENAPI_UI', !isProduction),
    },

    notificationStream: {
      heartbeatMs: int(env, 'SSE_NOTIFICATION_HEARTBEAT_MS', 15_000),
      pollMs: int(env, 'SSE_NOTIFICATION_POLL_MS', 2_000),
      maxConnectionsPerUser: int(env, 'SSE_NOTIFICATION_MAX_CONNECTIONS_PER_USER', 3),
      maxConnectionsPerIp: int(env, 'SSE_NOTIFICATION_MAX_CONNECTIONS_PER_IP', 10),
    },

    uploads: {
      maxImageBytes: int(env, 'UPLOAD_MAX_IMAGE_BYTES', 5_242_880),
      maxDocumentBytes: int(env, 'UPLOAD_MAX_DOCUMENT_BYTES', 26_214_400),
      maxSubmissionScreenshots: int(env, 'UPLOAD_MAX_SUBMISSION_SCREENSHOTS', 4),
      allowedImageMimeTypes: list(env, 'UPLOAD_ALLOWED_IMAGE_MIME_TYPES', DEFAULT_IMAGE_MIME_TYPES),
      allowedDocumentMimeTypes: list(
        env,
        'UPLOAD_ALLOWED_DOCUMENT_MIME_TYPES',
        DEFAULT_DOCUMENT_MIME_TYPES,
      ),
    },

    rateLimit: {
      enabled: bool(env, 'RATE_LIMIT_ENABLED', true),
      failClosedOnHighRisk: bool(env, 'RATE_LIMIT_FAIL_CLOSED_ON_HIGH_RISK', true),
      defaultWindowSeconds: int(env, 'RATE_LIMIT_DEFAULT_WINDOW_SECONDS', 60),
      defaultMaxRequests: int(env, 'RATE_LIMIT_DEFAULT_MAX_REQUESTS', 120),
    },

    pagination: {
      defaultPageSize: int(env, 'PAGINATION_DEFAULT_PAGE_SIZE', 25),
      maxPageSize: int(env, 'PAGINATION_MAX_PAGE_SIZE', 100),
    },

    encryption: {
      masterKey: str(env, 'ENCRYPTION_MASTER_KEY', '') as string,
      keyVersion: int(env, 'ENCRYPTION_KEY_VERSION', 1),
    },

    observability: {
      logLevel: (str(env, 'LOG_LEVEL', isProduction ? 'info' : 'debug') ?? 'info') as LogLevel,
      logPretty: bool(env, 'LOG_PRETTY', false),
      tracingEnabled: bool(env, 'OTEL_TRACING_ENABLED', false),
      metricsEnabled: bool(env, 'OTEL_METRICS_ENABLED', false),
      otlpTraceEndpoint: optional(str(env, 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT')),
      otlpMetricEndpoint: optional(str(env, 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT')),
      prometheusPort: optional(str(env, 'METRICS_PROMETHEUS_PORT'))
        ? int(env, 'METRICS_PROMETHEUS_PORT', 9464)
        : undefined,
      prometheusHost: str(env, 'METRICS_PROMETHEUS_HOST', '127.0.0.1') as string,
    },

    retention: {
      expiredInvitationDays: int(env, 'RETENTION_EXPIRED_INVITATION_DAYS', 90),
      rejectedApplicationDays: int(env, 'RETENTION_REJECTED_APPLICATION_DAYS', 365),
      exportFileDays: int(env, 'RETENTION_EXPORT_FILE_DAYS', 7),
      emailEventDays: int(env, 'RETENTION_EMAIL_EVENT_DAYS', 90),
      idempotencyRecordHours: int(env, 'RETENTION_IDEMPOTENCY_RECORD_HOURS', 48),
      webhookReceiptDays: int(env, 'RETENTION_WEBHOOK_RECEIPT_DAYS', 30),
      resolvedSupportTicketDays: int(env, 'RETENTION_RESOLVED_SUPPORT_TICKET_DAYS', 365),
      unclaimedMediaHours: int(env, 'RETENTION_UNCLAIMED_MEDIA_HOURS', 24),
      notificationDays: int(env, 'RETENTION_NOTIFICATION_DAYS', 180),
      auditEventDays: int(env, 'RETENTION_AUDIT_EVENT_DAYS', 2555),
      accountDeletionGraceDays: int(env, 'ACCOUNT_DELETION_GRACE_DAYS', 14),
      accountDeletionBatchSize: int(env, 'ACCOUNT_DELETION_BATCH_SIZE', 100),
    },
  }

  const issues: string[] = []

  for (const error of Value.Errors(ConfigSchema, candidate)) {
    issues.push(`${error.path || '/'}: ${error.message}`)
  }

  issues.push(...crossFieldIssues(candidate))

  if (issues.length > 0) {
    throw new ConfigurationError(issues)
  }

  return candidate
}

/** Rules that depend on more than one field, including feature-gated providers. */
function crossFieldIssues(config: AppConfig): string[] {
  const issues: string[] = []
  const isProduction = config.app.environment === 'production'

  if (config.database.url === '') {
    issues.push('DATABASE_URL is required')
  }
  if (config.cacheRedis.url === '') {
    issues.push('CACHE_REDIS_URL is required')
  }
  if (config.queueRedis.url === '') {
    issues.push('QUEUE_REDIS_URL is required')
  }
  if (config.auth.secret === '') {
    issues.push('BETTER_AUTH_SECRET is required (at least 32 characters)')
  }
  if (config.encryption.masterKey === '') {
    issues.push('ENCRYPTION_MASTER_KEY is required (base64-encoded 32 bytes)')
  } else if (!isBase64Bytes(config.encryption.masterKey, 32)) {
    issues.push('ENCRYPTION_MASTER_KEY must be exactly 32 bytes, base64-encoded')
  }

  if (config.cacheRedis.url === config.queueRedis.url && isProduction) {
    issues.push(
      'CACHE_REDIS_URL and QUEUE_REDIS_URL must reference separate Redis deployments in ' +
        'production: BullMQ requires maxmemory-policy=noeviction and the cache does not',
    )
  }

  if (config.auth.google.enabled) {
    if (!config.auth.google.clientId || !config.auth.google.clientSecret) {
      issues.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when Google OAuth is on')
    }
  }
  if (config.auth.github.enabled) {
    if (!config.auth.github.clientId || !config.auth.github.clientSecret) {
      issues.push('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required when GitHub OAuth is on')
    }
  }

  if (config.email.enabled && !config.email.resendApiKey) {
    issues.push('RESEND_API_KEY is required when EMAIL_ENABLED is true')
  }
  if (isProduction && !config.email.enabled) {
    issues.push('EMAIL_ENABLED must be true in production: the platform sends security email')
  }
  if (isProduction && !config.email.webhookSigningSecret) {
    issues.push('RESEND_WEBHOOK_SECRET is required in production to verify delivery webhooks')
  }

  if (config.cloudinary.enabled) {
    const { cloudName, apiKey, apiSecret } = config.cloudinary
    if (!cloudName || !apiKey || !apiSecret) {
      issues.push(
        'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required ' +
          'when CLOUDINARY_ENABLED is true',
      )
    }
  }
  if (isProduction && !config.cloudinary.enabled) {
    issues.push('CLOUDINARY_ENABLED must be true in production: private image delivery requires it')
  }

  if (config.objectStorage.enabled) {
    const { accessKeyId, secretAccessKey } = config.objectStorage
    if (!accessKeyId || !secretAccessKey) {
      issues.push(
        'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when OBJECT_STORAGE_ENABLED ' +
          'is true (exports are written to private object storage)',
      )
    }
  }

  if (config.features.documentUploads && !config.objectStorage.enabled) {
    issues.push('FEATURE_DOCUMENT_UPLOADS requires OBJECT_STORAGE_ENABLED')
  }
  if (config.features.documentUploads && !config.malwareScanner.enabled) {
    issues.push('FEATURE_DOCUMENT_UPLOADS requires MALWARE_SCANNER_ENABLED')
  }

  if (isProduction && !config.objectStorage.enabled) {
    // Sensitive exports must land in private object storage; there is no
    // supported fallback that keeps them off local disk.
    issues.push('OBJECT_STORAGE_ENABLED must be true in production: exports require it')
  }

  if (config.observability.tracingEnabled && !config.observability.otlpTraceEndpoint) {
    issues.push('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is required when tracing is enabled')
  }

  if (isProduction) {
    if (config.observability.logPretty) {
      issues.push('LOG_PRETTY must be false in production: logs must stay machine-parseable')
    }
    if (config.app.allowInsecureOrigins) {
      // Pre-launch waiver: the public base URL may stay on http while the
      // deployment has no TLS story yet, and loopback origins are trusted so
      // a developer's local frontend can call this API. Anything else on
      // plaintext is still rejected — the waiver must never widen to an
      // arbitrary network origin.
      for (const origin of config.app.trustedOrigins) {
        if (!origin.startsWith('https://') && !isLoopbackOrigin(origin)) {
          issues.push(
            `TRUSTED_ORIGINS entry "${origin}" must use https in production ` +
              '(ALLOW_INSECURE_ORIGINS only permits http://localhost loopback origins)',
          )
        }
      }
    } else {
      if (!config.app.publicBaseUrl.startsWith('https://')) {
        issues.push('PUBLIC_BASE_URL must use https in production')
      }
      for (const origin of config.app.trustedOrigins) {
        if (!origin.startsWith('https://')) {
          issues.push(`TRUSTED_ORIGINS entry "${origin}" must use https in production`)
        }
      }
    }
    if (config.database.url.includes('sslmode=disable')) {
      issues.push('DATABASE_URL must not disable TLS in production')
    }
  }

  if (config.pagination.defaultPageSize > config.pagination.maxPageSize) {
    issues.push('PAGINATION_DEFAULT_PAGE_SIZE cannot exceed PAGINATION_MAX_PAGE_SIZE')
  }

  return issues
}

function isBase64Bytes(value: string, expectedBytes: number): boolean {
  try {
    return Buffer.from(value, 'base64').length === expectedBytes
  } catch {
    return false
  }
}

/**
 * True only for `http://localhost`, `http://127.0.0.1`, `http://[::1]`, on
 * any port. Loopback traffic never leaves the developer's machine, so an
 * http origin there is not network-exposed the way a LAN origin would be.
 */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:') return false
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  } catch {
    return false
  }
}
