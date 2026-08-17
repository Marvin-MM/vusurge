import { t } from 'elysia'
import { Uuid } from '../../shared/http'

export const CreateMatchmakingPostBody = t.Object({
  posterTeamId: t.Optional(Uuid),
  skillsOffered: t.Array(t.String({ maxLength: 60 }), { maxItems: 20 }),
  rolesSought: t.Array(t.String({ maxLength: 60 }), { maxItems: 20 }),
  message: t.String({ minLength: 2, maxLength: 2000 }),
  availability: t.Optional(t.String({ maxLength: 500 })),
  contactPreference: t.Optional(t.String({ maxLength: 500 })),
})

export const UpdateMatchmakingPostBody = t.Object({
  skillsOffered: t.Optional(t.Array(t.String({ maxLength: 60 }), { maxItems: 20 })),
  rolesSought: t.Optional(t.Array(t.String({ maxLength: 60 }), { maxItems: 20 })),
  message: t.Optional(t.String({ minLength: 2, maxLength: 2000 })),
  availability: t.Optional(t.String({ maxLength: 500 })),
  contactPreference: t.Optional(t.String({ maxLength: 500 })),
})

export const MatchmakingPostResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  posterUserId: Uuid,
  posterTeamId: t.Union([Uuid, t.Null()]),
  skillsOffered: t.Array(t.String()),
  rolesSought: t.Array(t.String()),
  message: t.String(),
  availability: t.Union([t.String(), t.Null()]),
  contactPreference: t.Union([t.String(), t.Null()]),
  isOpen: t.Boolean(),
  createdAt: t.String(),
})

export const MatchmakingPostListResponse = t.Array(MatchmakingPostResponse)
export const MatchmakingPostListQuery = t.Object({ isOpen: t.Optional(t.Boolean()) })

export const ExpressInterestBody = t.Object({ message: t.Optional(t.String({ maxLength: 1000 })) })

export const MatchmakingInterestResponse = t.Object({
  id: Uuid,
  postId: Uuid,
  interestedUserId: Uuid,
  message: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})
