import { type Static, Type } from '@sinclair/typebox'

/**
 * Startup configuration contract.
 *
 * Every value the processes need is declared here and validated once, at boot,
 * before any dependency is constructed. Missing or malformed required values
 * abort the process rather than surfacing as a runtime failure under load.
 *
 * Optional providers are only required when their feature toggle is enabled;
 * that conditional requirement is enforced in config.ts, not in this schema.
 */

const NonEmptyString = Type.String({ minLength: 1 })
const Url = Type.String({ minLength: 1, format: 'uri' })

export const AppEnvironment = Type.Union([
  Type.Literal('development'),
  Type.Literal('test'),
  Type.Literal('staging'),
  Type.Literal('production'),
])
export type AppEnvironment = Static<typeof AppEnvironment>

export const ProcessRole = Type.Union([Type.Literal('api'), Type.Literal('worker')])
export type ProcessRole = Static<typeof ProcessRole>

export const LogLevel = Type.Union([
  Type.Literal('fatal'),
  Type.Literal('error'),
  Type.Literal('warn'),
  Type.Literal('info'),
  Type.Literal('debug'),
  Type.Literal('trace'),
])
export type LogLevel = Static<typeof LogLevel>

export const ConfigSchema = Type.Object({
  app: Type.Object({
    environment: AppEnvironment,
    processRole: ProcessRole,
    serviceName: NonEmptyString,
    version: NonEmptyString,
    /** Canonical externally reachable base URL of this API. */
    publicBaseUrl: Url,
    /** Canonical base URL of the web client, used to build links in email. */
    webAppBaseUrl: Url,
    host: NonEmptyString,
    port: Type.Integer({ minimum: 1, maximum: 65535 }),
    /** Origins permitted to make credentialed cross-origin requests. */
    trustedOrigins: Type.Array(Url),
    /**
     * Pre-launch waiver: permit loopback `http://` origins in TRUSTED_ORIGINS
     * (and a non-https PUBLIC_BASE_URL) while APP_ENV=production, so a local
     * frontend can develop against a hosted API. Only loopback origins are
     * exempt; must be false before serving real users.
     */
    allowInsecureOrigins: Type.Boolean(),
    /** Proxy networks allowed to supply X-Forwarded-For/X-Real-IP. */
    trustedProxyCidrs: Type.Array(NonEmptyString),
    /** Hard cap on request body size, in bytes. */
    maxRequestBodyBytes: Type.Integer({ minimum: 1024 }),
    /** Grace period for in-flight work during shutdown, in milliseconds. */
    shutdownTimeoutMs: Type.Integer({ minimum: 1000, maximum: 120_000 }),
  }),

  database: Type.Object({
    /** Runtime connection. MUST use the least-privilege application role. */
    url: NonEmptyString,
    /**
     * Dedicated session for PostgreSQL LISTEN/NOTIFY (outbox wake-ups).
     * MUST point at a direct, non-pooled endpoint when `url` goes through a
     * transaction-mode pooler (Neon pooled endpoint, PgBouncer), because a
     * pooled session cannot hold LISTEN registration. Unset means `url` is
     * already a direct connection.
     */
    listenerUrl: Type.Optional(NonEmptyString),
    poolMax: Type.Integer({ minimum: 1, maximum: 200 }),
    connectionTimeoutMs: Type.Integer({ minimum: 100 }),
    idleTimeoutMs: Type.Integer({ minimum: 1000 }),
    statementTimeoutMs: Type.Integer({ minimum: 100 }),
    /** Retries for genuinely retryable serialization/connectivity failures only. */
    maxSerializationRetries: Type.Integer({ minimum: 0, maximum: 10 }),
    slowQueryThresholdMs: Type.Integer({ minimum: 1 }),
  }),

  auth: Type.Object({
    secret: Type.String({ minLength: 32 }),
    /** Path the Better Auth handler is mounted under. */
    basePath: NonEmptyString,
    sessionExpiresInSeconds: Type.Integer({ minimum: 300 }),
    sessionUpdateAgeSeconds: Type.Integer({ minimum: 60 }),
    /** Maximum session age, in seconds, still considered "fresh" for sensitive actions. */
    freshSessionMaxAgeSeconds: Type.Integer({ minimum: 60 }),
    cookiePrefix: NonEmptyString,
    /** Cookie domain. Omit for host-only cookies, which is the safer default. */
    cookieDomain: Type.Optional(NonEmptyString),
    google: Type.Object({
      enabled: Type.Boolean(),
      clientId: Type.Optional(NonEmptyString),
      clientSecret: Type.Optional(NonEmptyString),
    }),
    github: Type.Object({
      enabled: Type.Boolean(),
      clientId: Type.Optional(NonEmptyString),
      clientSecret: Type.Optional(NonEmptyString),
    }),
  }),

  cacheRedis: Type.Object({
    url: NonEmptyString,
    keyPrefix: NonEmptyString,
    commandTimeoutMs: Type.Integer({ minimum: 10 }),
    /** Consecutive failures before the cache circuit opens. */
    circuitBreakerThreshold: Type.Integer({ minimum: 1 }),
    circuitBreakerResetMs: Type.Integer({ minimum: 100 }),
  }),

  queueRedis: Type.Object({
    url: NonEmptyString,
    keyPrefix: NonEmptyString,
  }),

  worker: Type.Object({
    /** Per-queue concurrency. Bulkheads urgent work away from bulk work. */
    concurrency: Type.Object({
      email: Type.Integer({ minimum: 1, maximum: 100 }),
      notificationFanout: Type.Integer({ minimum: 1, maximum: 100 }),
      reminders: Type.Integer({ minimum: 1, maximum: 100 }),
      integrations: Type.Integer({ minimum: 1, maximum: 100 }),
      analytics: Type.Integer({ minimum: 1, maximum: 50 }),
      exports: Type.Integer({ minimum: 1, maximum: 20 }),
      mediaCleanup: Type.Integer({ minimum: 1, maximum: 20 }),
      cacheMaintenance: Type.Integer({ minimum: 1, maximum: 20 }),
      outboxDispatch: Type.Integer({ minimum: 1, maximum: 10 }),
    }),
    outbox: Type.Object({
      batchSize: Type.Integer({ minimum: 1, maximum: 1000 }),
      /**
       * Fallback poll interval for the LISTEN/NOTIFY outbox relay: how often
       * the relay sweeps for pending events even if no notification arrived.
       * Bounds the damage of a missed notification (listener reconnect gap,
       * notification dropped by a pooler) — it is a safety net, not the
       * primary dispatch trigger.
       */
      pollIntervalMs: Type.Integer({ minimum: 100 }),
      /** ENQUEUED rows older than this are reclaimed by the reconciler. */
      staleEnqueuedAfterMs: Type.Integer({ minimum: 1000 }),
      maxAttempts: Type.Integer({ minimum: 1, maximum: 50 }),
    }),
    schedulers: Type.Object({
      enabled: Type.Boolean(),
      retentionEveryMs: Type.Integer({ minimum: 60_000 }),
      reconciliationEveryMs: Type.Integer({ minimum: 10_000 }),
      remindersEveryMs: Type.Integer({ minimum: 10_000 }),
      analyticsRepairEveryMs: Type.Integer({ minimum: 60_000 }),
      reminderLeadHours: Type.Integer({ minimum: 1, maximum: 720 }),
    }),
  }),

  email: Type.Object({
    /** Disabled only in test/dev; sending is required in production. */
    enabled: Type.Boolean(),
    resendApiKey: Type.Optional(NonEmptyString),
    fromAddress: NonEmptyString,
    fromName: NonEmptyString,
    replyToAddress: Type.Optional(NonEmptyString),
    webhookSigningSecret: Type.Optional(NonEmptyString),
    requestTimeoutMs: Type.Integer({ minimum: 100 }),
    maxAttempts: Type.Integer({ minimum: 1, maximum: 10 }),
  }),

  cloudinary: Type.Object({
    enabled: Type.Boolean(),
    cloudName: Type.Optional(NonEmptyString),
    apiKey: Type.Optional(NonEmptyString),
    apiSecret: Type.Optional(NonEmptyString),
    /** Root folder every generated upload signature is confined to. */
    folderPrefix: NonEmptyString,
    uploadSignatureTtlSeconds: Type.Integer({ minimum: 30, maximum: 3600 }),
    privateDeliveryTtlSeconds: Type.Integer({ minimum: 30, maximum: 86_400 }),
    requestTimeoutMs: Type.Integer({ minimum: 100 }),
  }),

  objectStorage: Type.Object({
    /** Exports always need object storage; user document upload is separate. */
    enabled: Type.Boolean(),
    endpoint: Type.Optional(NonEmptyString),
    region: NonEmptyString,
    bucket: NonEmptyString,
    accessKeyId: Type.Optional(NonEmptyString),
    secretAccessKey: Type.Optional(NonEmptyString),
    forcePathStyle: Type.Boolean(),
    /** Send x-amz-server-side-encryption=AES256 when the provider supports it. */
    sendSseHeaders: Type.Boolean(),
    uploadUrlTtlSeconds: Type.Integer({ minimum: 30, maximum: 3600 }),
    downloadUrlTtlSeconds: Type.Integer({ minimum: 30, maximum: 3600 }),
    requestTimeoutMs: Type.Integer({ minimum: 100 }),
  }),

  malwareScanner: Type.Object({
    enabled: Type.Boolean(),
    host: NonEmptyString,
    port: Type.Integer({ minimum: 1, maximum: 65535 }),
    timeoutMs: Type.Integer({ minimum: 100 }),
  }),

  features: Type.Object({
    /** One-way SSE notification stream. Polling always remains supported. */
    sseNotifications: Type.Boolean(),
    /** Private non-image document upload. */
    documentUploads: Type.Boolean(),
    slackIntegration: Type.Boolean(),
    discordIntegration: Type.Boolean(),
    unlistedChallenges: Type.Boolean(),
    openAuthenticatedParticipation: Type.Boolean(),
    mentorRole: Type.Boolean(),
    directInnovationIntake: Type.Boolean(),
    /** Serve the OpenAPI UI. The specification stays buildable regardless. */
    openApiUi: Type.Boolean(),
  }),

  notificationStream: Type.Object({
    heartbeatMs: Type.Integer({ minimum: 5_000, maximum: 120_000 }),
    pollMs: Type.Integer({ minimum: 500, maximum: 30_000 }),
    maxConnectionsPerUser: Type.Integer({ minimum: 1, maximum: 20 }),
    maxConnectionsPerIp: Type.Integer({ minimum: 1, maximum: 100 }),
  }),

  uploads: Type.Object({
    maxImageBytes: Type.Integer({ minimum: 1024 }),
    maxDocumentBytes: Type.Integer({ minimum: 1024 }),
    maxSubmissionScreenshots: Type.Integer({ minimum: 1, maximum: 4 }),
    allowedImageMimeTypes: Type.Array(NonEmptyString, { minItems: 1 }),
    allowedDocumentMimeTypes: Type.Array(NonEmptyString),
  }),

  rateLimit: Type.Object({
    enabled: Type.Boolean(),
    /** Fail closed on high-risk endpoints when Redis is unavailable. */
    failClosedOnHighRisk: Type.Boolean(),
    defaultWindowSeconds: Type.Integer({ minimum: 1 }),
    defaultMaxRequests: Type.Integer({ minimum: 1 }),
  }),

  pagination: Type.Object({
    defaultPageSize: Type.Integer({ minimum: 1, maximum: 200 }),
    maxPageSize: Type.Integer({ minimum: 1, maximum: 500 }),
  }),

  encryption: Type.Object({
    /** Base64 32-byte key used to seal integration credentials at rest. */
    masterKey: NonEmptyString,
    keyVersion: Type.Integer({ minimum: 1 }),
  }),

  observability: Type.Object({
    logLevel: LogLevel,
    /** Pretty logs are never appropriate in production. */
    logPretty: Type.Boolean(),
    tracingEnabled: Type.Boolean(),
    metricsEnabled: Type.Boolean(),
    otlpTraceEndpoint: Type.Optional(NonEmptyString),
    otlpMetricEndpoint: Type.Optional(NonEmptyString),
    /** Prometheus scrape listener. Bind to an internal interface only. */
    prometheusPort: Type.Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
    prometheusHost: NonEmptyString,
  }),

  retention: Type.Object({
    /**
     * Operator-configurable retention windows, in days. The defaults shipped
     * here are engineering placeholders, NOT legal advice: operators must set
     * these from their own jurisdiction and organizational policy before
     * launch. See docs/retention.md.
     */
    expiredInvitationDays: Type.Integer({ minimum: 1 }),
    rejectedApplicationDays: Type.Integer({ minimum: 1 }),
    exportFileDays: Type.Integer({ minimum: 1 }),
    emailEventDays: Type.Integer({ minimum: 1 }),
    idempotencyRecordHours: Type.Integer({ minimum: 1 }),
    webhookReceiptDays: Type.Integer({ minimum: 1 }),
    resolvedSupportTicketDays: Type.Integer({ minimum: 1 }),
    unclaimedMediaHours: Type.Integer({ minimum: 1 }),
    notificationDays: Type.Integer({ minimum: 1 }),
    auditEventDays: Type.Integer({ minimum: 30 }),
    accountDeletionGraceDays: Type.Integer({ minimum: 1, maximum: 365 }),
    accountDeletionBatchSize: Type.Integer({ minimum: 1, maximum: 1000 }),
  }),
})

export type AppConfig = Static<typeof ConfigSchema>
