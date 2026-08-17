import type { EmailCategory } from '../shared/email'
import type { JobContext } from './job-router'

export interface JobEmailInput {
  readonly to: string
  readonly recipientUserId?: string
  readonly category: EmailCategory
  readonly subject: string
  readonly text: string
  readonly sourceType: string
  readonly sourceKey: string
  readonly disableTracking?: boolean
}

/**
 * Turn a source domain event into a separate durable per-recipient obligation.
 * The source job can then complete independently of provider availability.
 */
export async function enqueueJobEmail(context: JobContext, input: JobEmailInput): Promise<string> {
  const work = (tx: Parameters<typeof context.infrastructure.emailDeliveries.enqueue>[0]) =>
    context.infrastructure.emailDeliveries.enqueue(tx, {
      ...input,
      idempotencyKey: input.sourceKey,
      organizationId: context.organizationId ?? undefined,
    })

  if (context.organizationId !== null) {
    return context.infrastructure.transactions.withTenant(context.organizationId, work, {
      isolationLevel: 'Serializable',
    })
  }
  return context.infrastructure.transactions.withPlatformAccess(work, {
    purpose: `Create global email obligation for ${input.sourceType}.`,
    isolationLevel: 'Serializable',
  })
}
