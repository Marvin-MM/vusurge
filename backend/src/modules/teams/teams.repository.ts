import type { PrismaTransactionClient } from '../../shared/database'

export type TeamMemberRole = 'CAPTAIN' | 'MEMBER'
export type TeamInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'

export interface TeamRow {
  id: string
  organizationId: string
  challengeId: string
  trackId: string | null
  name: string
  isSolo: boolean
  version: number
  createdByUserId: string
  createdAt: Date
}

export interface TeamMemberRow {
  id: string
  organizationId: string
  challengeId: string
  teamId: string
  userId: string
  role: TeamMemberRole
  joinedAt: Date
}

export interface TeamInvitationRow {
  id: string
  organizationId: string
  challengeId: string
  teamId: string
  invitedUserId: string
  tokenHash: string
  status: TeamInvitationStatus
  invitedByUserId: string
  expiresAt: Date
  respondedAt: Date | null
  createdAt: Date
}

export type TeamPatch = Partial<Pick<TeamRow, 'name' | 'trackId'>>

export interface TeamsRepository {
  createTeam(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      name: string
      trackId?: string
      isSolo?: boolean
      createdByUserId: string
    },
  ): Promise<TeamRow>
  findTeamById(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
  ): Promise<TeamRow | null>
  /** Takes a row lock on the team so capacity checks serialize correctly. */
  lockTeamForUpdate(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
  ): Promise<TeamRow | null>
  listTeams(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<TeamRow[]>
  updateTeam(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
    patch: TeamPatch,
  ): Promise<void>
  deleteTeam(client: PrismaTransactionClient, organizationId: string, teamId: string): Promise<void>

  addMember(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      teamId: string
      userId: string
      role: TeamMemberRole
    },
  ): Promise<TeamMemberRow>
  findMemberByChallengeAndUser(
    client: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
    userId: string,
  ): Promise<TeamMemberRow | null>
  listMembers(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
  ): Promise<TeamMemberRow[]>
  countMembers(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
  ): Promise<number>
  updateMemberRole(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<void>
  removeMember(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
    userId: string,
  ): Promise<void>

  createInvitation(
    client: PrismaTransactionClient,
    input: {
      id: string
      organizationId: string
      challengeId: string
      teamId: string
      invitedUserId: string
      tokenHash: string
      invitedByUserId: string
      expiresAt: Date
    },
  ): Promise<TeamInvitationRow>
  findInvitationByTokenHash(
    client: PrismaTransactionClient,
    tokenHash: string,
  ): Promise<TeamInvitationRow | null>
  findInvitationById(
    client: PrismaTransactionClient,
    organizationId: string,
    invitationId: string,
  ): Promise<TeamInvitationRow | null>
  listInvitations(
    client: PrismaTransactionClient,
    organizationId: string,
    teamId: string,
  ): Promise<TeamInvitationRow[]>
  setInvitationStatus(
    client: PrismaTransactionClient,
    organizationId: string,
    invitationId: string,
    status: TeamInvitationStatus,
  ): Promise<void>
}

export function createTeamsRepository(): TeamsRepository {
  return {
    async createTeam(client, input) {
      return client.challengeTeam.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          name: input.name,
          trackId: input.trackId,
          isSolo: input.isSolo ?? false,
          createdByUserId: input.createdByUserId,
        },
      })
    },

    async findTeamById(client, organizationId, teamId) {
      return client.challengeTeam.findFirst({ where: { id: teamId, organizationId } })
    },

    async lockTeamForUpdate(client, organizationId, teamId) {
      const rows = await client.$queryRaw<TeamRow[]>`
        select id, organization_id as "organizationId", challenge_id as "challengeId",
               track_id as "trackId", name, is_solo as "isSolo", version,
               created_by_user_id as "createdByUserId", created_at as "createdAt"
        from challenge_team
        where id = ${teamId}::uuid and organization_id = ${organizationId}::uuid
        for update
      `
      return rows[0] ?? null
    },

    async listTeams(client, organizationId, challengeId) {
      return client.challengeTeam.findMany({
        where: { organizationId, challengeId },
        orderBy: { createdAt: 'asc' },
      })
    },

    async updateTeam(client, organizationId, teamId, patch) {
      await client.challengeTeam.updateMany({
        where: { id: teamId, organizationId },
        data: { ...patch, version: { increment: 1 } },
      })
    },

    async deleteTeam(client, organizationId, teamId) {
      await client.challengeTeam.deleteMany({ where: { id: teamId, organizationId } })
    },

    async addMember(client, input) {
      return client.challengeTeamMember.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          teamId: input.teamId,
          userId: input.userId,
          role: input.role,
        },
      })
    },

    async findMemberByChallengeAndUser(client, organizationId, challengeId, userId) {
      return client.challengeTeamMember.findFirst({
        where: { organizationId, challengeId, userId },
      })
    },

    async listMembers(client, organizationId, teamId) {
      return client.challengeTeamMember.findMany({
        where: { organizationId, teamId },
        orderBy: { joinedAt: 'asc' },
      })
    },

    async countMembers(client, organizationId, teamId) {
      return client.challengeTeamMember.count({ where: { organizationId, teamId } })
    },

    async updateMemberRole(client, organizationId, teamId, userId, role) {
      await client.challengeTeamMember.updateMany({
        where: { organizationId, teamId, userId },
        data: { role },
      })
    },

    async removeMember(client, organizationId, teamId, userId) {
      await client.challengeTeamMember.deleteMany({ where: { organizationId, teamId, userId } })
    },

    async createInvitation(client, input) {
      return client.teamInvitation.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          teamId: input.teamId,
          invitedUserId: input.invitedUserId,
          tokenHash: input.tokenHash,
          invitedByUserId: input.invitedByUserId,
          expiresAt: input.expiresAt,
        },
      })
    },

    async findInvitationByTokenHash(client, tokenHash) {
      return client.teamInvitation.findUnique({ where: { tokenHash } })
    },

    async findInvitationById(client, organizationId, invitationId) {
      return client.teamInvitation.findFirst({ where: { id: invitationId, organizationId } })
    },

    async listInvitations(client, organizationId, teamId) {
      return client.teamInvitation.findMany({
        where: { organizationId, teamId },
        orderBy: { createdAt: 'desc' },
      })
    },

    async setInvitationStatus(client, organizationId, invitationId, status) {
      await client.teamInvitation.updateMany({
        where: { id: invitationId, organizationId },
        data: { status, respondedAt: status === 'PENDING' ? null : new Date() },
      })
    },
  }
}
