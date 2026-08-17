import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { MatchmakingController } from './matchmaking.controller'
import {
  CreateMatchmakingPostBody,
  ExpressInterestBody,
  MatchmakingInterestResponse,
  MatchmakingPostListQuery,
  MatchmakingPostListResponse,
  MatchmakingPostResponse,
  UpdateMatchmakingPostBody,
} from './matchmaking.dto'

export function matchmakingRoutes(controller: MatchmakingController, auth: AuthPlugin) {
  return new Elysia({ name: 'matchmaking-routes' })
    .use(auth)
    .post(
      '/organizations/:organizationId/challenges/:challengeId/matchmaking',
      async ({ access, params, body, set }) => {
        const result = await controller.createPost(
          access,
          params.organizationId,
          params.challengeId,
          body,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        body: CreateMatchmakingPostBody,
        response: { 201: MatchmakingPostResponse, ...CommonErrorResponses },
        detail: { tags: ['Matchmaking'], summary: 'Create a matchmaking post' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/matchmaking',
      ({ access, params, query }) =>
        controller.listPosts(access, params.organizationId, params.challengeId, query),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        query: MatchmakingPostListQuery,
        response: { 200: MatchmakingPostListResponse, ...CommonErrorResponses },
        detail: { tags: ['Matchmaking'], summary: 'List matchmaking posts' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId',
      ({ access, params }) =>
        controller.getPost(access, params.organizationId, params.challengeId, params.postId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, postId: Uuid }),
        response: { 200: MatchmakingPostResponse, ...CommonErrorResponses },
        detail: { tags: ['Matchmaking'], summary: 'Get a matchmaking post' },
      },
    )
    .patch(
      '/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId',
      ({ access, params, body }) =>
        controller.updatePost(
          access,
          params.organizationId,
          params.challengeId,
          params.postId,
          body,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, postId: Uuid }),
        body: UpdateMatchmakingPostBody,
        response: { 200: MatchmakingPostResponse, ...CommonErrorResponses },
        detail: { tags: ['Matchmaking'], summary: 'Update a matchmaking post' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId/close',
      ({ access, params }) =>
        controller.closePost(access, params.organizationId, params.challengeId, params.postId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, postId: Uuid }),
        response: { 200: MatchmakingPostResponse, ...CommonErrorResponses },
        detail: { tags: ['Matchmaking'], summary: 'Close a matchmaking post' },
      },
    )
    .delete(
      '/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId',
      async ({ access, params, set }) => {
        await controller.deletePost(
          access,
          params.organizationId,
          params.challengeId,
          params.postId,
        )
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, postId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Matchmaking'], summary: 'Delete a matchmaking post' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId/interest',
      async ({ access, params, body, set }) => {
        const result = await controller.expressInterest(
          access,
          params.organizationId,
          params.challengeId,
          params.postId,
          body.message,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, postId: Uuid }),
        body: ExpressInterestBody,
        response: { 201: MatchmakingInterestResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Matchmaking'],
          summary: 'Express interest in a matchmaking post',
          description:
            'Creates an in-platform notification only; never discloses private contact data.',
        },
      },
    )
}
