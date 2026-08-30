# Environment variable reference

Every variable is read once, at process boot, validated against
`src/shared/config/config.schema.ts`, and applied through cross-field rules
in `src/shared/config/config.ts` (`crossFieldIssues`). A missing or malformed
required value aborts the process immediately with exit code 78 (`EX_CONFIG`)
and a full list of every issue found — configuration is never validated
lazily or partially.

**`.env.example` is the authoritative, fully commented template** — copy it
to `.env` for local development. This document is a structured index over
the same variables, organized by config section, noting what is required and
in which environment. Neither file ever contains a real secret.

## Application

| Variable | Default | Required | Notes |
|---|---|---|---|
| `APP_ENV` | `development` | | `development` \| `test` \| `staging` \| `production` |
| `PROCESS_ROLE` | `api` | | `api` \| `worker` — selects which entrypoint behavior/readiness applies |
| `SERVICE_NAME` | `innovation-platform-backend` | | |
| `BUILD_VERSION` | `0.1.0` | | Set from CI build metadata |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | | Must be `https://` in production |
| `WEB_APP_BASE_URL` | `http://localhost:3001` | | Used to build links in transactional email |
| `HOST` | `0.0.0.0` | | |
| `PORT` | `3000` | | |
| `TRUSTED_ORIGINS` | `http://localhost:3001` | | Comma-separated; all must be `https://` in production unless the `ALLOW_INSECURE_ORIGINS` waiver covers them |
| `ALLOW_INSECURE_ORIGINS` | `false` | | Pre-launch waiver: permits loopback (`http://localhost`/`127.0.0.1`/`[::1]`) origins in `TRUSTED_ORIGINS` and a non-https `PUBLIC_BASE_URL` while `APP_ENV=production`, and relaxes session cookies (`SameSite=None`) for cross-site local development. Must be `false` (or unset) before serving real users; never covers non-loopback http origins |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | | |
| `SHUTDOWN_TIMEOUT_MS` | `25000` | | Grace period for in-flight work during SIGTERM/SIGINT |

## PostgreSQL

| Variable | Default | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | — | **yes** | Runtime connection; must use the least-privilege `ip_app` role (NOSUPERUSER, NOBYPASSRLS) |
| `DATABASE_LISTENER_URL` | unset (use `DATABASE_URL`) | required with a transaction-mode pooler | Direct (non-pooled) endpoint for the outbox relay's LISTEN/NOTIFY session. A pooled session cannot hold LISTEN registration, so when `DATABASE_URL` goes through Neon's pooled endpoint or PgBouncer, point this at the direct host (for Neon, `DATABASE_URL` with `-pooler` removed) |
| `DIRECT_DATABASE_URL` | unset (use `DATABASE_URL`) | required with a transaction-mode pooler | Used only by `bun run db:migrate` (`prisma migrate deploy` in the k8s initContainers); must be the non-pooled endpoint for the migration advisory lock. Never read by a running API/worker process |
| `DATABASE_POOL_MAX` | `10` | | |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `5000` | | |
| `DATABASE_IDLE_TIMEOUT_MS` | `30000` | | |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `30000` | | |
| `DATABASE_MAX_SERIALIZATION_RETRIES` | `3` | | Retries apply only to genuinely retryable serialization/deadlock failures |
| `DATABASE_SLOW_QUERY_THRESHOLD_MS` | `500` | | |

## Database bootstrap (one-time, operator-run only)

Read only by `bun run db:bootstrap` (`scripts/bootstrap-db.sql`), which
creates the `ip_migrator` and `ip_app` roles. Requires a superuser connection
and is never read by the API or worker process.

| Variable | Default |
|---|---|
| `BOOTSTRAP_DATABASE_URL` | — |
| `DB_MIGRATOR_USER` / `DB_MIGRATOR_PASSWORD` | `ip_migrator` / — |
| `DB_APP_USER` / `DB_APP_PASSWORD` | `ip_app` / — |
| `SHADOW_DATABASE_NAME` / `SHADOW_DATABASE_URL` | dev/CI only — `prisma migrate diff` replays migration history here. Unset in production, which uses `migrate deploy` exclusively. |

## Authentication (Better Auth)

