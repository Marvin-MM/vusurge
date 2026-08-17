import type { Infrastructure } from '../../container'
import { AuditAction } from '../audit'
import { QueueName } from '../queue'

export interface AccountDeletionExecutionReport {
  examined: number
  completed: number
  held: number
  blocked: number
  failures: { requestId: string; message: string }[]
}

function pseudonymousEmail(userId: string): string {
  return `deleted+${userId.replaceAll('-', '')}@invalid.example`
}

async function recordBlocked(
  infrastructure: Infrastructure,
  requestId: string,
  message: string,
): Promise<void> {
  await infrastructure.transactions.withPlatformAccess(
    (tx) =>
      tx.accountDeletionRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { executionAttempts: { increment: 1 }, lastExecutionError: message.slice(0, 1000) },
      }),
    { purpose: 'Record a blocked account-deletion execution attempt.' },
  )
}

/**
 * Apply one due request atomically. The user row remains as a pseudonymous
 * subject so business, consent, judging, and audit history never become
 * orphaned. Credentials and user-controlled PII are removed.
 */
async function executeOne(
  infrastructure: Infrastructure,
  requestId: string,
): Promise<'COMPLETED' | 'HELD' | 'NOT_DUE'> {
  const { transactions, audit, outbox, encryption } = infrastructure

  return transactions.withPlatformAccess(
    async (tx) => {
      const request = await tx.accountDeletionRequest.findUnique({ where: { id: requestId } })
      if (request === null || request.status !== 'PENDING') return 'NOT_DUE'

      // Cancellation and execution use the same user-row lock. Whichever
      // commits first determines the guarded transition; neither can partly
      // apply after the other.
      await tx.$queryRaw`select id from "user" where id = ${request.userId}::uuid for update`
      await tx.$queryRaw`select id from account_deletion_request where id = ${requestId}::uuid for update`

      const locked = await tx.accountDeletionRequest.findUniqueOrThrow({
        where: { id: requestId },
      })
      if (locked.status !== 'PENDING') return 'NOT_DUE'
      if (locked.legalHoldAt !== null) return 'HELD'

      const now = await transactions.databaseNow(tx)
      if (locked.eligibleAt > now) return 'NOT_DUE'

      const user = await tx.user.findUnique({
        where: { id: locked.userId },
        include: { profile: true },
      })
      if (user === null || user.deletedAt !== null) {
        const completed = await tx.accountDeletionRequest.updateMany({
          where: { id: requestId, status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            executionAttempts: { increment: 1 },
            lastExecutionError: null,
          },
        })
        return completed.count === 1 ? 'COMPLETED' : 'NOT_DUE'
      }

      const ownerMemberships = await tx.organizationMembership.findMany({
        where: { userId: user.id, role: 'ORG_OWNER', status: 'ACTIVE' },
        orderBy: { organizationId: 'asc' },
        select: { organizationId: true },
      })
      for (const membership of ownerMemberships) {
        // Serialize against ownership changes and check the invariant using
        // the locked organization before removing this account's membership.
        await tx.$queryRaw`select id from organization where id = ${membership.organizationId}::uuid for update`
        const activeOwners = await tx.organizationMembership.count({
          where: {
            organizationId: membership.organizationId,
            role: 'ORG_OWNER',
            status: 'ACTIVE',
          },
        })
        if (activeOwners <= 1) {
          throw new AccountDeletionBlockedError(
            requestId,
            'Account deletion is blocked until ownership of every organization is transferred.',
          )
        }
      }

      const aliasEmail = pseudonymousEmail(user.id)

      // Revoke every authentication and privileged-access mechanism first.
      await tx.session.deleteMany({ where: { userId: user.id } })
      await tx.account.deleteMany({ where: { userId: user.id } })
      await tx.twoFactor.deleteMany({ where: { userId: user.id } })
      await tx.verification.deleteMany({
        where: { OR: [{ value: user.id }, { identifier: user.email }] },
      })
      await tx.platformRoleAssignment.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokedBy: null },
      })

      // Remove user-owned convenience data while retaining pseudonymous
      // business relationships and immutable consent/evaluation history.
      await tx.userSkill.deleteMany({ where: { userId: user.id } })
      await tx.notification.deleteMany({ where: { userId: user.id } })
      await tx.notificationPreference.deleteMany({ where: { userId: user.id } })
      await tx.organizationMembership.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: { status: 'INACTIVE', removedAt: now, removedByUserId: null },
      })
      await tx.challengeParticipation.updateMany({
        where: { userId: user.id, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'WITHDRAWN', withdrawnAt: now },
      })
      await tx.challengeStaffAssignment.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: { status: 'REMOVED', removedAt: now, removedByUserId: null },
      })
      await tx.matchmakingPost.updateMany({
        where: { posterUserId: user.id },
        data: {
          isOpen: false,
          message: '[redacted following account deletion]',
          availability: null,
          contactPreference: null,
        },
      })
      await tx.matchmakingInterest.updateMany({
        where: { interestedUserId: user.id },
        data: { message: null },
      })
      await tx.supportTicket.updateMany({
        where: { userId: user.id },
        data: {
          subject: 'Deleted user support request',
          description: '[redacted following account deletion]',
        },
      })
      await tx.supportTicketComment.updateMany({
        where: { authorUserId: user.id },
        data: { body: '[redacted following account deletion]' },
      })
      await tx.organizationInvitation.updateMany({
        where: { email: user.email, status: 'PENDING' },
        data: { email: null, status: 'REVOKED', revokedAt: now },
      })
      await tx.challengeStaffInvitation.updateMany({
        where: { email: user.email, status: 'PENDING' },
        data: { email: null, status: 'REVOKED', respondedAt: now },
      })

      const deliveries = await tx.emailDelivery.findMany({
        where: { recipientUserId: user.id },
        select: { id: true, status: true },
      })
      for (const delivery of deliveries) {
        const redacted = encryption.seal(
          '[redacted following account deletion]',
          `email-delivery:${delivery.id}:body`,
        )
        await tx.emailDelivery.update({
          where: { id: delivery.id },
          data: {
            recipientEmail: aliasEmail,
            bodyCiphertext: redacted.ciphertext,
            bodyKeyVersion: redacted.keyVersion,
            ...(delivery.status === 'PENDING' || delivery.status === 'SENDING'
              ? { status: 'CANCELLED' as const, leaseExpiresAt: null }
              : {}),
          },
        })
      }

      await tx.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          displayName: 'Deleted user',
          visibility: 'PRIVATE',
        },
        update: {
          displayName: 'Deleted user',
          bio: null,
          location: null,
          avatarAssetId: null,
          githubUrl: null,
          linkedinUrl: null,
          portfolioUrl: null,
          discordHandle: null,
          visibility: 'PRIVATE',
        },
      })
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: 'Deleted user',
          email: aliasEmail,
          emailVerified: false,
          image: null,
          twoFactorEnabled: false,
          deletedAt: now,
        },
      })

      // Avatar objects are user-owned provider data, not retained business
      // evidence. Tombstone first, then let the existing idempotent provider
      // cleanup handler remove them asynchronously.
      const avatarAssets = await tx.mediaAsset.findMany({
        where: {
          ownerUserId: user.id,
          organizationId: null,
          purpose: 'USER_AVATAR',
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { id: true },
      })
      for (const asset of avatarAssets) {
        await tx.mediaAsset.update({
          where: { id: asset.id },
          data: { status: 'PENDING_DELETION', deletionRequestedAt: now },
        })
        await outbox.write(tx, {
          eventType: 'media.asset_deletion_requested',
          queueName: QueueName.MediaCleanup,
          aggregateType: 'media_asset',
          aggregateId: asset.id,
          payload: { assetId: asset.id },
          dedupeKey: `media.asset_deletion_requested:${asset.id}`,
        })
      }

      const completed = await tx.accountDeletionRequest.updateMany({
        where: { id: requestId, status: 'PENDING', legalHoldAt: null },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          executionAttempts: { increment: 1 },
          lastExecutionError: null,
        },
      })
      if (completed.count !== 1) {
        throw new Error('Account deletion lost its guarded PENDING transition.')
      }

      await audit.write(tx, {
        actorType: 'SYSTEM',
        action: AuditAction.AccountDeletionApplied,
        resourceType: 'user',
        resourceId: user.id,
        summary:
          'Applied account deletion by revoking credentials and pseudonymizing eligible PII.',
      })
      await outbox.write(tx, {
        eventType: 'account.deletion_executed',
        queueName: QueueName.CacheMaintenance,
        aggregateType: 'account_deletion_request',
        aggregateId: requestId,
        dedupeKey: `account-deletion-executed:${requestId}`,
        payload: { requestId, userId: user.id },
      })

      return 'COMPLETED'
    },
    {
      purpose: `Execute due account-deletion request ${requestId}.`,
      isolationLevel: 'Serializable',
    },
  )
}

