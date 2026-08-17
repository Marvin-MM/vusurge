import type { JobHandler } from '../job-router'

interface EmailDeliveryRequestedPayload {
  emailDeliveryId: string
}

/** Execute one durable delivery obligation; duplicate jobs are harmless. */
export const handleEmailDeliveryRequested: JobHandler = async (context) => {
  const payload = context.payload as unknown as EmailDeliveryRequestedPayload
  await context.infrastructure.emailDeliveries.deliver(
    payload.emailDeliveryId,
    context.organizationId,
    context.attempt,
  )
}
