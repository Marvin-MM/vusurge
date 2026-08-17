import { notifyUser } from '../../modules/notifications/notify'
import type { JobHandler } from '../job-router'

interface InnovationStageChangedPayload {
  innovationId: string
  ownerUserId: string
  title: string
  previousStage: string
  newStage: string
}

/** In-app-only: portfolio stage changes are an internal collaboration signal, not a required email category. */
export const handleInnovationStageChanged: JobHandler = async (context) => {
  const payload = context.payload as unknown as InnovationStageChangedPayload

  await notifyUser(context.infrastructure.transactions, {
    userId: payload.ownerUserId,
    sourceKey: `${context.outboxEventId}:${payload.ownerUserId}:portfolio-update-notification`,
    organizationId: context.organizationId ?? undefined,
    category: 'PORTFOLIO_UPDATE',
    title: `"${payload.title}" moved to ${payload.newStage}`,
    body: `Moved from ${payload.previousStage} to ${payload.newStage}.`,
  })
}