export async function executeEligibleAccountDeletions(
  infrastructure: Infrastructure,
): Promise<AccountDeletionExecutionReport> {
  const candidates = await infrastructure.transactions.withPlatformAccess(
    (tx) => tx.$queryRaw<{ id: string; legalHoldAt: Date | null }[]>`
      select id, legal_hold_at as "legalHoldAt"
      from account_deletion_request
      where status = 'PENDING' and eligible_at <= now()
      order by eligible_at, id
      limit ${infrastructure.config.retention.accountDeletionBatchSize}
    `,
    { purpose: 'Find due account-deletion requests for the retention sweep.' },
  )

  const report: AccountDeletionExecutionReport = {
    examined: candidates.length,
    completed: 0,
    held: 0,
    blocked: 0,
    failures: [],
  }

  for (const candidate of candidates) {
    if (candidate.legalHoldAt !== null) {
      report.held += 1
      continue
    }
    try {
      const outcome = await executeOne(infrastructure, candidate.id)
      if (outcome === 'COMPLETED') report.completed += 1
      if (outcome === 'HELD') report.held += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof AccountDeletionBlockedError) {
        report.blocked += 1
      } else {
        report.failures.push({ requestId: candidate.id, message })
      }
      await recordBlocked(infrastructure, candidate.id, message)
    }
  }

  return report
}

export class AccountDeletionBlockedError extends Error {
  constructor(
    readonly requestId: string,
    message: string,
  ) {
    super(message)
    this.name = 'AccountDeletionBlockedError'
  }
}
