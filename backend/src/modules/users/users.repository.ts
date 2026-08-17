import type { PrismaTransactionClient } from '../../shared/database'
import { newId } from '../../shared/ids'

/**
 * Global user data access.
 *
 * User, profile, and skills are global — not tenant-owned — so these queries
 * never go through `withTenant`. Writes that touch more than one row (skill
 * replacement) are still wrapped in a transaction by the service, via
 * `withoutTenant`, so they remain atomic.
 */

export interface UserWithProfile {
  id: string
  email: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  profile: {
    displayName: string | null
    bio: string | null
    location: string | null
    avatarAssetId: string | null
    githubUrl: string | null
    linkedinUrl: string | null
    portfolioUrl: string | null
    discordHandle: string | null
    visibility: 'PUBLIC' | 'ORGANIZATION_MEMBERS' | 'PRIVATE'
  } | null
  skills: { skillId: string | null; customName: string | null; skillName: string | null }[]
}

export interface ProfilePatch {
  displayName?: string
  bio?: string
  location?: string
  avatarAssetId?: string | null
  githubUrl?: string | null
  linkedinUrl?: string | null
  portfolioUrl?: string | null
  discordHandle?: string | null
  visibility?: 'PUBLIC' | 'ORGANIZATION_MEMBERS' | 'PRIVATE'
}

export interface MembershipSummaryRow {
  organizationId: string
  organizationSlug: string
  organizationName: string
  role: 'ORG_OWNER' | 'ORG_ADMIN' | 'CHALLENGE_MANAGER' | 'MEMBER'
  joinedAt: Date
}

export interface MyChallengeParticipationRow {
  id: string
  organizationId: string
  organizationSlug: string
  challengeId: string
  challengeTitle: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'DISQUALIFIED'
  appliedAt: Date
}

export interface MyTeamInvitationRow {
  id: string
  organizationId: string
  organizationSlug: string
  challengeId: string
  teamId: string
  teamName: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'
  expiresAt: Date
  createdAt: Date
}

export interface MyChallengeStaffInvitationRow {
  id: string
  organizationId: string
  organizationSlug: string
  challengeId: string
  challengeTitle: string
  role: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'
  expiresAt: Date
  createdAt: Date
}

export interface UsersRepository {
  findWithProfile(client: PrismaTransactionClient, userId: string): Promise<UserWithProfile | null>
  upsertProfile(client: PrismaTransactionClient, userId: string, patch: ProfilePatch): Promise<void>
  findActiveSkillsByIds(
    client: PrismaTransactionClient,
    skillIds: readonly string[],
  ): Promise<string[]>
  replaceSkills(
    client: PrismaTransactionClient,
    userId: string,
    skillIds: readonly string[],
    customNames: readonly string[],
  ): Promise<void>
  listActiveMemberships(
    client: PrismaTransactionClient,
    userId: string,
  ): Promise<MembershipSummaryRow[]>
  /** Whether `viewerId` shares any active organization membership with `targetId`. */
  shareAnyOrganization(
    client: PrismaTransactionClient,
    viewerId: string,
    targetId: string,
  ): Promise<boolean>
  listMyChallengeParticipations(
    client: PrismaTransactionClient,
    userId: string,
  ): Promise<MyChallengeParticipationRow[]>
  listMyTeamInvitations(
    client: PrismaTransactionClient,
    userId: string,
  ): Promise<MyTeamInvitationRow[]>
  listMyChallengeStaffInvitations(
    client: PrismaTransactionClient,
    email: string,
  ): Promise<MyChallengeStaffInvitationRow[]>
}

export function createUsersRepository(): UsersRepository {
  return {
    async findWithProfile(client, userId) {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          twoFactorEnabled: true,
          profile: {
            select: {
              displayName: true,
              bio: true,
              location: true,
              avatarAssetId: true,
              githubUrl: true,
              linkedinUrl: true,
              portfolioUrl: true,
              discordHandle: true,
              visibility: true,
            },
          },
          skills: {
            select: {
              skillId: true,
              customName: true,
              skill: { select: { name: true } },
            },
          },
        },
      })

      if (user === null) return null

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        profile: user.profile,
        skills: user.skills.map((entry) => ({
          skillId: entry.skillId,
          customName: entry.customName,
          skillName: entry.skill?.name ?? null,
        })),
      }
    },

    async upsertProfile(client, userId, patch) {
      await client.userProfile.upsert({
        where: { userId },
        create: { userId, ...patch },
        update: patch,
      })
    },

    async findActiveSkillsByIds(client, skillIds) {
      if (skillIds.length === 0) return []
      const rows = await client.skill.findMany({
        where: { id: { in: [...skillIds] }, active: true },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    },

    async replaceSkills(client, userId, skillIds, customNames) {
      // Delete-then-insert inside one transaction, so a caller never observes
      // a partially replaced skill set.
      await client.userSkill.deleteMany({ where: { userId } })

      const rows = [
        ...skillIds.map((skillId) => ({ id: newId(), userId, skillId, customName: null })),
        ...customNames.map((customName) => ({ id: newId(), userId, skillId: null, customName })),
      ]

      if (rows.length > 0) {
        await client.userSkill.createMany({ data: rows })
      }
    },

    async listActiveMemberships(client, userId) {
      return client.$queryRaw<MembershipSummaryRow[]>`
        select organization_id as "organizationId", organization_slug as "organizationSlug",
               organization_name as "organizationName", membership_role as role,
               joined_at as "joinedAt"
        from app_list_active_memberships(${userId}::uuid)
      `
    },

    async shareAnyOrganization(client, viewerId, targetId) {
      const rows = await client.$queryRaw<{ shares: boolean }[]>`
        select app_user_shares_organization(${viewerId}::uuid, ${targetId}::uuid) as shares
      `
      return rows[0]?.shares ?? false
    },

    async listMyChallengeParticipations(client, userId) {
      return client.$queryRaw<MyChallengeParticipationRow[]>`
        select id, organization_id as "organizationId",
               organization_slug as "organizationSlug", challenge_id as "challengeId",
               challenge_title as "challengeTitle", participation_status as status,
               applied_at as "appliedAt"
        from app_list_my_challenge_participations(${userId}::uuid)
      `
    },

    async listMyTeamInvitations(client, userId) {
      return client.$queryRaw<MyTeamInvitationRow[]>`
        select id, organization_id as "organizationId",
               organization_slug as "organizationSlug", challenge_id as "challengeId",
               team_id as "teamId", team_name as "teamName", invitation_status as status,
               expires_at as "expiresAt", created_at as "createdAt"
        from app_list_my_team_invitations(${userId}::uuid)
      `
    },

    async listMyChallengeStaffInvitations(client, email) {
      return client.$queryRaw<MyChallengeStaffInvitationRow[]>`
        select id, organization_id as "organizationId",
               organization_slug as "organizationSlug", challenge_id as "challengeId",
               challenge_title as "challengeTitle", staff_role as role,
               invitation_status as status, expires_at as "expiresAt",
               created_at as "createdAt"
        from app_list_my_staff_invitations(${email})
      `
    },
  }
}