| Variable | Default | Required | Notes |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | — | **yes**, ≥32 chars | Rotating it invalidates every active session |
| `AUTH_BASE_PATH` | `/api/v1/auth` | | |
| `AUTH_SESSION_EXPIRES_IN_SECONDS` | `604800` (7d) | | |
| `AUTH_SESSION_UPDATE_AGE_SECONDS` | `86400` (1d) | | |
| `AUTH_FRESH_SESSION_MAX_AGE_SECONDS` | `900` | | How recently the user must have authenticated for a fresh-session-gated action (see `docs/permissions-matrix.md`) |
| `AUTH_COOKIE_PREFIX` | `ip` | | |
| `AUTH_COOKIE_DOMAIN` | host-only | | Set only if API and web client are on different subdomains of one registrable domain |
| `GOOGLE_OAUTH_ENABLED` | `false` | | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` required when true |
| `GITHUB_OAUTH_ENABLED` | `false` | | `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` required when true; only default public scopes requested, never private-repo scopes |

## Redis (two separate deployments)

| Variable | Default | Required | Notes |
|---|---|---|---|
| `CACHE_REDIS_URL` | — | **yes** | TTL-friendly eviction (`allkeys-lru`), safe to lose |
| `CACHE_REDIS_KEY_PREFIX` | `ip:cache:` | | |
| `CACHE_REDIS_COMMAND_TIMEOUT_MS` | `250` | | |
| `CACHE_CIRCUIT_BREAKER_THRESHOLD` | `5` | | Consecutive failures before the cache circuit opens |
| `CACHE_CIRCUIT_BREAKER_RESET_MS` | `10000` | | |
| `QUEUE_REDIS_URL` | — | **yes** | BullMQ. Must use `maxmemory-policy=noeviction` + persistence. **Must differ from `CACHE_REDIS_URL` in production** — boot fails otherwise. |
| `QUEUE_REDIS_KEY_PREFIX` | `ip:queue` | | |

## Worker concurrency and outbox

See `docs/queue-catalog.md` for what each `WORKER_CONCURRENCY_*` bulkhead
protects.

| Variable | Default |
|---|---|
| `WORKER_CONCURRENCY_EMAIL` | `10` |
| `WORKER_CONCURRENCY_NOTIFICATION_FANOUT` | `8` |
| `WORKER_CONCURRENCY_REMINDERS` | `4` |
| `WORKER_CONCURRENCY_INTEGRATIONS` | `4` |
| `WORKER_CONCURRENCY_ANALYTICS` | `2` |
| `WORKER_CONCURRENCY_EXPORTS` | `2` |
| `WORKER_CONCURRENCY_MEDIA_CLEANUP` | `2` |
| `WORKER_CONCURRENCY_CACHE_MAINTENANCE` | `2` |
| `WORKER_CONCURRENCY_OUTBOX_DISPATCH` | `1` |
| `OUTBOX_BATCH_SIZE` | `100` |
| `OUTBOX_POLL_INTERVAL_MS` | `300000` | | Fallback sweep for the LISTEN/NOTIFY outbox relay: bounds the delay of a missed notification; dispatch itself is notification-driven. Matches `OUTBOX_STALE_ENQUEUED_AFTER_MS` so a missed notification costs no more than a crashed worker; on autosuspend hosts (Neon) polling faster than the suspend timeout keeps the compute awake |
| `OUTBOX_STALE_ENQUEUED_AFTER_MS` | `300000` (5 min) — rows stuck `ENQUEUED` longer than this are reclaimed |
| `OUTBOX_MAX_ATTEMPTS` | `10` |

## Email (Resend)

| Variable | Default | Required | Notes |
|---|---|---|---|
| `EMAIL_ENABLED` | `false` (dev/test), **must be `true` in production** | production: yes | Boot fails in production if false — the platform sends security email |
| `RESEND_API_KEY` | — | required when `EMAIL_ENABLED=true` | |
| `EMAIL_FROM_ADDRESS` | `no-reply@localhost` | | Use a dedicated transactional subdomain with SPF/DKIM/DMARC; never enable open/click tracking on authentication email |
| `EMAIL_FROM_NAME` | `Innovation Platform` | | |
| `EMAIL_REPLY_TO_ADDRESS` | unset | | |
| `RESEND_WEBHOOK_SECRET` | unset | required in production | Verifies delivery/bounce/complaint webhook signatures (Svix HMAC) |
| `EMAIL_REQUEST_TIMEOUT_MS` | `10000` | | |
| `EMAIL_MAX_ATTEMPTS` | `5` | | |

There is deliberately no Gmail/generic SMTP fallback path (ADR-0016) — Resend
is the only transport, behind the `EmailProvider` interface.

## Cloudinary (images only)

Documents and generated exports use S3-compatible storage instead (ADR-0007).

| Variable | Default | Required |
|---|---|---|
| `CLOUDINARY_ENABLED` | `false` (dev/test), `true` in production | `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET` required when true |
| `CLOUDINARY_FOLDER_PREFIX` | `innovation-platform` | Every signed upload is confined to this folder root |
| `CLOUDINARY_UPLOAD_SIGNATURE_TTL_SECONDS` | `300` | |
| `CLOUDINARY_PRIVATE_DELIVERY_TTL_SECONDS` | `900` | |
| `CLOUDINARY_REQUEST_TIMEOUT_MS` | `10000` | Applied by the SDK to Admin/upload API requests |

## S3-compatible private object storage

Holds generated exports and, when `FEATURE_DOCUMENT_UPLOADS` is on, private
uploaded documents. Bucket must be private and encrypted at rest.

| Variable | Default | Required |
|---|---|---|
| `OBJECT_STORAGE_ENABLED` | `true`; **must be `true` in production** | yes |
| `S3_ENDPOINT` | unset (AWS S3) | Set for MinIO/other S3-compatible providers |
| `S3_REGION` | `us-east-1` | |
| `S3_BUCKET` | `innovation-platform-private` | |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | required when `OBJECT_STORAGE_ENABLED=true` |
| `S3_FORCE_PATH_STYLE` | `true` | |
| `S3_SEND_SSE_HEADERS` | true for AWS, false when a custom endpoint is set | Enable only if the provider supports SSE-S3 headers; otherwise enforce encryption in bucket policy/configuration |
| `S3_UPLOAD_URL_TTL_SECONDS` | `600` | |
| `S3_DOWNLOAD_URL_TTL_SECONDS` | `300` | |
| `S3_REQUEST_TIMEOUT_MS` | `10000` | Abort deadline passed to the actual AWS SDK request |

## Malware scanner

Document uploads require a reachable scanner; otherwise the capability stays
disabled and quarantined objects are never exposed as clean.

| Variable | Default | Required |
|---|---|---|
| `MALWARE_SCANNER_ENABLED` | `false` | must be true with `FEATURE_DOCUMENT_UPLOADS` |
| `MALWARE_SCANNER_HOST` | `127.0.0.1` | local compose publishes ClamAV on the host |
| `MALWARE_SCANNER_PORT` | `3310` | use `53310` from the host with local compose |
| `MALWARE_SCANNER_TIMEOUT_MS` | `15000` | |

## Feature gates

Secure defaults: off unless the supporting infrastructure is present and the
product has decided to enable them. See `GET /api/v1/meta/capabilities` for
the safe, client-visible subset.

| Variable | Default |
|---|---|
| `FEATURE_SSE_NOTIFICATIONS` | `false` — polling always remains supported regardless |
| `SSE_NOTIFICATION_HEARTBEAT_MS` | `15000`; heartbeat cadence for authenticated notification streams |
| `SSE_NOTIFICATION_POLL_MS` | `2000`; database polling interval used by the one-way stream |
| `SSE_NOTIFICATION_MAX_CONNECTIONS_PER_USER` | `3`; per-process user connection cap |
| `SSE_NOTIFICATION_MAX_CONNECTIONS_PER_IP` | `10`; per-process resolved-client-IP connection cap |
| `FEATURE_DOCUMENT_UPLOADS` | `false` — requires object storage and malware scanning |
| `FEATURE_SLACK_INTEGRATION` | `false` |
| `FEATURE_DISCORD_INTEGRATION` | `false` |
| `FEATURE_UNLISTED_CHALLENGES` | `true` |
| `FEATURE_OPEN_AUTHENTICATED_PARTICIPATION` | `true` |
| `FEATURE_MENTOR_ROLE` | `true` |
| `FEATURE_DIRECT_INNOVATION_INTAKE` | `true` |
| `FEATURE_OPENAPI_UI` | `true` (dev/test), `false` in production | Serves the browsable API console; the OpenAPI JSON document is always exportable regardless |

## Uploads, rate limiting, pagination

| Variable | Default |
|---|---|
| `UPLOAD_MAX_IMAGE_BYTES` | `5242880` (5 MiB) |
| `UPLOAD_MAX_DOCUMENT_BYTES` | `26214400` (25 MiB) |
| `UPLOAD_MAX_SUBMISSION_SCREENSHOTS` | `4` — hard product limit, also enforced by a database check constraint |
| `UPLOAD_ALLOWED_IMAGE_MIME_TYPES` | `image/png,image/jpeg,image/webp,image/gif` |
| `UPLOAD_ALLOWED_DOCUMENT_MIME_TYPES` | `application/pdf,...pptx,...docx,text/csv` |
| `RATE_LIMIT_ENABLED` | `true` |
| `RATE_LIMIT_FAIL_CLOSED_ON_HIGH_RISK` | `true` — when Redis is unavailable, high-risk policies (credentials, join codes, invitation tokens) deny rather than allow; never disable this |
| `RATE_LIMIT_DEFAULT_WINDOW_SECONDS` | `60` |
| `RATE_LIMIT_DEFAULT_MAX_REQUESTS` | `120` |
| `PAGINATION_DEFAULT_PAGE_SIZE` | `25` |
| `PAGINATION_MAX_PAGE_SIZE` | `100` |

## Encryption

| Variable | Default | Required |
|---|---|---|
| `ENCRYPTION_MASTER_KEY` | — | **yes**, base64-encoded exactly 32 bytes (`openssl rand -base64 32`) — seals integration webhook credentials at rest with AES-256-GCM |
| `ENCRYPTION_KEY_VERSION` | `1` | Ciphertext records its sealing version; follow the maintenance re-encryption procedure before switching the one loaded key |

## Observability

| Variable | Default | Notes |
|---|---|---|
| `LOG_LEVEL` | `debug` (dev), `info` (prod) | |
| `LOG_PRETTY` | `false` | Must stay `false` in production — logs must remain machine-parseable JSON |
| `OTEL_TRACING_ENABLED` / `OTEL_METRICS_ENABLED` | `false` | |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | unset | Required when tracing is enabled |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | unset | |
| `METRICS_PROMETHEUS_PORT` | unset | Bind to an internal interface only — deliberately outside the public API namespace |
| `METRICS_PROMETHEUS_HOST` | `127.0.0.1` | |

## Data retention

**Engineering defaults, not legal advice** — operators must set every window
from their own jurisdiction and organizational policy before launch. See
`docs/retention.md`.

| Variable | Default |
|---|---|
| `RETENTION_EXPIRED_INVITATION_DAYS` | `90` |
| `RETENTION_REJECTED_APPLICATION_DAYS` | `365` |
| `RETENTION_EXPORT_FILE_DAYS` | `7` |
| `RETENTION_EMAIL_EVENT_DAYS` | `90` |
| `RETENTION_IDEMPOTENCY_RECORD_HOURS` | `48` |
| `RETENTION_WEBHOOK_RECEIPT_DAYS` | `30` |
| `RETENTION_RESOLVED_SUPPORT_TICKET_DAYS` | `365` |
| `RETENTION_UNCLAIMED_MEDIA_HOURS` | `24` |
| `RETENTION_NOTIFICATION_DAYS` | `180` |
| `RETENTION_AUDIT_EVENT_DAYS` | `2555` (~7 years) — **not enforced by the application**: the runtime role has only `INSERT`/`SELECT` on `audit_event`, so any eventual audit-history pruning is an operator-run, migration-role action outside the application's own privilege boundary |
| `ACCOUNT_DELETION_GRACE_DAYS` | `14` |
| `ACCOUNT_DELETION_BATCH_SIZE` | `100` |

## Production-only extra checks

Enforced by `crossFieldIssues` and not separately toggleable:

- `LOG_PRETTY` must be `false`.
- `PUBLIC_BASE_URL` and every entry in `TRUSTED_ORIGINS` must use `https://` —
  except while the pre-launch `ALLOW_INSECURE_ORIGINS=true` waiver is active,
  which exempts `PUBLIC_BASE_URL` and loopback `TRUSTED_ORIGINS` entries only.
- `DATABASE_URL` must not contain `sslmode=disable`.
- `EMAIL_ENABLED` and `OBJECT_STORAGE_ENABLED` must both be `true`.
- `RESEND_WEBHOOK_SECRET` must be set.
- `CACHE_REDIS_URL` and `QUEUE_REDIS_URL` must be distinct.
