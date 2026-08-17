import type { TenantTransactionRunner } from '../../shared/database'
import { newId } from '../../shared/ids'
import type { NotificationCategory } from './notifications.repository'
import { NON_DISABLEABLE_CATEGORIES } from './notifications.service'

/**
 * Standalone fan-out helper for job handlers.
 *
 * Handlers run outside the module composition graph (`registerJobHandlers`
 * only receives `Infrastructure`, not the wired module services), so this
 * takes the plain database client directly rather than depending on
 * `NotificationsService`. Same preference-respecting logic as
 * `NotificationsService.notify` — kept as a thin, dependency-free duplicate
 * rather than threading the whole service through the job-handler wiring for
 * one method.
 */
export async function notifyUser(
  transactions: TenantTransactionRunner,
  input: {
    userId: string
    organizationId?: string
    category: NotificationCategory
    title: string
    body: string
    linkUrl?: string
    sourceKey: string
  },
): Promise<void> {
  await transactions.withPlatformAccess(
    async (tx) => {
      if (!NON_DISABLEABLE_CATEGORIES.has(input.category)) {
        const preference = await tx.notificationPreference.findUnique({
          where: { userId: input.userId },
        })
        if (preference?.disabledCategories.includes(input.category) === true) return
      }

      await tx.notification.createMany({
        data: [
          {
            id: newId(),
            userId: input.userId,
            organizationId: input.organizationId,
            sourceKey: input.sourceKey,
            category: input.category,
            title: input.title,
            body: input.body,
            linkUrl: input.linkUrl,
          },
        ],
        skipDuplicates: true,
      })
    },
    { purpose: 'notification-delivery' },
  )
}
