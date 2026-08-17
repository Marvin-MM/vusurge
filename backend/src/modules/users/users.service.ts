import type { AuditWriter } from '../../shared/audit'
import { AuditAction } from '../../shared/audit'
import type { AppConfig } from '../../shared/config'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, notFound } from '../../shared/errors'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue'
import { isConfirmedMediaBinding, type MediaRepository } from '../media/media.repository'
import type {
  MembershipSummaryRow,
  MyChallengeParticipationRow,
  MyChallengeStaffInvitationRow,
  MyTeamInvitationRow,
  ProfilePatch,
  UsersRepository,
  UserWithProfile,
} from './users.repository'

/**
 * Identity and profile business rules.
 *
 * Nothing here is tenant-scoped, so every operation runs through
 * `withoutTenant` rather than `withTenant`. The one thing this module must get
 * right that a naive implementation would not: a public profile projection
 * that actually enforces the owner's chosen visibility, including the
 * "shared organization" case, which requires a real membership-overlap query
 * rather than a client-trusted flag.
 */

export interface MeView {
  id: string
  email: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  displayName: string | null
  bio: string | null
  location: string | null
  avatarAssetId: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  discordHandle: string | null
  visibility: 'PUBLIC' | 'ORGANIZATION_MEMBERS' | 'PRIVATE'
  skills: { id: string | null; name: string; isCustom: boolean }[]
}

export interface PublicProfileView {
  id: string
  displayName: string
  bio: string | null
  location: string | null
  avatarAssetId: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  skills: { id: string | null; name: string; isCustom: boolean }[]
}

function toMeView(user: UserWithProfile): MeView {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    displayName: user.profile?.displayName ?? null,
    bio: user.profile?.bio ?? null,
    location: user.profile?.location ?? null,
    avatarAssetId: user.profile?.avatarAssetId ?? null,
    githubUrl: user.profile?.githubUrl ?? null,
    linkedinUrl: user.profile?.linkedinUrl ?? null,
    portfolioUrl: user.profile?.portfolioUrl ?? null,
    discordHandle: user.profile?.discordHandle ?? null,
    visibility: user.profile?.visibility ?? 'ORGANIZATION_MEMBERS',
    skills: user.skills.map((entry) => ({
      id: entry.skillId,
      name: entry.skillId !== null ? (entry.skillName ?? '') : (entry.customName ?? ''),
      isCustom: entry.skillId === null,
    })),
  }
}

export interface UsersService {
  getMe(userId: string): Promise<MeView>
  updateProfile(userId: string, patch: ProfilePatch): Promise<MeView>
  updateSkills(userId: string, skillIds: string[], customNames: string[]): Promise<MeView>
  listMyOrganizations(userId: string): Promise<MembershipSummaryRow[]>
  listMyChallengeParticipations(userId: string): Promise<MyChallengeParticipationRow[]>
  listMyTeamInvitations(userId: string): Promise<MyTeamInvitationRow[]>
  listMyChallengeStaffInvitations(email: string): Promise<MyChallengeStaffInvitationRow[]>
  getPublicProfile(targetUserId: string, viewerUserId: string | null): Promise<PublicProfileView>
  requestAccountDeletion(
    userId: string,
    reason: string | undefined,
    transaction?: PrismaTransactionClient,
  ): Promise<{
    id: string
    status: 'PENDING' | 'CANCELLED' | 'COMPLETED'
    requestedAt: Date
    eligibleAt: Date
  }>
  cancelAccountDeletion(userId: string): Promise<void>
}

