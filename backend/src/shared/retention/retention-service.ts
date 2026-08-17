import type { Infrastructure } from '../../container'
import { executeEligibleAccountDeletions } from '../account-deletion'
import { describeError } from '../logging'

/**
 * Configured data retention (master prompt section 42, background job list
 * in section 49).
 *
 * This is a callable sweep, not a scheduler: no cron/repeatable-job
 * infrastructure exists in this codebase yet (the outbox dispatcher polls
 * on its own short interval; nothing else does), and building one is a
 * meaningfully larger addition than the sweep logic itself. `runRetentionSweep`
 * is designed to be invoked by whatever triggers it in a given deployment —
 * a Kubernetes CronJob, a systemd timer, or a future in-process
 * scheduler — via `scripts/run-retention-sweep.ts`. Every retention window
 * is read from `config.retention.*`, never hard-coded, per the master
 * prompt's instruction not to invent legal retention durations in code.
 *
 * `audit_event` is deliberately not swept here: the runtime database role
 * is granted only INSERT/SELECT on it (enforced in migration SQL) precisely
 * so the application cannot alter or delete audit history, including this
 * job. Audit retention/pseudonymization is an operator-run, migration-role
 * action outside the application's own privilege boundary — a different
 * tool, not a gap in this one.
 *
 * Each task is independent and best-effort: one failing task is recorded in
 * the report and does not prevent the others from running.
 */

export interface RetentionSweepReport {
  idempotencyRecordsPurged: number
  mediaAssetsPurged: number
  webhookEventsPurged: number
  notificationsPurged: number
  rejectedApplicationsPurged: number
  invitationsPurged: number
  joinCodesPurged: number
  exportsPurged: number
  supportTicketsPurged: number
  accountDeletionsCompleted: number
  accountDeletionsHeld: number
  accountDeletionsBlocked: number
  errors: { task: string; message: string }[]
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600 * 1000)
}

function daysAgo(days: number): Date {
  return hoursAgo(days * 24)
}

