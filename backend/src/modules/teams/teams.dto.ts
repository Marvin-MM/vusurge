import { t } from 'elysia'
import { ActionReason, Uuid } from '../../shared/http'

const TeamMemberRole = t.Union([t.Literal('CAPTAIN'), t.Literal('MEMBER')])
const TeamInvitationStatus = t.Union([
  t.Literal('PENDING'),
  t.Literal('ACCEPTED'),
  t.Literal('DECLINED'),
  t.Literal('REVOKED'),
  t.Literal('EXPIRED'),
])

export const CreateTeamBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 120 }),
  trackId: t.Optional(Uuid),
})

export const UpdateTeamBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 120 })),
  trackId: t.Optional(t.Union([Uuid, t.Null()])),
})

/** Team member listing never carries email/phone — only what's needed to identify a teammate in-app. */
export const TeamMemberResponse = t.Object({
  userId: Uuid,
  role: TeamMemberRole,
  joinedAt: t.String(),
})

export const TeamResponse = t.Object({
  id: Uuid,
  challengeId: Uuid,
  trackId: t.Union([Uuid, t.Null()]),
  name: t.String(),
  isSolo: t.Boolean(),
  members: t.Array(TeamMemberResponse),
  createdAt: t.String(),
})

export const TeamListResponse = t.Array(TeamResponse)

export const InviteMemberBody = t.Object({ userId: Uuid })

export const TeamInvitationResponse = t.Object({
  id: Uuid,
  teamId: Uuid,
  invitedUserId: Uuid,
  status: TeamInvitationStatus,
  expiresAt: t.String(),
  createdAt: t.String(),
})

export const TeamInvitationListResponse = t.Array(TeamInvitationResponse)

export const TransferCaptainBody = t.Object({ newCaptainUserId: Uuid })
export const RemoveMemberBody = t.Object({})

export const OrganizerExceptionBody = t.Object({
  action: t.Union([t.Literal('ADD_MEMBER'), t.Literal('REMOVE_MEMBER')]),
  userId: Uuid,
  reason: ActionReason,
})