export function createUsersService(
  repository: UsersRepository,
  mediaRepository: MediaRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  config: AppConfig,
): UsersService {
  async function getMe(userId: string): Promise<MeView> {
    const user = await transactions.withoutTenant((tx) => repository.findWithProfile(tx, userId))
    if (user === null) throw notFound('User not found.')
    return toMeView(user)
  }

  return {
    getMe,

    async updateProfile(userId, patch) {
      await transactions.withoutTenant(
        async (tx) => {
          if (patch.avatarAssetId !== undefined && patch.avatarAssetId !== null) {
            const asset = await mediaRepository.findById(tx, patch.avatarAssetId)
            if (
              !isConfirmedMediaBinding(asset, {
                purpose: 'USER_AVATAR',
                organizationId: null,
                challengeId: null,
                resourceType: 'user',
                resourceId: userId,
                ownerUserId: userId,
              })
            ) {
              throw badRequest('The avatar is not a confirmed upload authorized for this user.')
            }
          }
          await repository.upsertProfile(tx, userId, patch)
        },
        { actorUserId: userId },
      )
      return getMe(userId)
    },

    async updateSkills(userId, skillIds, customNames) {
      // De-duplicate defensively: a client sending the same skill twice must
      // not produce two rows and trip the unique constraint.
      const uniqueSkillIds = [...new Set(skillIds)]
      const normalizedCustom = [
        ...new Set(customNames.map((name) => name.trim()).filter((name) => name.length > 0)),
      ]

      if (uniqueSkillIds.length + normalizedCustom.length > 60) {
        throw badRequest('A profile may claim at most 60 skills in total.')
      }

      await transactions.withoutTenant(
        async (tx) => {
          const validIds = await repository.findActiveSkillsByIds(tx, uniqueSkillIds)
          if (validIds.length !== uniqueSkillIds.length) {
            throw badRequest('One or more skill IDs are not part of the active skill catalogue.')
          }
          await repository.replaceSkills(tx, userId, validIds, normalizedCustom)
        },
        { actorUserId: userId },
      )

      return getMe(userId)
    },

    async listMyOrganizations(userId) {
      return transactions.withoutTenant((tx) => repository.listActiveMemberships(tx, userId))
    },

    async listMyChallengeParticipations(userId) {
      return transactions.withoutTenant((tx) =>
        repository.listMyChallengeParticipations(tx, userId),
      )
    },

    async listMyTeamInvitations(userId) {
      return transactions.withoutTenant((tx) => repository.listMyTeamInvitations(tx, userId))
    },

    async listMyChallengeStaffInvitations(email) {
      return transactions.withoutTenant((tx) =>
        repository.listMyChallengeStaffInvitations(tx, email),
      )
    },

    async getPublicProfile(targetUserId, viewerUserId) {
      const user = await transactions.withoutTenant((tx) =>
        repository.findWithProfile(tx, targetUserId),
      )
      if (user === null) throw notFound('User not found.')

      const visibility = user.profile?.visibility ?? 'ORGANIZATION_MEMBERS'
      const isSelf = viewerUserId === targetUserId

      if (!isSelf && visibility === 'PRIVATE') {
        throw notFound('User not found.')
      }

      if (!isSelf && visibility === 'ORGANIZATION_MEMBERS') {
        // Spans organization_membership across two users, which is
        // RLS-protected; the same narrow, minimal-projection bypass the
        // resolver uses applies here (see the note on listMyOrganizations
        // just above). Only a boolean gate is returned to the caller — no
        // other tenant's row data escapes this check.
        const shares =
          viewerUserId === null
            ? false
            : await transactions.withoutTenant((tx) =>
                repository.shareAnyOrganization(tx, viewerUserId, targetUserId),
              )
        if (!shares) {
          // Identical to "not found": a profile's existence must not be
          // discoverable by an unrelated caller (master prompt section 35).
          throw notFound('User not found.')
        }
      }

      return {
        id: user.id,
        displayName: user.profile?.displayName ?? 'Member',
        bio: user.profile?.bio ?? null,
        location: user.profile?.location ?? null,
        avatarAssetId: user.profile?.avatarAssetId ?? null,
        githubUrl: user.profile?.githubUrl ?? null,
        linkedinUrl: user.profile?.linkedinUrl ?? null,
        portfolioUrl: user.profile?.portfolioUrl ?? null,
        skills: user.skills.map((entry) => ({
          id: entry.skillId,
          name: entry.skillId !== null ? (entry.skillName ?? '') : (entry.customName ?? ''),
          isCustom: entry.skillId === null,
        })),
      }
    },

    async requestAccountDeletion(userId, reason, transaction) {
      const execute = async (tx: PrismaTransactionClient) => {
        await tx.$queryRaw`select id from "user" where id = ${userId}::uuid for update`
        const existing = await tx.accountDeletionRequest.findFirst({
          where: { userId, status: 'PENDING' },
        })
        if (existing !== null) {
          throw conflict(ErrorCode.CONFLICT, 'An account deletion request is already pending.')
        }

        const now = await transactions.databaseNow(tx)
        const eligibleAt = new Date(
          now.getTime() + config.retention.accountDeletionGraceDays * 86_400_000,
        )

        const created = await tx.accountDeletionRequest.create({
          data: { id: newId(), userId, reason, requestedAt: now, eligibleAt },
        })

        await audit.write(tx, {
          actorType: 'USER',
          actorUserId: userId,
          action: AuditAction.AccountDeletionRequested,
          resourceType: 'user',
          resourceId: userId,
          summary: 'User requested account deletion.',
        })

        await outbox.write(tx, {
          eventType: 'account.deletion_requested',
          queueName: QueueName.Reminders,
          aggregateType: 'user',
          aggregateId: userId,
          dedupeKey: `account-deletion-requested:${created.id}`,
          payload: { userId, eligibleAt: eligibleAt.toISOString() },
        })

        return {
          id: created.id,
          status: created.status,
          requestedAt: created.requestedAt,
          eligibleAt: created.eligibleAt,
        }
      }
      if (transaction !== undefined) return execute(transaction)
      return transactions.withoutTenant(execute, { actorUserId: userId })
    },

    async cancelAccountDeletion(userId) {
      await transactions.withoutTenant(
        async (tx) => {
          await tx.$queryRaw`select id from "user" where id = ${userId}::uuid for update`
          const existing = await tx.accountDeletionRequest.findFirst({
            where: { userId, status: 'PENDING' },
          })
          if (existing === null) {
            throw notFound('No pending account deletion request exists.')
          }

          const now = await transactions.databaseNow(tx)

          const cancelled = await tx.accountDeletionRequest.updateMany({
            where: { id: existing.id, status: 'PENDING' },
            data: { status: 'CANCELLED', cancelledAt: now },
          })
          if (cancelled.count !== 1) {
            throw conflict(ErrorCode.CONFLICT, 'This deletion request is no longer cancellable.')
          }

          await audit.write(tx, {
            actorType: 'USER',
            actorUserId: userId,
            action: AuditAction.AccountDeletionCancelled,
            resourceType: 'user',
            resourceId: userId,
            summary: 'User cancelled a pending account deletion request.',
          })
        },
        { actorUserId: userId },
      )
    },
  }
}
