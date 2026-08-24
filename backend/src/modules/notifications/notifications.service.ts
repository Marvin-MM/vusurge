import type { AccessContext } from '../../shared/authorization'
import { requireVerifiedActor } from '../../shared/authorization'
import type { AppConfig } from '../../shared/config'
import type { TenantTransactionRunner } from '../../shared/database'
import { featureDisabled, rateLimited } from '../../shared/errors'
import { type Page, type PaginationLimits, toPageRequest } from '../../shared/http'
import { newId } from '../../shared/ids'
import { describeError, type Logger } from '../../shared/logging'
import type {
  NotificationCategory,
  NotificationPreferenceRow,
  NotificationRow,
  NotificationsRepository,
} from './notifications.repository'

/**
 * Categories a user cannot disable (master prompt section 19:
 * "must not be able to disable security-critical/authentication/legal
 * notifications required for requested operations"). Mirrors
 * `SECURITY_EMAIL_CATEGORIES` in the email provider: these two are decisions
 * about the user's own legal standing (do they own an organization, are they
 * an approved participant), not engagement noise.
 */
export const NON_DISABLEABLE_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  'ORGANIZATION_APPLICATION_DECISION',
  'PARTICIPATION_DECISION',
])

export interface NotifyInput {
  userId: string
  organizationId?: string
  category: NotificationCategory
  title: string
  body: string
  linkUrl?: string
  sourceKey?: string
}

export interface NotificationsService {
  listMine(
    access: AccessContext,
    query: { limit?: number; cursor?: string; unreadOnly?: boolean },
  ): Promise<Page<NotificationRow>>
  getUnreadCount(access: AccessContext): Promise<number>
  markRead(access: AccessContext, notificationId: string): Promise<void>
  markAllRead(access: AccessContext): Promise<void>
  getPreferences(access: AccessContext): Promise<NotificationPreferenceRow>
  updatePreferences(
    access: AccessContext,
    disabledCategories: NotificationCategory[],
  ): Promise<NotificationPreferenceRow>
  streamMine(access: AccessContext, clientIp: string | undefined, signal: AbortSignal): Response
  /**
   * Fan-out entry point for job handlers and services: creates a
   * notification unless the recipient has disabled that category (and the
   * category is not one of the non-disableable ones). Never throws for a
   * missing recipient — the caller already has its own idempotent retry
   * semantics via the outbox.
   */
  notify(input: NotifyInput): Promise<void>
}

