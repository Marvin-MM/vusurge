import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue/queue-names'
import type { ParticipationRepository } from '../participation/participation.repository'
import type {
  MatchmakingInterestRow,
  MatchmakingPostPatch,
  MatchmakingPostRow,
  MatchmakingRepository,
} from './matchmaking.repository'

export interface CreatePostInput {
  posterTeamId?: string
  skillsOffered: string[]
  rolesSought: string[]
  message: string
  availability?: string
  contactPreference?: string
}

export interface MatchmakingService {
  createPost(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: CreatePostInput,
  ): Promise<MatchmakingPostRow>
  getPost(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    postId: string,
  ): Promise<MatchmakingPostRow>
  listPosts(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    filters: { isOpen?: boolean },
  ): Promise<MatchmakingPostRow[]>
  updatePost(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    postId: string,
    patch: MatchmakingPostPatch,
  ): Promise<MatchmakingPostRow>
  closePost(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    postId: string,
  ): Promise<MatchmakingPostRow>
  deletePost(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    postId: string,
  ): Promise<void>
  expressInterest(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    postId: string,
    message?: string,
  ): Promise<MatchmakingInterestRow>
}

export function createMatchmakingService(
  repository: MatchmakingRepository,
  participationRepository: ParticipationRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
): MatchmakingService {
  async function requireApprovedParticipant(
    tx: Parameters<ParticipationRepository['findByChallengeAndUser']>[0],
    organizationId: string,
    challengeId: string,
    userId: string,
  ): Promise<void> {
    const participation = await participationRepository.findByChallengeAndUser(
      tx,
      organizationId,
      challengeId,
      userId,
    )
    if (participation === null || participation.status !== 'APPROVED') {
      throw forbidden('Only approved challenge participants may use the matchmaking board.')
    }
  }

  function canModerate(access: AccessContext): boolean {
    try {
      authorize(access, Permission.ChallengeManageTeams)
      return true
    } catch {
      return false
    }
  }

  return {
    async createPost(access, organizationId, challengeId, input) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await requireApprovedParticipant(tx, organizationId, challengeId, actor.userId)

          const post = await repository.createPost(tx, {
            id: newId(),
            organizationId,
            challengeId,
            posterUserId: actor.userId,
            posterTeamId: input.posterTeamId,
            skillsOffered: input.skillsOffered,
            rolesSought: input.rolesSought,
            message: input.message,
            availability: input.availability,
            contactPreference: input.contactPreference,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.MatchmakingPostCreated,
            resourceType: 'matchmaking_post',
            resourceId: post.id,
            summary: 'Created a matchmaking post.',
          })

          return post
        },
        { actorUserId: actor.userId },
      )
    },

    async getPost(access, organizationId, challengeId, postId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        const post = await repository.findPostById(tx, organizationId, postId)
        if (post === null || post.challengeId !== challengeId)
          throw notFound('Matchmaking post not found.')
        return post
      })
    },

    async listPosts(access, organizationId, challengeId, filters) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, (tx) =>
        repository.listPosts(tx, organizationId, challengeId, filters),
      )
    },

    async updatePost(access, organizationId, challengeId, postId, patch) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const post = await repository.findPostById(tx, organizationId, postId)
          if (post === null || post.challengeId !== challengeId)
            throw notFound('Matchmaking post not found.')
          if (post.posterUserId !== actor.userId && !canModerate(access)) {
            throw forbidden('Only the poster or an organizer may edit this post.')
          }

          await repository.updatePost(tx, organizationId, postId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.MatchmakingPostUpdated,
            resourceType: 'matchmaking_post',
            resourceId: postId,
            summary: 'Updated a matchmaking post.',
          })

          const after = await repository.findPostById(tx, organizationId, postId)
          if (after === null) throw notFound('Matchmaking post not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    async closePost(access, organizationId, challengeId, postId) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const post = await repository.findPostById(tx, organizationId, postId)
          if (post === null || post.challengeId !== challengeId)
            throw notFound('Matchmaking post not found.')
          if (post.posterUserId !== actor.userId && !canModerate(access)) {
            throw forbidden('Only the poster or an organizer may close this post.')
          }
          if (!post.isOpen) {
            throw conflict(ErrorCode.CONFLICT, 'This post is already closed.')
          }

          await repository.setOpen(tx, organizationId, postId, false)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.MatchmakingPostClosed,
            resourceType: 'matchmaking_post',
            resourceId: postId,
            summary: 'Closed a matchmaking post.',
          })

          const after = await repository.findPostById(tx, organizationId, postId)
          if (after === null) throw notFound('Matchmaking post not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    async deletePost(access, organizationId, challengeId, postId) {
      const { actor } = requireVerifiedActor(access)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const post = await repository.findPostById(tx, organizationId, postId)
          if (post === null || post.challengeId !== challengeId)
            throw notFound('Matchmaking post not found.')
          if (post.posterUserId !== actor.userId && !canModerate(access)) {
            throw forbidden('Only the poster or an organizer may delete this post.')
          }

          await repository.deletePost(tx, organizationId, postId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.MatchmakingPostDeleted,
            resourceType: 'matchmaking_post',
            resourceId: postId,
            summary: 'Deleted a matchmaking post.',
          })
        },
        { actorUserId: actor.userId },
      )
    },

    async expressInterest(access, organizationId, challengeId, postId, message) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          await requireApprovedParticipant(tx, organizationId, challengeId, actor.userId)

          const post = await repository.findPostById(tx, organizationId, postId)
          if (post === null || post.challengeId !== challengeId)
            throw notFound('Matchmaking post not found.')
          if (!post.isOpen) {
            throw conflict(ErrorCode.CONFLICT, 'This post is no longer open.')
          }
          if (post.posterUserId === actor.userId) {
            throw conflict(ErrorCode.CONFLICT, 'You cannot express interest in your own post.')
          }

          const interest = await repository.recordInterest(tx, {
            id: newId(),
            organizationId,
            postId,
            interestedUserId: actor.userId,
            message,
          })
          if (interest === null) {
            throw conflict(ErrorCode.CONFLICT, 'You have already expressed interest in this post.')
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.MatchmakingInterestExpressed,
            resourceType: 'matchmaking_post',
            resourceId: postId,
            summary: 'Expressed interest in a matchmaking post.',
          })

          // In-platform notification only — never discloses the interested
          // user's private email/phone to the poster (master prompt 14.1).
          await outbox.write(tx, {
            eventType: 'matchmaking.interest_expressed',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'matchmaking_post',
            aggregateId: postId,
            organizationId,
            dedupeKey: `matchmaking-interest-expressed:${interest.id}`,
            payload: { postId, posterUserId: post.posterUserId, interestedUserId: actor.userId },
          })

          return interest
        },
        { actorUserId: actor.userId },
      )
    },
  }
}
