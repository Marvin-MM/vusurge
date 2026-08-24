import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { newId } from '../../shared/ids'
import type { OutboxWriter } from '../../shared/outbox'
import { QueueName } from '../../shared/queue/queue-names'
import type { RateLimiter } from '../../shared/rate-limit'
import { RateLimitPolicies } from '../../shared/rate-limit'
import { generateSecureToken, hashToken } from '../../shared/security'
import type { ChallengesRepository } from '../challenges/challenges.repository'
import type { ParticipationRepository } from '../participation/participation.repository'
import type {
  TeamInvitationRow,
  TeamMemberRow,
  TeamPatch,
  TeamRow,
  TeamsRepository,
} from './teams.repository'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface CreateTeamInput {
  name: string
  trackId?: string
}

export interface TeamDetail {
  team: TeamRow
  members: TeamMemberRow[]
}

export interface TeamsService {
  createTeam(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    input: CreateTeamInput,
  ): Promise<TeamDetail>
  getTeam(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
  ): Promise<TeamDetail>
  listTeams(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<TeamDetail[]>
  updateTeam(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
    patch: TeamPatch,
  ): Promise<TeamRow>
  inviteMember(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
    invitedUserId: string,
  ): Promise<TeamInvitationRow>
  listInvitations(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
  ): Promise<TeamInvitationRow[]>
  revokeInvitation(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
    invitationId: string,
  ): Promise<void>
  acceptInvitation(access: AccessContext, token: string): Promise<TeamDetail>
  declineInvitation(access: AccessContext, token: string): Promise<void>
  leave(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
  ): Promise<void>
  transferCaptain(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
    newCaptainUserId: string,
  ): Promise<void>
  removeMember(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
    userId: string,
  ): Promise<void>
  organizerException(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
    teamId: string,
    input: { action: 'ADD_MEMBER' | 'REMOVE_MEMBER'; userId: string; reason: string },
  ): Promise<void>

  /**
   * Called by the submissions module: returns the caller's existing team for
   * this challenge, or creates an implicit one-person team if the challenge
   * allows solo participation and the caller has none yet (master prompt
   * section 14, "normalize a solo submission to an implicit ... team").
   */
  ensureTeamForSubmission(
    access: AccessContext,
    organizationId: string,
    challengeId: string,
  ): Promise<TeamRow>
}

function isLocked(challenge: { submissionDeadline: Date | null }, now: Date): boolean {
  return challenge.submissionDeadline !== null && now > challenge.submissionDeadline
}

export function createTeamsService(
  repository: TeamsRepository,
  challengesRepository: ChallengesRepository,
  participationRepository: ParticipationRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  outbox: OutboxWriter,
  rateLimiter: RateLimiter,
): TeamsService {
  async function detail(
    tx: Parameters<TeamsRepository['listMembers']>[0],
    organizationId: string,
    team: TeamRow,
  ): Promise<TeamDetail> {
    const members = await repository.listMembers(tx, organizationId, team.id)
    return { team, members }
  }

  async function requireApprovedParticipant(
    tx: Parameters<TeamsRepository['listMembers']>[0],
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
      throw forbidden('Only approved challenge participants may manage teams.')
    }
  }

  async function requireCaptainOrOrganizer(
    access: AccessContext,
    tx: Parameters<TeamsRepository['listMembers']>[0],
    organizationId: string,
    challengeId: string,
    teamId: string,
    actorUserId: string,
  ): Promise<boolean> {
    const member = await repository.findMemberByChallengeAndUser(
      tx,
      organizationId,
      challengeId,
      actorUserId,
    )
    const isCaptain = member !== null && member.teamId === teamId && member.role === 'CAPTAIN'
    if (isCaptain) return true

    try {
      authorize(access, Permission.ChallengeManageTeams)
      return true
    } catch {
      throw forbidden('Only the team captain or an organizer may perform this action.')
    }
  }