export function createNotificationsService(
  repository: NotificationsRepository,
  transactions: TenantTransactionRunner,
  config: AppConfig,
  paginationLimits: PaginationLimits,
  logger: Logger,
): NotificationsService {
  const userConnections = new Map<string, number>()
  const ipConnections = new Map<string, number>()

  function acquireStream(userId: string, clientIp: string | undefined): () => void {
    const ipKey = clientIp ?? 'unresolved'
    const userCount = userConnections.get(userId) ?? 0
    const ipCount = ipConnections.get(ipKey) ?? 0
    if (userCount >= config.notificationStream.maxConnectionsPerUser) {
      throw rateLimited('Too many notification streams are open for this user.', 15)
    }
    if (ipCount >= config.notificationStream.maxConnectionsPerIp) {
      throw rateLimited('Too many notification streams are open from this address.', 15)
    }
    userConnections.set(userId, userCount + 1)
    ipConnections.set(ipKey, ipCount + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      const nextUserCount = (userConnections.get(userId) ?? 1) - 1
      const nextIpCount = (ipConnections.get(ipKey) ?? 1) - 1
      if (nextUserCount <= 0) userConnections.delete(userId)
      else userConnections.set(userId, nextUserCount)
      if (nextIpCount <= 0) ipConnections.delete(ipKey)
      else ipConnections.set(ipKey, nextIpCount)
    }
  }

  return {
    async listMine(access, query) {
      const { actor } = requireVerifiedActor(access)
      const page = toPageRequest(query, paginationLimits)
      return transactions.withoutTenant(
        (tx) => repository.listForUser(tx, actor.userId, { unreadOnly: query.unreadOnly }, page),
        { actorUserId: actor.userId },
      )
    },

    async getUnreadCount(access) {
      const { actor } = requireVerifiedActor(access)
      return transactions.withoutTenant((tx) => repository.countUnread(tx, actor.userId), {
        actorUserId: actor.userId,
      })
    },

    async markRead(access, notificationId) {
      const { actor } = requireVerifiedActor(access)
      await transactions.withoutTenant(
        (tx) => repository.markRead(tx, actor.userId, notificationId),
        {
          actorUserId: actor.userId,
        },
      )
    },

    async markAllRead(access) {
      const { actor } = requireVerifiedActor(access)
      await transactions.withoutTenant((tx) => repository.markAllRead(tx, actor.userId), {
        actorUserId: actor.userId,
      })
    },

    async getPreferences(access) {
      const { actor } = requireVerifiedActor(access)
      const existing = await transactions.withoutTenant(
        (tx) => repository.getPreference(tx, actor.userId),
        { actorUserId: actor.userId },
      )
      if (existing !== null) return existing
      return { userId: actor.userId, disabledCategories: [], updatedAt: new Date() }
    },

    async updatePreferences(access, disabledCategories) {
      const { actor } = requireVerifiedActor(access)
      const filtered = disabledCategories.filter(
        (category) => !NON_DISABLEABLE_CATEGORIES.has(category),
      )
      return transactions.withoutTenant(
        (tx) => repository.setPreference(tx, actor.userId, filtered),
        { actorUserId: actor.userId },
      )
    },

    streamMine(access, clientIp, signal) {
      const { actor } = requireVerifiedActor(access)
      if (!config.features.sseNotifications) throw featureDisabled('notification_stream')
      const release = acquireStream(actor.userId, clientIp)
      const encoder = new TextEncoder()
      let closed = false
      let streamController: ReadableStreamDefaultController<Uint8Array> | undefined

      const close = () => {
        if (closed) return
        closed = true
        signal.removeEventListener('abort', close)
        release()
        try {
          streamController?.close()
        } catch {
          // Cancellation may already have closed the stream.
        }
      }
      signal.addEventListener('abort', close, { once: true })

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
          const send = (value: string) => {
            if (!closed) controller.enqueue(encoder.encode(value))
          }
          send(
            'retry: 3000\nevent: ready\ndata: {"pollingFallback":"/api/v1/me/notifications"}\n\n',
          )

          void (async () => {
            let cursor = await transactions.withoutTenant(
              (tx) => repository.latestForUser(tx, actor.userId),
              { actorUserId: actor.userId },
            )
            let lastHeartbeat = Date.now()
            while (!closed && !signal.aborted) {
              await new Promise<void>((resolve) => {
                const finish = () => {
                  clearTimeout(timer)
                  signal.removeEventListener('abort', finish)
                  resolve()
                }
                const timer = setTimeout(finish, config.notificationStream.pollMs)
                signal.addEventListener('abort', finish, { once: true })
              })
              if (closed || signal.aborted) break
              const rows = await transactions.withoutTenant(
                (tx) => repository.listAfter(tx, actor.userId, cursor, 100),
                { actorUserId: actor.userId },
              )
              for (const row of rows) {
                send(
                  `id: ${row.id}\nevent: notification\ndata: ${JSON.stringify({
                    id: row.id,
                    organizationId: row.organizationId,
                    category: row.category,
                    title: row.title,
                    body: row.body,
                    linkUrl: row.linkUrl,
                    createdAt: row.createdAt.toISOString(),
                  })}\n\n`,
                )
                cursor = { id: row.id, createdAt: row.createdAt }
              }
              if (Date.now() - lastHeartbeat >= config.notificationStream.heartbeatMs) {
                send(`: heartbeat ${Date.now()}\n\n`)
                lastHeartbeat = Date.now()
              }
            }
            close()
          })().catch((error: unknown) => {
            if (!signal.aborted) {
              logger.warn(
                { err: describeError(error), userId: actor.userId },
                'Notification SSE stream stopped unexpectedly; client will use polling fallback',
              )
              try {
                send(
                  `event: unavailable\ndata: ${JSON.stringify({ pollingFallback: '/api/v1/me/notifications' })}\n\n`,
                )
              } catch {
                // The peer may already have disconnected.
              }
            }
            close()
          })
        },
        cancel() {
          close()
        },
      })

      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        },
      })
    },

    async notify(input) {
      await transactions.withPlatformAccess(
        async (tx) => {
          if (!NON_DISABLEABLE_CATEGORIES.has(input.category)) {
            const preference = await repository.getPreference(tx, input.userId)
            if (preference?.disabledCategories.includes(input.category) === true) return
          }
          await repository.create(tx, {
            id: newId(),
            userId: input.userId,
            organizationId: input.organizationId,
            sourceKey: input.sourceKey,
            category: input.category,
            title: input.title,
            body: input.body,
            linkUrl: input.linkUrl,
          })
        },
        { purpose: 'notification-delivery' },
      )
    },
  }
}
