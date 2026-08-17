import type { JobHandler } from '../job-router'

interface AccountDeletionExecutedPayload {
  requestId: string
  userId: string
}

/** Clear any non-authoritative global projections after pseudonymization. */
export const handleAccountDeletionExecuted: JobHandler = async (context) => {
  const payload = context.payload as unknown as AccountDeletionExecutedPayload
  const completed = await context.infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.accountDeletionRequest.findFirst({
        where: { id: payload.requestId, userId: payload.userId, status: 'COMPLETED' },
        select: { id: true },
      }),
    { purpose: 'Verify a completed account deletion before cache invalidation.' },
  )
  if (completed === null) return
  await context.infrastructure.cache.invalidateNamespace('user-profile')
}