  return {
    async createTeam(access, organizationId, challengeId, input) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (isLocked(challenge, await transactions.databaseNow(tx))) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Teams can no longer be formed after the submission deadline.',
            )
          }

          await requireApprovedParticipant(tx, organizationId, challengeId, actor.userId)

          const existing = await repository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )
          if (existing !== null) {
            throw conflict(ErrorCode.CONFLICT, 'You already belong to a team for this challenge.')
          }

          const team = await repository.createTeam(tx, {
            id: newId(),
            organizationId,
            challengeId,
            name: input.name,
            trackId: input.trackId,
            createdByUserId: actor.userId,
          })
          const member = await repository.addMember(tx, {
            id: newId(),
            organizationId,
            challengeId,
            teamId: team.id,
            userId: actor.userId,
            role: 'CAPTAIN',
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamCreated,
            resourceType: 'challenge_team',
            resourceId: team.id,
            summary: `Created team "${team.name}".`,
          })
          await outbox.write(tx, {
            eventType: 'team.membership_changed',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_team',
            aggregateId: team.id,
            organizationId,
            dedupeKey: `team-membership-changed:${member.id}:created`,
            payload: {
              teamId: team.id,
              teamName: team.name,
              challengeId,
              affectedUserId: actor.userId,
              action: 'JOINED',
            },
          })

          return { team, members: [member] }
        },
        { actorUserId: actor.userId },
      )
    },

    async getTeam(access, organizationId, challengeId, teamId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        const team = await repository.findTeamById(tx, organizationId, teamId)
        if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')
        return detail(tx, organizationId, team)
      })
    },

    async listTeams(access, organizationId, challengeId) {
      authorize(access, Permission.ChallengeView)
      return transactions.withTenant(organizationId, async (tx) => {
        const teams = await repository.listTeams(tx, organizationId, challengeId)
        return Promise.all(teams.map((team) => detail(tx, organizationId, team)))
      })
    },

    async updateTeam(access, organizationId, challengeId, teamId, patch) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const team = await repository.findTeamById(tx, organizationId, teamId)
          if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')

          await requireCaptainOrOrganizer(
            access,
            tx,
            organizationId,
            challengeId,
            teamId,
            actor.userId,
          )

          await repository.updateTeam(tx, organizationId, teamId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamUpdated,
            resourceType: 'challenge_team',
            resourceId: teamId,
            summary: `Updated team "${team.name}".`,
          })

          const after = await repository.findTeamById(tx, organizationId, teamId)
          if (after === null) throw notFound('Team not found.')
          return after
        },
        { actorUserId: actor.userId },
      )
    },

    async inviteMember(access, organizationId, challengeId, teamId, invitedUserId) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (isLocked(challenge, await transactions.databaseNow(tx))) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Team membership is locked after the submission deadline.',
            )
          }

          const team = await repository.findTeamById(tx, organizationId, teamId)
          if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')

          await requireCaptainOrOrganizer(
            access,
            tx,
            organizationId,
            challengeId,
            teamId,
            actor.userId,
          )

          await requireApprovedParticipant(tx, organizationId, challengeId, invitedUserId)

          const existingMembership = await repository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            invitedUserId,
          )
          if (existingMembership !== null) {
            throw conflict(ErrorCode.CONFLICT, 'That participant already belongs to a team.')
          }

          const currentSize = await repository.countMembers(tx, organizationId, teamId)
          if (currentSize >= challenge.maxTeamSize) {
            throw conflict(ErrorCode.CONFLICT, 'This team is already at its maximum size.')
          }

          const token = generateSecureToken()
          const invitation = await repository.createInvitation(tx, {
            id: newId(),
            organizationId,
            challengeId,
            teamId,
            invitedUserId,
            tokenHash: hashToken(token),
            invitedByUserId: actor.userId,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamInvitationCreated,
            resourceType: 'team_invitation',
            resourceId: invitation.id,
            summary: `Invited a participant to team "${team.name}".`,
          })

          await outbox.write(tx, {
            eventType: 'team.invitation_created',
            queueName: QueueName.Email,
            aggregateType: 'team_invitation',
            aggregateId: invitation.id,
            organizationId,
            dedupeKey: `team-invitation-created:${invitation.id}`,
            payload: {
              invitationId: invitation.id,
              invitedUserId,
              teamId,
              teamName: team.name,
              token,
            },
          })

          return invitation
        },
        { actorUserId: actor.userId },
      )
    },

    async listInvitations(access, organizationId, challengeId, teamId) {
      const { actor } = requireVerifiedActor(access)
      return transactions.withTenant(organizationId, async (tx) => {
        const team = await repository.findTeamById(tx, organizationId, teamId)
        if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')
        await requireCaptainOrOrganizer(
          access,
          tx,
          organizationId,
          challengeId,
          teamId,
          actor.userId,
        )
        return repository.listInvitations(tx, organizationId, teamId)
      })
    },

    async revokeInvitation(access, organizationId, challengeId, teamId, invitationId) {
      const { actor } = requireVerifiedActor(access)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const team = await repository.findTeamById(tx, organizationId, teamId)
          if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')
          await requireCaptainOrOrganizer(
            access,
            tx,
            organizationId,
            challengeId,
            teamId,
            actor.userId,
          )

          const invitation = await repository.findInvitationById(tx, organizationId, invitationId)
          if (invitation === null || invitation.teamId !== teamId)
            throw notFound('Invitation not found.')
          if (invitation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'Only a pending invitation can be revoked.')
          }

          await repository.setInvitationStatus(tx, organizationId, invitationId, 'REVOKED')

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamInvitationRevoked,
            resourceType: 'team_invitation',
            resourceId: invitationId,
            summary: 'Revoked a team invitation.',
          })
        },
        { actorUserId: actor.userId },
      )
    },

    async acceptInvitation(access, token) {
      const { actor } = requireVerifiedActor(access)
      await rateLimiter.enforce(RateLimitPolicies.TeamInvitationAcceptance, {
        userId: actor.userId,
        ipAddress: access.ipAddress,
      })

      const tokenHash = hashToken(token)
      const invitation = await transactions.withSecretLookup((tx) =>
        repository.findInvitationByTokenHash(tx, tokenHash),
      )
      if (invitation === null) throw notFound('This invitation link is invalid.')

      return transactions.withTenant(
        invitation.organizationId,
        async (tx) => {
          const now = await transactions.databaseNow(tx)

          if (invitation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'This invitation has already been used.')
          }
          if (invitation.expiresAt <= now) {
            throw conflict(ErrorCode.CONFLICT, 'This invitation has expired.')
          }
          if (invitation.invitedUserId !== actor.userId) {
            throw forbidden('This invitation was issued to a different user.')
          }

          const challenge = await challengesRepository.findById(
            tx,
            invitation.organizationId,
            invitation.challengeId,
          )
          if (challenge === null) throw notFound('Challenge not found.')
          if (isLocked(challenge, now)) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Team membership is locked after the submission deadline.',
            )
          }

          const existingMembership = await repository.findMemberByChallengeAndUser(
            tx,
            invitation.organizationId,
            invitation.challengeId,
            actor.userId,
          )
          if (existingMembership !== null) {
            throw conflict(ErrorCode.CONFLICT, 'You already belong to a team for this challenge.')
          }

          // Row lock on the team serializes concurrent acceptances so two
          // invitees cannot both take the last available slot.
          const team = await repository.lockTeamForUpdate(
            tx,
            invitation.organizationId,
            invitation.teamId,
          )
          if (team === null) throw notFound('Team not found.')

          const currentSize = await repository.countMembers(tx, invitation.organizationId, team.id)
          if (currentSize >= challenge.maxTeamSize) {
            throw conflict(ErrorCode.CONFLICT, 'This team is already at its maximum size.')
          }

          const member = await repository.addMember(tx, {
            id: newId(),
            organizationId: invitation.organizationId,
            challengeId: invitation.challengeId,
            teamId: team.id,
            userId: actor.userId,
            role: 'MEMBER',
          })

          await repository.setInvitationStatus(
            tx,
            invitation.organizationId,
            invitation.id,
            'ACCEPTED',
          )

          await audit.write(tx, {
            organizationId: invitation.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamMemberJoined,
            resourceType: 'team_invitation',
            resourceId: invitation.id,
            summary: `Joined team "${team.name}".`,
          })
          await outbox.write(tx, {
            eventType: 'team.membership_changed',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_team',
            aggregateId: team.id,
            organizationId: invitation.organizationId,
            dedupeKey: `team-membership-changed:${member.id}:joined`,
            payload: {
              teamId: team.id,
              teamName: team.name,
              challengeId: invitation.challengeId,
              affectedUserId: actor.userId,
              action: 'JOINED',
            },
          })

          const members = await repository.listMembers(tx, invitation.organizationId, team.id)
          return { team, members: [...members.filter((m) => m.id !== member.id), member] }
        },
        { actorUserId: actor.userId },
      )
    },

    async declineInvitation(access, token) {
      const { actor } = requireVerifiedActor(access)
      const tokenHash = hashToken(token)
      const invitation = await transactions.withSecretLookup((tx) =>
        repository.findInvitationByTokenHash(tx, tokenHash),
      )
      if (invitation === null) throw notFound('This invitation link is invalid.')

      await transactions.withTenant(
        invitation.organizationId,
        async (tx) => {
          if (invitation.invitedUserId !== actor.userId) {
            throw forbidden('This invitation was issued to a different user.')
          }
          if (invitation.status !== 'PENDING') {
            throw conflict(ErrorCode.CONFLICT, 'This invitation has already been used.')
          }

          await repository.setInvitationStatus(
            tx,
            invitation.organizationId,
            invitation.id,
            'DECLINED',
          )

          await audit.write(tx, {
            organizationId: invitation.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamInvitationDeclined,
            resourceType: 'team_invitation',
            resourceId: invitation.id,
            summary: 'Declined a team invitation.',
          })
        },
        { actorUserId: actor.userId },
      )
    },

    async leave(access, organizationId, challengeId, teamId) {
      const { actor } = requireVerifiedActor(access)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (isLocked(challenge, await transactions.databaseNow(tx))) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Team membership is locked after the submission deadline.',
            )
          }

          const member = await repository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )
          if (member === null || member.teamId !== teamId)
            throw notFound('You are not a member of this team.')

          const memberCount = await repository.countMembers(tx, organizationId, teamId)

          if (member.role === 'CAPTAIN' && memberCount > 1) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Transfer captaincy to another member before leaving this team.',
            )
          }

          await repository.removeMember(tx, organizationId, teamId, actor.userId)
          if (memberCount <= 1) {
            await repository.deleteTeam(tx, organizationId, teamId)
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamMemberLeft,
            resourceType: 'challenge_team',
            resourceId: teamId,
            summary: 'Left a team.',
          })
          await outbox.write(tx, {
            eventType: 'team.membership_changed',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_team',
            aggregateId: teamId,
            organizationId,
            dedupeKey: `team-membership-changed:${member.id}:left`,
            payload: {
              teamId,
              teamName: 'your team',
              challengeId,
              affectedUserId: actor.userId,
              action: 'LEFT',
            },
          })
        },
        { actorUserId: actor.userId },
      )
    },

    async transferCaptain(access, organizationId, challengeId, teamId, newCaptainUserId) {
      const { actor } = requireVerifiedActor(access)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const team = await repository.findTeamById(tx, organizationId, teamId)
          if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')

          const currentCaptain = await repository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )
          if (
            currentCaptain === null ||
            currentCaptain.teamId !== teamId ||
            currentCaptain.role !== 'CAPTAIN'
          ) {
            throw forbidden('Only the current captain may transfer captaincy.')
          }

          const target = await repository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            newCaptainUserId,
          )
          if (target === null || target.teamId !== teamId) {
            throw badRequest('The new captain must already be a member of this team.')
          }

          await repository.updateMemberRole(tx, organizationId, teamId, actor.userId, 'MEMBER')
          await repository.updateMemberRole(tx, organizationId, teamId, newCaptainUserId, 'CAPTAIN')

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamCaptainTransferred,
            resourceType: 'challenge_team',
            resourceId: teamId,
            summary: `Transferred captaincy to ${newCaptainUserId}.`,
          })
          await outbox.write(tx, {
            eventType: 'team.membership_changed',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_team',
            aggregateId: teamId,
            organizationId,
            dedupeKey: `team-membership-changed:${target.id}:captain`,
            payload: {
              teamId,
              teamName: team.name,
              challengeId,
              affectedUserId: newCaptainUserId,
              action: 'CAPTAIN_TRANSFERRED',
            },
          })
        },
        { actorUserId: actor.userId },
      )
    },

    async removeMember(access, organizationId, challengeId, teamId, userId) {
      const { actor } = requireVerifiedActor(access)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (isLocked(challenge, await transactions.databaseNow(tx))) {
            throw conflict(
              ErrorCode.CONFLICT,
              'Team membership is locked after the submission deadline.',
            )
          }

          const team = await repository.findTeamById(tx, organizationId, teamId)
          if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')
          if (userId === actor.userId) {
            throw badRequest('Use the leave endpoint to remove yourself.')
          }

          await requireCaptainOrOrganizer(
            access,
            tx,
            organizationId,
            challengeId,
            teamId,
            actor.userId,
          )

          const target = await repository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            userId,
          )
          if (target === null || target.teamId !== teamId) throw notFound('Team member not found.')
          if (target.role === 'CAPTAIN') {
            throw conflict(ErrorCode.CONFLICT, 'Transfer captaincy before removing the captain.')
          }

          await repository.removeMember(tx, organizationId, teamId, userId)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamMemberRemoved,
            resourceType: 'challenge_team',
            resourceId: teamId,
            summary: `Removed ${userId} from the team.`,
          })
          await outbox.write(tx, {
            eventType: 'team.membership_changed',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_team',
            aggregateId: teamId,
            organizationId,
            dedupeKey: `team-membership-changed:${target.id}:removed`,
            payload: {
              teamId,
              teamName: team.name,
              challengeId,
              affectedUserId: userId,
              action: 'REMOVED',
            },
          })
        },
        { actorUserId: actor.userId },
      )
    },

    async organizerException(access, organizationId, challengeId, teamId, input) {
      authorize(access, Permission.ChallengeManageTeams)
      const actorUserId = access.actor?.userId
      if (actorUserId === undefined) throw forbidden()

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const team = await repository.findTeamById(tx, organizationId, teamId)
          if (team === null || team.challengeId !== challengeId) throw notFound('Team not found.')

          if (input.action === 'ADD_MEMBER') {
            const existing = await repository.findMemberByChallengeAndUser(
              tx,
              organizationId,
              challengeId,
              input.userId,
            )
            if (existing !== null) {
              throw conflict(ErrorCode.CONFLICT, 'That participant already belongs to a team.')
            }
            await repository.addMember(tx, {
              id: newId(),
              organizationId,
              challengeId,
              teamId,
              userId: input.userId,
              role: 'MEMBER',
            })
          } else {
            const target = await repository.findMemberByChallengeAndUser(
              tx,
              organizationId,
              challengeId,
              input.userId,
            )
            if (target === null || target.teamId !== teamId)
              throw notFound('Team member not found.')
            await repository.removeMember(tx, organizationId, teamId, input.userId)
          }

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId,
            action: AuditAction.TeamOrganizerException,
            resourceType: 'challenge_team',
            resourceId: teamId,
            summary: `Organizer exception: ${input.action.toLowerCase().replace('_', ' ')} for ${input.userId}.`,
            reason: input.reason,
          })
          await outbox.write(tx, {
            eventType: 'team.membership_changed',
            queueName: QueueName.NotificationFanout,
            aggregateType: 'challenge_team',
            aggregateId: teamId,
            organizationId,
            dedupeKey: `team-membership-changed:${teamId}:${input.userId}:${input.action}:${team.version}`,
            payload: {
              teamId,
              teamName: team.name,
              challengeId,
              affectedUserId: input.userId,
              action: input.action === 'ADD_MEMBER' ? 'JOINED' : 'REMOVED',
            },
          })
        },
        { actorUserId },
      )
    },

    async ensureTeamForSubmission(access, organizationId, challengeId) {
      const { actor } = requireVerifiedActor(access)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          // Registering for the challenge is the gate on submitting to it.
          // Permission checks alone cannot enforce this: an organization
          // MEMBER already holds submission.create/edit_own/submit by role
          // (roles.ts's MEMBER_PERMISSIONS), identical to what an APPROVED
          // participant is granted, so without this every member of the host
          // org could open a submission on a challenge they never entered —
          // and the implicit-solo-team branch below would silently create
          // their team as a side effect. This also correctly denies a
          // participant whose record is no longer APPROVED (withdrawn,
          // rejected, or disqualified), including one who had already joined
          // a team before that happened.
          await requireApprovedParticipant(tx, organizationId, challengeId, actor.userId)

          const existing = await repository.findMemberByChallengeAndUser(
            tx,
            organizationId,
            challengeId,
            actor.userId,
          )
          if (existing !== null) {
            const team = await repository.findTeamById(tx, organizationId, existing.teamId)
            if (team === null) throw notFound('Team not found.')
            return team
          }

          const challenge = await challengesRepository.findById(tx, organizationId, challengeId)
          if (challenge === null) throw notFound('Challenge not found.')
          if (!challenge.soloParticipationAllowed) {
            throw conflict(
              ErrorCode.CONFLICT,
              'This challenge requires a team; join or create one before submitting.',
            )
          }

          const team = await repository.createTeam(tx, {
            id: newId(),
            organizationId,
            challengeId,
            name: 'Solo',
            isSolo: true,
            createdByUserId: actor.userId,
          })
          await repository.addMember(tx, {
            id: newId(),
            organizationId,
            challengeId,
            teamId: team.id,
            userId: actor.userId,
            role: 'CAPTAIN',
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.TeamCreated,
            resourceType: 'challenge_team',
            resourceId: team.id,
            summary: 'Created an implicit solo team.',
          })

          return team
        },
        { actorUserId: actor.userId },
      )
    },
  }
}
