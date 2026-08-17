import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { TeamInvitationRow, TeamMemberRow, TeamPatch } from './teams.repository'
import type { CreateTeamInput, TeamDetail, TeamsService } from './teams.service'

function serializeMember(row: TeamMemberRow) {
  return { userId: row.userId, role: row.role, joinedAt: row.joinedAt.toISOString() }
}

function serializeTeam(detail: TeamDetail) {
  return {
    id: detail.team.id,
    challengeId: detail.team.challengeId,
    trackId: detail.team.trackId,
    name: detail.team.name,
    isSolo: detail.team.isSolo,
    members: detail.members.map(serializeMember),
    createdAt: detail.team.createdAt.toISOString(),
  }
}

function serializeInvitation(row: TeamInvitationRow) {
  return {
    id: row.id,
    teamId: row.teamId,
    invitedUserId: row.invitedUserId,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export function createTeamsController(service: TeamsService) {
  return {
    async createTeam(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      input: CreateTeamInput,
    ) {
      requireActor(access)
      const detail = await service.createTeam(access, organizationId, challengeId, input)
      return serializeTeam(detail)
    },

    async getTeam(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
    ) {
      requireActor(access)
      const detail = await service.getTeam(access, organizationId, challengeId, teamId)
      return serializeTeam(detail)
    },

    async listTeams(access: AccessContext, organizationId: string, challengeId: string) {
      requireActor(access)
      const details = await service.listTeams(access, organizationId, challengeId)
      return details.map(serializeTeam)
    },

    async updateTeam(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
      patch: TeamPatch,
    ) {
      requireActor(access)
      const team = await service.updateTeam(access, organizationId, challengeId, teamId, patch)
      const detail = await service.getTeam(access, organizationId, challengeId, team.id)
      return serializeTeam(detail)
    },

    async inviteMember(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
      invitedUserId: string,
    ) {
      requireActor(access)
      const row = await service.inviteMember(
        access,
        organizationId,
        challengeId,
        teamId,
        invitedUserId,
      )
      return serializeInvitation(row)
    },

    async listInvitations(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
    ) {
      requireActor(access)
      const rows = await service.listInvitations(access, organizationId, challengeId, teamId)
      return rows.map(serializeInvitation)
    },

    async revokeInvitation(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
      invitationId: string,
    ) {
      requireActor(access)
      await service.revokeInvitation(access, organizationId, challengeId, teamId, invitationId)
    },

    async acceptInvitation(access: AccessContext, token: string) {
      requireActor(access)
      const detail = await service.acceptInvitation(access, token)
      return serializeTeam(detail)
    },

    async declineInvitation(access: AccessContext, token: string) {
      requireActor(access)
      await service.declineInvitation(access, token)
    },

    async leave(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
    ) {
      requireActor(access)
      await service.leave(access, organizationId, challengeId, teamId)
    },

    async transferCaptain(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
      newCaptainUserId: string,
    ) {
      requireActor(access)
      await service.transferCaptain(access, organizationId, challengeId, teamId, newCaptainUserId)
    },

    async removeMember(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
      userId: string,
    ) {
      requireActor(access)
      await service.removeMember(access, organizationId, challengeId, teamId, userId)
    },

    async organizerException(
      access: AccessContext,
      organizationId: string,
      challengeId: string,
      teamId: string,
      input: { action: 'ADD_MEMBER' | 'REMOVE_MEMBER'; userId: string; reason: string },
    ) {
      requireActor(access)
      await service.organizerException(access, organizationId, challengeId, teamId, input)
    },
  }
}

export type TeamsController = ReturnType<typeof createTeamsController>
