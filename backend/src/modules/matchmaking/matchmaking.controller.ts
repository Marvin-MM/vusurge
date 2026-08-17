import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type {
  MatchmakingInterestRow,
  MatchmakingPostPatch,
  MatchmakingPostRow,
} from './matchmaking.repository'
import type { CreatePostInput, MatchmakingService } from './matchmaking.service'

function serializePost(row: MatchmakingPostRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    posterUserId: row.posterUserId,
    posterTeamId: row.posterTeamId,
    skillsOffered: row.skillsOffered,
    rolesSought: row.rolesSought,
    message: row.message,
    availability: row.availability,
    contactPreference: row.contactPreference,
    isOpen: row.isOpen,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeInterest(row: MatchmakingInterestRow) {
  return {
    id: row.id,
    postId: row.postId,
    interestedUserId: row.interestedUserId,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  }
}

export function createMatchmakingController(service: MatchmakingService) {
  return {
    async createPost(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: CreatePostInput,
    ) {
      requireActor(access)
      const row = await service.createPost(access, organizationId, challengeId, input)
      return serializePost(row)
    },

    async getPost(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      postId: string,
    ) {
      requireActor(access)
      const row = await service.getPost(access, organizationId, challengeId, postId)
      return serializePost(row)
    },

    async listPosts(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      filters: { isOpen?: boolean },
    ) {
      requireActor(access)
      const rows = await service.listPosts(access, organizationId, challengeId, filters)
      return rows.map(serializePost)
    },

    async updatePost(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      postId: string,
      patch: MatchmakingPostPatch,
    ) {
      requireActor(access)
      const row = await service.updatePost(access, organizationId, challengeId, postId, patch)
      return serializePost(row)
    },

    async closePost(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      postId: string,
    ) {
      requireActor(access)
      const row = await service.closePost(access, organizationId, challengeId, postId)
      return serializePost(row)
    },

    async deletePost(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      postId: string,
    ) {
      requireActor(access)
      await service.deletePost(access, organizationId, challengeId, postId)
    },

    async expressInterest(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      postId: string,
      message: string | undefined,
    ) {
      requireActor(access)
      const row = await service.expressInterest(
        access,
        organizationId,
        challengeId,
        postId,
        message,
      )
      return serializeInterest(row)
    },
  }
}

export type MatchmakingController = ReturnType<typeof createMatchmakingController>
