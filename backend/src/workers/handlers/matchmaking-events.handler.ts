import { notifyUser } from '../../modules/notifications/notify'
import type { JobHandler } from '../job-router'

interface MatchmakingInterestExpressedPayload {
  postId: string
  posterUserId: string
  interestedUserId: string
}

/**
 * In-app-only fan-out for matchmaking interest. Never emails and never
 * discloses the interested user's private contact details to the poster
 * (master prompt 14.1) — the poster follows up through the platform.
 */
export const handleMatchmakingInterestExpressed: JobHandler = async (context) => {
  const payload = context.payload as unknown as MatchmakingInterestExpressedPayload
  const interestedUser = await context.infrastructure.database.client.user.findUnique({
    where: { id: payload.interestedUserId },
    select: { name: true },
  })
  if (interestedUser === null) return

  await notifyUser(context.infrastructure.transactions, {
    userId: payload.posterUserId,
    sourceKey: `${context.outboxEventId}:${payload.posterUserId}:matchmaking-interest-notification`,
    organizationId: context.organizationId ?? undefined,
    category: 'MATCHMAKING_INTEREST',
    title: 'New interest in your matchmaking post',
    body: `${interestedUser.name} expressed interest in your matchmaking post.`,
  })
}
