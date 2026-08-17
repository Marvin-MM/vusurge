import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { TeamsController } from './teams.controller'
import {
  CreateTeamBody,
  InviteMemberBody,
  OrganizerExceptionBody,
  TeamInvitationListResponse,
  TeamInvitationResponse,
  TeamListResponse,
  TeamResponse,
  TransferCaptainBody,
  UpdateTeamBody,
} from './teams.dto'

export function teamsRoutes(controller: TeamsController, auth: AuthPlugin) {
  return new Elysia({ name: 'teams-routes' })
    .use(auth)
    .post(
      '/organizations/:organizationId/challenges/:challengeId/teams',
      async ({ access, params, body, set }) => {
        const result = await controller.createTeam(
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
        body: CreateTeamBody,
        response: { 201: TeamResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Teams'],
          summary: 'Create a team',
          description:
            'Only an approved challenge participant with no existing team may create one.',
        },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/teams',
      ({ access, params }) =>
        controller.listTeams(access, params.organizationId, params.challengeId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid }),
        response: { 200: TeamListResponse, ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'List challenge teams' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId',
      ({ access, params }) =>
        controller.getTeam(access, params.organizationId, params.challengeId, params.teamId),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid }),
        response: { 200: TeamResponse, ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Get a team' },
      },
    )
    .patch(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId',
      ({ access, params, body }) =>
        controller.updateTeam(
          access,
          params.organizationId,
          params.challengeId,
          params.teamId,
          body,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid }),
        body: UpdateTeamBody,
        response: { 200: TeamResponse, ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Update team metadata (name/track only)' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId/invitations',
      async ({ access, params, body, set }) => {
        const result = await controller.inviteMember(
          access,
          params.organizationId,
          params.challengeId,
          params.teamId,
          body.userId,
        )
        set.status = 201
        return result
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid }),
        body: InviteMemberBody,
        response: { 201: TeamInvitationResponse, ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Invite an approved participant to the team' },
      },
    )
    .get(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId/invitations',
      ({ access, params }) =>
        controller.listInvitations(
          access,
          params.organizationId,
          params.challengeId,
          params.teamId,
        ),
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid }),
        response: { 200: TeamInvitationListResponse, ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'List team invitations' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId/invitations/:invitationId/revoke',
      async ({ access, params, set }) => {
        await controller.revokeInvitation(
          access,
          params.organizationId,
          params.challengeId,
          params.teamId,
          params.invitationId,
        )
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({
          organizationId: Uuid,
          challengeId: Uuid,
          teamId: Uuid,
          invitationId: Uuid,
        }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Revoke a team invitation' },
      },
    )
    .post(
      '/team-invitations/:token/accept',
      ({ access, params }) => controller.acceptInvitation(access, params.token),
      {
        requireAuth: true,
        params: t.Object({ token: t.String({ minLength: 16, maxLength: 512 }) }),
        response: { 200: TeamResponse, ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Accept a team invitation by token' },
      },
    )
    .post(
      '/team-invitations/:token/decline',
      async ({ access, params, set }) => {
        await controller.declineInvitation(access, params.token)
        set.status = 204
      },
      {
        requireAuth: true,
        params: t.Object({ token: t.String({ minLength: 16, maxLength: 512 }) }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Decline a team invitation by token' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId/leave',
      async ({ access, params, set }) => {
        await controller.leave(access, params.organizationId, params.challengeId, params.teamId)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Teams'],
          summary: 'Leave a team',
          description:
            'A captain must transfer captaincy first, unless leaving dissolves a solo team.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId/transfer-captain',
      async ({ access, params, body, set }) => {
        await controller.transferCaptain(
          access,
          params.organizationId,
          params.challengeId,
          params.teamId,
          body.newCaptainUserId,
        )
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid }),
        body: TransferCaptainBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Transfer captaincy to another team member' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId/members/:userId/remove',
      async ({ access, params, set }) => {
        await controller.removeMember(
          access,
          params.organizationId,
          params.challengeId,
          params.teamId,
          params.userId,
        )
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid, userId: Uuid }),
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: { tags: ['Teams'], summary: 'Remove a team member (captain or organizer)' },
      },
    )
    .post(
      '/organizations/:organizationId/challenges/:challengeId/teams/:teamId/organizer-exception',
      async ({ access, params, body, set }) => {
        await controller.organizerException(
          access,
          params.organizationId,
          params.challengeId,
          params.teamId,
          body,
        )
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        challengeContext: true,
        params: t.Object({ organizationId: Uuid, challengeId: Uuid, teamId: Uuid }),
        body: OrganizerExceptionBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Teams'],
          summary: 'Organizer post-deadline correction',
          description: 'Narrowly scoped to adding or removing one member, with a mandatory reason.',
        },
      },
    )
}
