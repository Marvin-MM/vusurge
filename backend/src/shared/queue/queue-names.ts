/**
 * The fixed set of logical queues.
 *
 * Deliberately coarse. A queue per event type would multiply Redis keys,
 * worker connections, and operational dashboards without improving isolation
 * (master prompt section 20).
 *
 * Separation here exists for two reasons only:
 *   priority   urgent transactional email must never queue behind a bulk export
 *   bulkhead   heavy analytics/export work gets its own concurrency budget
 */
export const QueueName = {
  /** Transactional and security email. Highest priority; never starved. */
  Email: 'email',
  /** In-app notification fan-out, and preference-aware channel dispatch. */
  NotificationFanout: 'notification-fanout',
  /** Deadline, judging, and portfolio review reminders. */
  Reminders: 'reminders',
  /** Outbound Slack/Discord webhook delivery. */
  Integrations: 'integrations',
  /** Rollup computation and repair. Heavy; isolated from urgent work. */
  Analytics: 'analytics',
  /** CSV generation and upload to private object storage. Heavy. */
  Exports: 'exports',
  /** Orphaned Cloudinary assets and abandoned object uploads. */
  MediaCleanup: 'media-cleanup',
  /** Cache warming and invalidation driven by domain events. */
  CacheMaintenance: 'cache-maintenance',
  /** Outbox dispatch, reconciliation, and retention sweeps. */
  OutboxDispatch: 'outbox-dispatch',
} as const

export type QueueName = (typeof QueueName)[keyof typeof QueueName]

export const ALL_QUEUE_NAMES: readonly QueueName[] = Object.values(QueueName)

export function isQueueName(value: string): value is QueueName {
  return (ALL_QUEUE_NAMES as readonly string[]).includes(value)
}
