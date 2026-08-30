import { type Counter, type Histogram, metrics, type ObservableGauge } from '@opentelemetry/api'

/**
 * The application metric registry.
 *
 * Every metric required by master prompt section 40 is declared once here, so
 * naming stays consistent and call sites cannot silently invent a new series.
 * Attributes are always low-cardinality: route templates rather than raw paths,
 * queue names rather than job IDs, and never user, tenant, or resource IDs.
 */

const METER_NAME = 'innovation-platform-backend'

export interface AppMetrics {
  // HTTP
  readonly httpRequests: Counter
  readonly httpRequestDuration: Histogram
  readonly authFailures: Counter
  readonly rateLimitEvents: Counter

  // PostgreSQL
  readonly dbQueryDuration: Histogram
  readonly dbSlowQueries: Counter
  readonly dbPoolInUse: ObservableGauge
  readonly dbPoolWaiting: ObservableGauge
  readonly dbTransactionRetries: Counter

  // Redis / cache
  readonly cacheOperations: Counter
  readonly cacheOperationDuration: Histogram
  readonly cacheDegradedMode: Counter

  // Queue / outbox
  readonly queueJobsCompleted: Counter
  readonly queueJobsFailed: Counter
  readonly queueJobDuration: Histogram
  readonly queueJobWaitDuration: Histogram
  readonly queueDepth: ObservableGauge
  readonly outboxOldestPendingAgeSeconds: Histogram
  readonly outboxDispatched: Counter
  readonly outboxReconciled: Counter
  /** Relay wake-ups by source — how much dispatch work is notification-driven. */
  readonly outboxRelayWakes: Counter
  /** LISTEN/NOTIFY delivery self-test outcomes at relay startup. */
  readonly outboxNotifySelfTest: Counter

  // Providers
  readonly emailSends: Counter
  readonly emailDeliveryEvents: Counter
  readonly integrationDeliveries: Counter
  readonly uploadFailures: Counter

  // Domain
  readonly submissionFinalizations: Counter
  readonly judgingScorecardSubmissions: Counter
  readonly exportDuration: Histogram
  readonly exportFailures: Counter
}

let registry: AppMetrics | undefined

export function createMetrics(): AppMetrics {
  const meter = metrics.getMeter(METER_NAME)

  return {
    httpRequests: meter.createCounter('http.server.requests', {
      description: 'HTTP requests by route template, method and status class',
    }),
    httpRequestDuration: meter.createHistogram('http.server.duration', {
      description: 'HTTP request duration',
      unit: 'ms',
    }),
    authFailures: meter.createCounter('auth.failures', {
      description: 'Authentication and authorization denials by reason',
    }),
    rateLimitEvents: meter.createCounter('ratelimit.events', {
      description: 'Rate limit decisions by policy and outcome',
    }),

    dbQueryDuration: meter.createHistogram('db.query.duration', {
      description: 'Database operation duration',
      unit: 'ms',
    }),
    dbSlowQueries: meter.createCounter('db.query.slow', {
      description: 'Queries exceeding the configured slow-query threshold',
    }),
    dbPoolInUse: meter.createObservableGauge('db.pool.in_use', {
      description: 'Connections currently checked out of the pool',
    }),
    dbPoolWaiting: meter.createObservableGauge('db.pool.waiting', {
      description: 'Callers waiting for a pooled connection',
    }),
    dbTransactionRetries: meter.createCounter('db.transaction.retries', {
      description: 'Transactions retried after a serialization failure',
    }),

    cacheOperations: meter.createCounter('cache.operations', {
      description: 'Cache operations by result (hit, miss, error, skipped)',
    }),
    cacheOperationDuration: meter.createHistogram('cache.operation.duration', {
      description: 'Cache operation duration',
      unit: 'ms',
    }),
    cacheDegradedMode: meter.createCounter('cache.degraded_mode', {
      description: 'Requests served from PostgreSQL because the cache circuit was open',
    }),

    queueJobsCompleted: meter.createCounter('queue.jobs.completed', {
      description: 'Queue jobs completed successfully',
    }),
    queueJobsFailed: meter.createCounter('queue.jobs.failed', {
      description: 'Queue job failures by queue and whether the attempt was final',
    }),
    queueJobDuration: meter.createHistogram('queue.job.duration', {
      description: 'Queue job processing duration',
      unit: 'ms',
    }),
    queueJobWaitDuration: meter.createHistogram('queue.job.wait_duration', {
      description: 'Time a job waited between enqueue and processing',
      unit: 'ms',
    }),
    queueDepth: meter.createObservableGauge('queue.depth', {
      description: 'Jobs waiting in each queue',
    }),
    outboxOldestPendingAgeSeconds: meter.createHistogram('outbox.oldest_pending.age', {
      description: 'Age of the oldest undispatched outbox event',
      unit: 's',
    }),
    outboxDispatched: meter.createCounter('outbox.dispatched', {
      description: 'Outbox events dispatched to a queue',
    }),
    outboxReconciled: meter.createCounter('outbox.reconciled', {
      description: 'Stale outbox events reclaimed by the reconciler',
    }),
    outboxRelayWakes: meter.createCounter('outbox.relay.wakes', {
      description: 'Outbox relay wake-ups by source (notification, fallback, reconciliation)',
    }),
    outboxNotifySelfTest: meter.createCounter('outbox.notify.self_test', {
      description: 'LISTEN/NOTIFY delivery self-test outcomes (passed, failed)',
    }),

    emailSends: meter.createCounter('email.sends', {
      description: 'Transactional email send attempts by category and outcome',
    }),
    emailDeliveryEvents: meter.createCounter('email.delivery_events', {
      description: 'Provider delivery, bounce and complaint events',
    }),
    integrationDeliveries: meter.createCounter('integration.deliveries', {
      description: 'Outbound Slack/Discord deliveries by outcome',
    }),
    uploadFailures: meter.createCounter('upload.failures', {
      description: 'Image and object upload failures by stage',
    }),

    submissionFinalizations: meter.createCounter('submission.finalizations', {
      description: 'Final submission attempts by outcome',
    }),
    judgingScorecardSubmissions: meter.createCounter('judging.scorecard_submissions', {
      description: 'Scorecard submissions by outcome',
    }),
    exportDuration: meter.createHistogram('export.duration', {
      description: 'Export generation duration',
      unit: 'ms',
    }),
    exportFailures: meter.createCounter('export.failures', {
      description: 'Export generation failures by export type',
    }),
  }
}

/**
 * Shared registry.
 *
 * Instruments are cheap no-ops until a MeterProvider is installed, so modules
 * may resolve them at import time even when metrics are disabled.
 */
export function appMetrics(): AppMetrics {
  if (registry === undefined) {
    registry = createMetrics()
  }
  return registry
}

/** Reset the memoized registry. Used by tests that install their own provider. */
export function resetMetricsRegistry(): void {
  registry = undefined
}
