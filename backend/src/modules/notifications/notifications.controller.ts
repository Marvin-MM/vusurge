import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { Page } from '../../shared/http'
import type { NotificationPreferenceRow, NotificationRow } from './notifications.repository'
import type { NotificationsService } from './notifications.service'

function serialize(row: NotificationRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    category: row.category,
    title: row.title,
    body: row.body,
    linkUrl: row.linkUrl,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializePage(page: Page<NotificationRow>) {
  return { items: page.items.map(serialize), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

function serializePreference(row: NotificationPreferenceRow) {
  return { disabledCategories: row.disabledCategories }
}

export function createNotificationsController(service: NotificationsService) {
  return {
    async listMine(
      access: AccessContext,
      query: { limit?: number; cursor?: string; unreadOnly?: boolean },
    ) {
      requireActor(access)
      const page = await service.listMine(access, query)
      return serializePage(page)
    },

    async getUnreadCount(access: AccessContext) {
      requireActor(access)
      const count = await service.getUnreadCount(access)
      return { count }
    },

    streamMine(access: AccessContext, clientIp: string | undefined, signal: AbortSignal) {
      requireActor(access)
      return service.streamMine(access, clientIp, signal)
    },

    async markRead(access: AccessContext, notificationId: string) {
      requireActor(access)
      await service.markRead(access, notificationId)
    },

    async markAllRead(access: AccessContext) {
      requireActor(access)
      await service.markAllRead(access)
    },

    async getPreferences(access: AccessContext) {
      requireActor(access)
      const row = await service.getPreferences(access)
      return serializePreference(row)
    },

    async updatePreferences(
      access: AccessContext,
      disabledCategories: NotificationPreferenceRow['disabledCategories'],
    ) {
      requireActor(access)
      const row = await service.updatePreferences(access, disabledCategories)
      return serializePreference(row)
    },
  }
}

export type NotificationsController = ReturnType<typeof createNotificationsController>
