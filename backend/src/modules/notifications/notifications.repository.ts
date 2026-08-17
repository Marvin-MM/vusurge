import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export type NotificationCategory =
  | 'ORGANIZATION_INVITE'
  | 'ORGANIZATION_APPLICATION_DECISION'
  | 'PARTICIPATION_DECISION'
  | 'TEAM_INVITATION'
  | 'TEAM_MEMBERSHIP_CHANGE'
  | 'SUBMISSION_FINALIZED'
  | 'DEADLINE_CHANGED'
  | 'DEADLINE_REMINDER'
  | 'ANNOUNCEMENT'
  | 'JUDGING_ASSIGNMENT'
  | 'JUDGING_REMINDER'
  | 'RESULTS_PUBLISHED'
  | 'FEEDBACK_RELEASED'
  | 'SUPPORT_TICKET_UPDATE'
  | 'MATCHMAKING_INTEREST'
  | 'PORTFOLIO_UPDATE'

export interface NotificationRow {
  id: string
  userId: string
  organizationId: string | null
  sourceKey: string | null
  category: NotificationCategory
  title: string
  body: string
  linkUrl: string | null
  readAt: Date | null
  createdAt: Date
}

export interface NotificationPreferenceRow {
  userId: string
  disabledCategories: NotificationCategory[]
  updatedAt: Date
}

export interface NotificationsRepository {
  create(
    client: PrismaTransactionClient,
    input: {
      id: string
      userId: string
      organizationId?: string
      sourceKey?: string
      category: NotificationCategory
      title: string
      body: string
      linkUrl?: string
    },
  ): Promise<NotificationRow>
  latestForUser(
    client: PrismaTransactionClient,
    userId: string,
  ): Promise<{ id: string; createdAt: Date } | null>
  listAfter(
    client: PrismaTransactionClient,
    userId: string,
    cursor: { id: string; createdAt: Date } | null,
    limit: number,
  ): Promise<NotificationRow[]>
  listForUser(
    client: PrismaTransactionClient,
    userId: string,
    filters: { unreadOnly?: boolean },
    page: PageRequest,
  ): Promise<Page<NotificationRow>>
  countUnread(client: PrismaTransactionClient, userId: string): Promise<number>
  markRead(client: PrismaTransactionClient, userId: string, notificationId: string): Promise<void>
  markAllRead(client: PrismaTransactionClient, userId: string): Promise<void>

  getPreference(
    client: PrismaTransactionClient,
    userId: string,
  ): Promise<NotificationPreferenceRow | null>
  setPreference(
    client: PrismaTransactionClient,
    userId: string,
    disabledCategories: NotificationCategory[],
  ): Promise<NotificationPreferenceRow>
}

export function createNotificationsRepository(): NotificationsRepository {
  return {
    async create(client, input) {
      if (input.sourceKey !== undefined) {
        await client.notification.createMany({
          data: [
            {
              id: input.id,
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
        return client.notification.findUniqueOrThrow({
          where: { userId_sourceKey: { userId: input.userId, sourceKey: input.sourceKey } },
        })
      }
      return client.notification.create({
        data: {
          id: input.id,
          userId: input.userId,
          organizationId: input.organizationId,
          sourceKey: input.sourceKey,
          category: input.category,
          title: input.title,
          body: input.body,
          linkUrl: input.linkUrl,
        },
      })
    },

    async latestForUser(client, userId) {
      return client.notification.findFirst({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, createdAt: true },
      })
    },

    async listAfter(client, userId, cursor, limit) {
      return client.notification.findMany({
        where: {
          userId,
          ...(cursor === null
            ? {}
            : {
                OR: [
                  { createdAt: { gt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                ],
              }),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
      })
    },

    async listForUser(client, userId, filters, page) {
      const rows = await client.notification.findMany({
        where: {
          userId,
          ...(filters.unreadOnly === true ? { readAt: null } : {}),
          ...(page.cursor
            ? {
                OR: [
                  { createdAt: { lt: new Date(page.cursor.at) } },
                  { createdAt: new Date(page.cursor.at), id: { lt: page.cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: page.limit + 1,
      })
      return buildPage(rows, page, (row) => ({ at: row.createdAt.toISOString(), id: row.id }))
    },

    async countUnread(client, userId) {
      return client.notification.count({ where: { userId, readAt: null } })
    },

    async markRead(client, userId, notificationId) {
      await client.notification.updateMany({
        where: { id: notificationId, userId, readAt: null },
        data: { readAt: new Date() },
      })
    },

    async markAllRead(client, userId) {
      await client.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      })
    },

    async getPreference(client, userId) {
      return client.notificationPreference.findUnique({ where: { userId } })
    },

    async setPreference(client, userId, disabledCategories) {
      return client.notificationPreference.upsert({
        where: { userId },
        create: { userId, disabledCategories },
        update: { disabledCategories },
      })
    },
  }
}
