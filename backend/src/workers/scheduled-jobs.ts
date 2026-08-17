import type { Infrastructure } from '../container'
import type { AppConfig } from '../shared/config/config.schema'
import type { OutboxDispatcher } from '../shared/outbox'
import { QueueName, type QueueName as QueueNameType } from '../shared/queue'
import { runRetentionSweep } from '../shared/retention'
import { repairAnalyticsRollups } from './analytics-rollups'
import { dispatchDueReminders } from './reminder-scheduler'

export const ScheduledJobName = {
  RetentionSweep: 'maintenance.retention_sweep',
  OutboxReconciliation: 'maintenance.outbox_reconciliation',
  EmailReconciliation: 'maintenance.email_reconciliation',
  MediaCleanup: 'maintenance.media_cleanup',
  ReminderDispatch: 'maintenance.reminder_dispatch',
  AnalyticsRepair: 'maintenance.analytics_repair',
} as const

export type ScheduledJobName = (typeof ScheduledJobName)[keyof typeof ScheduledJobName]

interface ScheduledJobDefinition {
  readonly queue: QueueNameType
  readonly everyMs: (config: AppConfig) => number
}

export const SCHEDULED_JOB_CATALOG: Readonly<Record<ScheduledJobName, ScheduledJobDefinition>> = {
  [ScheduledJobName.RetentionSweep]: {
    queue: QueueName.OutboxDispatch,
    everyMs: (config) => config.worker.schedulers.retentionEveryMs,
  },
  [ScheduledJobName.OutboxReconciliation]: {
    queue: QueueName.OutboxDispatch,
    everyMs: (config) => config.worker.schedulers.reconciliationEveryMs,
  },
  [ScheduledJobName.EmailReconciliation]: {
    queue: QueueName.Email,
    everyMs: (config) => config.worker.schedulers.reconciliationEveryMs,
  },
  [ScheduledJobName.MediaCleanup]: {
    queue: QueueName.MediaCleanup,
    everyMs: (config) => config.worker.schedulers.reconciliationEveryMs,
  },
  [ScheduledJobName.ReminderDispatch]: {
    queue: QueueName.Reminders,
    everyMs: (config) => config.worker.schedulers.remindersEveryMs,
  },
  [ScheduledJobName.AnalyticsRepair]: {
    queue: QueueName.Analytics,
    everyMs: (config) => config.worker.schedulers.analyticsRepairEveryMs,
  },
}

export const ALL_SCHEDULED_JOB_NAMES = Object.freeze(
  Object.keys(SCHEDULED_JOB_CATALOG).sort() as ScheduledJobName[],
)

export interface ScheduledJobData {
  readonly kind: 'scheduled'
  readonly scheduledJobName: ScheduledJobName
}

export async function installScheduledJobs(infrastructure: Infrastructure): Promise<void> {
  if (!infrastructure.config.worker.schedulers.enabled) return

  for (const jobName of ALL_SCHEDULED_JOB_NAMES) {
    const definition = SCHEDULED_JOB_CATALOG[jobName]
    await infrastructure.queues.get(definition.queue).upsertJobScheduler(
      jobName,
      { every: definition.everyMs(infrastructure.config) },
      {
        name: jobName,
        data: { kind: 'scheduled', scheduledJobName: jobName } satisfies ScheduledJobData,
        opts: { attempts: infrastructure.config.worker.outbox.maxAttempts },
      },
    )
  }
}

async function reconcileEmailDeliveries(infrastructure: Infrastructure): Promise<number> {
  return infrastructure.transactions.withPlatformAccess(
    async (tx) => {
      const result = await tx.emailDelivery.updateMany({
        where: {
          status: 'SENDING',
          leaseExpiresAt: { lte: await infrastructure.transactions.databaseNow(tx) },
        },
        data: { status: 'PENDING', leaseExpiresAt: null },
      })
      return result.count
    },
    { purpose: 'Reclaim expired email-delivery worker leases.' },
  )
}

async function reconcileAbandonedMedia(infrastructure: Infrastructure): Promise<number> {
  return infrastructure.transactions.withPlatformAccess(
    async (tx) => {
      const now = await infrastructure.transactions.databaseNow(tx)
      let scheduled = 0

      const images = await tx.mediaAsset.findMany({
        where: { status: 'PENDING', expiresAt: { lte: now } },
        orderBy: { expiresAt: 'asc' },
        take: 500,
        select: { id: true, organizationId: true },
      })
      for (const image of images) {
        const changed = await tx.mediaAsset.updateMany({
          where: { id: image.id, status: 'PENDING' },
          data: { status: 'PENDING_DELETION', deletionRequestedAt: now },
        })
        if (changed.count !== 1) continue
        await infrastructure.outbox.write(tx, {
          eventType: 'media.asset_deletion_requested',
          queueName: QueueName.MediaCleanup,
          aggregateType: 'media_asset',
          aggregateId: image.id,
          organizationId: image.organizationId ?? undefined,
          payload: { assetId: image.id },
          dedupeKey: `media.asset_deletion_requested:${image.id}`,
        })
        scheduled += 1
      }

      const objects = await tx.storedObject.findMany({
        where: { status: 'PENDING_UPLOAD', uploadExpiresAt: { lte: now } },
        orderBy: { uploadExpiresAt: 'asc' },
        take: 500,
        include: { fileAsset: { select: { id: true } } },
      })
      for (const object of objects) {
        const changed = await tx.storedObject.updateMany({
          where: { id: object.id, status: 'PENDING_UPLOAD' },
          data: { status: 'PENDING_DELETION', deletionRequestedAt: now },
        })
        if (changed.count !== 1) continue
        if (object.fileAsset !== null) {
          await tx.fileAsset.updateMany({
            where: { id: object.fileAsset.id, status: 'ACTIVE' },
            data: { status: 'PENDING_DELETION' },
          })
        }
        await infrastructure.outbox.write(tx, {
          eventType: 'file.deletion_requested',
          queueName: QueueName.MediaCleanup,
          aggregateType: 'stored_object',
          aggregateId: object.id,
          organizationId: object.organizationId,
          payload: {
            organizationId: object.organizationId,
            storedObjectId: object.id,
            ...(object.fileAsset === null ? {} : { fileId: object.fileAsset.id }),
          },
          dedupeKey: `file.deletion_requested:${object.fileAsset?.id ?? object.id}`,
        })
        scheduled += 1
      }

      return scheduled
    },
    { purpose: 'Tombstone abandoned uploads and schedule provider cleanup.' },
  )
}

export async function runScheduledJob(
  infrastructure: Infrastructure,
  dispatcher: OutboxDispatcher,
  jobName: ScheduledJobName,
): Promise<void> {
  switch (jobName) {
    case ScheduledJobName.RetentionSweep:
      await runRetentionSweep(infrastructure)
      return
    case ScheduledJobName.OutboxReconciliation:
      await dispatcher.reconcileStale()
      await dispatcher.oldestPendingAgeSeconds()
      return
    case ScheduledJobName.EmailReconciliation:
      await reconcileEmailDeliveries(infrastructure)
      return
    case ScheduledJobName.MediaCleanup:
      await reconcileAbandonedMedia(infrastructure)
      return
    case ScheduledJobName.ReminderDispatch:
      await dispatchDueReminders(infrastructure)
      return
    case ScheduledJobName.AnalyticsRepair:
      await repairAnalyticsRollups(infrastructure)
      return
  }
}
