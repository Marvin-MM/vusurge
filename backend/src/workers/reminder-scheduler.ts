import type { Infrastructure } from '../container'
import { QueueName } from '../shared/queue'

interface DueReminderRow {
  id: string
  organization_id: string
  revision: number
}

/**
 * Atomically advances due schedules and emits their semantic outbox event.
 * Multiple scheduler replicas share work through SKIP LOCKED, and a revision
 * is dispatched at most once even if a worker crashes and retries.
 */
export async function dispatchDueReminders(
  infrastructure: Infrastructure,
  batchSize = 500,
): Promise<number> {
  return infrastructure.transactions.withPlatformAccess(
    async (tx) => {
      const now = await infrastructure.transactions.databaseNow(tx)
      const due = await tx.$queryRaw<DueReminderRow[]>`
        select id, organization_id, revision
        from reminder_schedule
        where status = 'SCHEDULED'
          and scheduled_for <= ${now}
        order by scheduled_for asc, id asc
        limit ${batchSize}
        for update skip locked
      `

      let dispatched = 0
      for (const reminder of due) {
        const claimed = await tx.reminderSchedule.updateMany({
          where: {
            id: reminder.id,
            status: 'SCHEDULED',
            revision: reminder.revision,
          },
          data: {
            status: 'SENT',
            sentAt: now,
            lastDispatchedRevision: reminder.revision,
          },
        })
        if (claimed.count !== 1) continue

        await infrastructure.outbox.write(tx, {
          eventType: 'reminder.due',
          queueName: QueueName.Reminders,
          aggregateType: 'reminder_schedule',
          aggregateId: reminder.id,
          organizationId: reminder.organization_id,
          dedupeKey: `reminder-due:${reminder.id}:${reminder.revision}`,
          payload: { reminderScheduleId: reminder.id, revision: reminder.revision },
        })
        dispatched += 1
      }
      return dispatched
    },
    {
      purpose: 'Dispatch due relational reminder schedules.',
      isolationLevel: 'Serializable',
    },
  )
}
