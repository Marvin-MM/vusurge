import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { NotificationsController } from './notifications.controller'
import {
  NotificationListQuery,
  NotificationListResponse,
  NotificationPreferenceResponse,
  UnreadCountResponse,
  UpdateNotificationPreferenceBody,
} from './notifications.dto'

export function notificationsRoutes(controller: NotificationsController, auth: AuthPlugin) {
  return new Elysia({ name: 'notifications-routes' })
    .use(auth)
    .get('/me/notifications', ({ access, query }) => controller.listMine(access, query), {
      requireAuth: true,
      query: NotificationListQuery,
      response: { 200: NotificationListResponse, ...CommonErrorResponses },
      detail: { tags: ['Notifications'], summary: "List the caller's own notifications" },
    })
    .get('/me/notifications/unread-count', ({ access }) => controller.getUnreadCount(access), {
      requireAuth: true,
      response: { 200: UnreadCountResponse, ...CommonErrorResponses },
      detail: { tags: ['Notifications'], summary: 'Get unread notification count' },
    })
    .get(
      '/me/notifications/stream',
      (context) =>
        controller.streamMine(
          context.access,
          (context as typeof context & { clientIp?: string }).clientIp,
          context.request.signal,
        ),
      {
        requireAuth: true,
        response: { 200: t.Unknown(), ...CommonErrorResponses },
        detail: {
          tags: ['Notifications'],
          summary: 'Stream notifications with Server-Sent Events',
          description:
            'Optional authenticated one-way stream with heartbeat and bounded connections. Polling remains supported.',
        },
      },
    )
    .post(
      '/me/notifications/:notificationId/read',
      async ({ access, params, set }) => {
        await controller.markRead(access, params.notificationId)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ notificationId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Notifications'], summary: 'Mark one notification read' },
      },
    )
    .post(
      '/me/notifications/read-all',
      async ({ access, set }) => {
        await controller.markAllRead(access)
        set.status = 204
      },
      {
        requireAuth: true,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Notifications'], summary: 'Mark every notification read' },
      },
    )
    .get('/me/notification-preferences', ({ access }) => controller.getPreferences(access), {
      requireAuth: true,
      response: { 200: NotificationPreferenceResponse, ...CommonErrorResponses },
      detail: { tags: ['Notifications'], summary: 'Get notification preferences' },
    })
    .patch(
      '/me/notification-preferences',
      ({ access, body }) => controller.updatePreferences(access, body.disabledCategories),
      {
        requireAuth: true,
        body: UpdateNotificationPreferenceBody,
        response: { 200: NotificationPreferenceResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Notifications'],
          summary: 'Update notification preferences',
          description:
            'Security/legal categories cannot be disabled; attempts to do so are silently ignored.',
        },
      },
    )
}
