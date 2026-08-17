import type { PrismaTransactionClient } from '../../shared/database'

export interface MatchmakingPostRow {
  id: string
  organizationId: string
  challengeId: string
  posterUserId: string
  posterTeamId: string | null
  skillsOffered: string[]
  rolesSought: string[]
  message: string
  availability: string | null
  contactPreference: string | null
  isOpen: boolean
  createdAt: Date
}

export type MatchmakingPostPatch = Partial<
  Pick<
    MatchmakingPostRow,
    'skillsOffered' | 'rolesSought' | 'message' | 'availability' | 'contactPreference'
  >
>

export interface MatchmakingInterestRow {
  id: string
  organizationId: string
  postId: string
  interestedUserId: string
  message: string | null
  createdAt: Date
}

export interface MatchmakingRepository {
  createPost(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      posterUserId: string
      posterTeamId?: string
      skillsOffered: string[]
      rolesSought: string[]
      message: string
      availability?: string
      contactPreference?: string
    },
  ): Promise<MatchmakingPostRow>
  findPostById(
    client: PrismaTransactionClient,
    organizationId: string,
    postId: string,
  ): Promise<MatchmakingPostRow | null>
  listPosts(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    filters: { isOpen?: boolean },
  ): Promise<MatchmakingPostRow[]>
  updatePost(
    client: PrismaTransactionClient,
    organizationId: string,
    postId: string,
    patch: MatchmakingPostPatch,
  ): Promise<void>
  setOpen(
    client: PrismaTransactionClient,
    organizationId: string,
    postId: string,
    isOpen: boolean,
  ): Promise<void>
  deletePost(client: PrismaTransactionClient, organizationId: string, postId: string): Promise<void>

  recordInterest(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      postId: string
      interestedUserId: string
      message?: string
    },
  ): Promise<MatchmakingInterestRow | null>
}

export function createMatchmakingRepository(): MatchmakingRepository {
  return {
    async createPost(client, input) {
      return client.matchmakingPost.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          posterUserId: input.posterUserId,
          posterTeamId: input.posterTeamId,
          skillsOffered: input.skillsOffered,
          rolesSought: input.rolesSought,
          message: input.message,
          availability: input.availability,
          contactPreference: input.contactPreference,
        },
      })
    },

    async findPostById(client, organizationId, postId) {
      return client.matchmakingPost.findFirst({ where: { id: postId, organizationId } })
    },

    async listPosts(client, organizationId, challengeId, filters) {
      return client.matchmakingPost.findMany({
        where: {
          organizationId,
          challengeId,
          ...(filters.isOpen !== undefined ? { isOpen: filters.isOpen } : {}),
        },
        orderBy: { createdAt: 'desc' },
      })
    },

    async updatePost(client, organizationId, postId, patch) {
      await client.matchmakingPost.updateMany({
        where: { id: postId, organizationId },
        data: patch,
      })
    },

    async setOpen(client, organizationId, postId, isOpen) {
      await client.matchmakingPost.updateMany({
        where: { id: postId, organizationId },
        data: { isOpen },
      })
    },

    async deletePost(client, organizationId, postId) {
      await client.matchmakingPost.deleteMany({ where: { id: postId, organizationId } })
    },

    async recordInterest(client, input) {
      const result = await client.matchmakingInterest.createMany({
        data: [
          {
            id: input.id,
            organizationId: input.organizationId,
            postId: input.postId,
            interestedUserId: input.interestedUserId,
            message: input.message,
          },
        ],
        skipDuplicates: true,
      })
      if (result.count === 0) return null
      return client.matchmakingInterest.findFirst({
        where: { postId: input.postId, interestedUserId: input.interestedUserId },
      })
    },
  }
}