export async function runRetentionSweep(
  infrastructure: Infrastructure,
): Promise<RetentionSweepReport> {
  const { database, idempotency, transactions, objectStorage, config, logger } = infrastructure
  const client = database.client
  const retention = config.retention

  const report: RetentionSweepReport = {
    idempotencyRecordsPurged: 0,
    mediaAssetsPurged: 0,
    webhookEventsPurged: 0,
    notificationsPurged: 0,
    rejectedApplicationsPurged: 0,
    invitationsPurged: 0,
    joinCodesPurged: 0,
    exportsPurged: 0,
    supportTicketsPurged: 0,
    accountDeletionsCompleted: 0,
    accountDeletionsHeld: 0,
    accountDeletionsBlocked: 0,
    errors: [],
  }

  async function task(name: string, run: () => Promise<number>): Promise<number> {
    try {
      return await run()
    } catch (error) {
      logger.error({ err: describeError(error), task: name }, 'Retention task failed')
      report.errors.push({
        task: name,
        message: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  // --- Global tables (no RLS): plain client is sufficient -------------------

  report.idempotencyRecordsPurged = await task('idempotency_records', () =>
    idempotency.purgeExpired(),
  )

  report.mediaAssetsPurged = await task('media_assets', () =>
    transactions.withPlatformAccess(
      async (tx) => {
        const now = await transactions.databaseNow(tx)
        const expired = await tx.mediaAsset.findMany({
          where: { status: 'PENDING', expiresAt: { lte: now } },
          select: { id: true, organizationId: true },
          take: 500,
        })
        let scheduled = 0
        for (const asset of expired) {
          const changed = await tx.mediaAsset.updateMany({
            where: { id: asset.id, status: 'PENDING' },
            data: { status: 'PENDING_DELETION', deletionRequestedAt: now },
          })
          if (changed.count !== 1) continue
          await infrastructure.outbox.write(tx, {
            eventType: 'media.asset_deletion_requested',
            queueName: 'media-cleanup',
            aggregateType: 'media_asset',
            aggregateId: asset.id,
            organizationId: asset.organizationId ?? undefined,
            payload: { assetId: asset.id },
            dedupeKey: `media.asset_deletion_requested:${asset.id}`,
          })
          scheduled += 1
        }
        return scheduled
      },
      { purpose: 'retention: tombstone abandoned image uploads for provider cleanup' },
    ),
  )

  report.webhookEventsPurged = await task('webhook_events', async () => {
    const result = await client.webhookEvent.deleteMany({
      where: { receivedAt: { lt: daysAgo(retention.webhookReceiptDays) } },
    })
    return result.count
  })

  report.notificationsPurged = await task('notifications', async () => {
    // Only already-read notifications are pruned; an unread one stays until
    // the recipient has actually seen it, regardless of age.
    return transactions.withPlatformAccess(
      async (tx) => {
        const now = await transactions.databaseNow(tx)
        const cutoff = new Date(now.getTime() - retention.notificationDays * 24 * 3600 * 1000)
        const result = await tx.notification.deleteMany({
          where: { readAt: { lt: cutoff } },
        })
        return result.count
      },
      { purpose: 'retention: purge read notifications past the configured window' },
    )
  })

  report.rejectedApplicationsPurged = await task('rejected_applications', async () => {
    const result = await client.organizationApplication.deleteMany({
      where: { status: 'REJECTED', updatedAt: { lt: daysAgo(retention.rejectedApplicationDays) } },
    })
    return result.count
  })

  report.supportTicketsPurged = await task('support_tickets', async () => {
    const result = await client.supportTicket.deleteMany({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] },
        updatedAt: { lt: daysAgo(retention.resolvedSupportTicketDays) },
      },
    })
    return result.count
  })

  await task('account_deletions', async () => {
    const deletionReport = await executeEligibleAccountDeletions(infrastructure)
    report.accountDeletionsCompleted = deletionReport.completed
    report.accountDeletionsHeld = deletionReport.held
    report.accountDeletionsBlocked = deletionReport.blocked
    for (const failure of deletionReport.failures) {
      report.errors.push({
        task: `account_deletion:${failure.requestId}`,
        message: failure.message,
      })
    }
    return deletionReport.completed
  })

  // --- Tenant-scoped tables (RLS): a purpose-bound cross-tenant sweep -------

  report.invitationsPurged = await task('invitations', () =>
    transactions.withPlatformAccess(
      async (tx) => {
        const cutoff = daysAgo(retention.expiredInvitationDays)
        const result = await tx.organizationInvitation.deleteMany({
          where: {
            OR: [
              { status: 'PENDING', expiresAt: { lt: cutoff } },
              { status: { in: ['DECLINED', 'REVOKED', 'EXPIRED'] }, updatedAt: { lt: cutoff } },
            ],
          },
        })
        return result.count
      },
      { purpose: 'retention: purge expired/revoked invitations' },
    ),
  )

  report.joinCodesPurged = await task('join_codes', () =>
    transactions.withPlatformAccess(
      async (tx) => {
        const cutoff = daysAgo(retention.expiredInvitationDays)
        const result = await tx.organizationJoinCode.deleteMany({
          where: {
            OR: [{ revokedAt: null, expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
          },
        })
        return result.count
      },
      { purpose: 'retention: purge expired/revoked join codes' },
    ),
  )

  report.exportsPurged = await task('exports', async () => {
    const expired = await transactions.withPlatformAccess(
      (tx) =>
        tx.dataExport.findMany({
          where: { expiresAt: { lt: new Date() } },
          select: { id: true, storageKey: true },
        }),
      { purpose: 'retention: find expired exports' },
    )
    if (expired.length === 0) return 0

    for (const row of expired) {
      if (row.storageKey !== null) {
        await objectStorage.deleteObject(row.storageKey).catch((error: unknown) => {
          logger.warn(
            { err: describeError(error), exportId: row.id },
            'Failed to delete an expired export file from object storage; the row will still be purged',
          )
        })
      }
    }

    return transactions.withPlatformAccess(
      async (tx) => {
        const result = await tx.dataExport.deleteMany({
          where: { id: { in: expired.map((row) => row.id) } },
        })
        return result.count
      },
      { purpose: 'retention: purge expired export records' },
    )
  })

  return report
}
