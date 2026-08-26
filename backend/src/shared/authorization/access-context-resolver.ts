import type { PrismaClient, TenantTransactionRunner } from '../database'
import type { Actor, ChallengeContext, OrganizationContext } from './access-context'

/**
 * Resolves authorization context from authoritative database state.
 *
 * This is the ONLY place platform roles, organization membership, and
 * challenge staff assignment are read for authorization purposes. Every
 * lookup is by the authenticated actor's user ID against the row named in the
 * route — never from a client-supplied "active organization", a hidden field,
 * or anything else the caller controls (master prompt section 5.3).
 *
 * Organization/challenge context is obtained only through fixed-search-path
 * SECURITY DEFINER functions. Their signatures bind the exact resource and
 * caller, and their return types expose only authorization fields. The runtime
 * role never receives a general RLS bypass.
 */
export interface AccessContextResolver {
  resolveActor(
    userId: string,
    session: {
      id: string
      createdAt: Date
      mfaVerifiedAt: Date | null
      authenticationMethod: string | null
    },
  ): Promise<Actor | null>
  resolveOrganization(
    organizationId: string,
    userId: string | null,
  ): Promise<OrganizationContext | null>
  resolveChallenge(
    challengeId: string,
    organizationId: string,
    userId: string | null,
  ): Promise<ChallengeContext | null>
}

export function createAccessContextResolver(
  client: PrismaClient,
  transactions: TenantTransactionRunner,
): AccessContextResolver {
  return {
    async resolveActor(userId, session): Promise<Actor | null> {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          twoFactorEnabled: true,
          platformRoles: {
            where: { revokedAt: null },
            select: { role: true },
          },
        },
      })

      if (user === null) return null

      return {
        userId: user.id,
        sessionId: session.id,
        email: user.email,
        emailVerified: user.emailVerified,
        platformRoles: user.platformRoles.map((entry) => entry.role),
        sessionCreatedAt: session.createdAt,
        twoFactorEnabled: user.twoFactorEnabled,
        mfaVerifiedAt: session.mfaVerifiedAt,
        authenticationMethod: session.authenticationMethod,
      }
    },

    async resolveOrganization(organizationId, userId): Promise<OrganizationContext | null> {
      return transactions.withPlatformAccess(
        async (tx) => {
          const rows = await tx.$queryRaw<
            {
              organizationId: string
              organizationStatus: OrganizationContext['organizationStatus']
              role: OrganizationContext['role']
              membershipStatus: OrganizationContext['membershipStatus']
            }[]
          >`
            select organization_id as "organizationId",
                   organization_status as "organizationStatus",
                   membership_role as role,
                   membership_status as "membershipStatus"
            from app_resolve_organization_context(${organizationId}::uuid, ${userId}::uuid)
          `
          const row = rows[0]
          if (row === undefined) return null
          return {
            organizationId: row.organizationId,
            organizationStatus: row.organizationStatus,
            role: row.role,
            membershipStatus: row.membershipStatus,
          }
        },
        { actorUserId: userId ?? 'system', purpose: 'resolve-access-context' },
      )
    },

    async resolveChallenge(challengeId, organizationId, userId): Promise<ChallengeContext | null> {
      return transactions.withPlatformAccess(
        async (tx) => {
          const rows = await tx.$queryRaw<
            {
              challengeId: string
              organizationId: string
              staffRole: ChallengeContext['staffRole']
              participationStatus: string | null
            }[]
          >`
            select challenge_id as "challengeId", organization_id as "organizationId",
                   staff_role as "staffRole", participation_status as "participationStatus"
            from app_resolve_challenge_context(
              ${challengeId}::uuid,
              ${organizationId}::uuid,
              ${userId}::uuid
            )
          `
          const row = rows[0]
          if (row === undefined) return null
          return {
            challengeId: row.challengeId,
            organizationId: row.organizationId,
            staffRole: row.staffRole,
            isApprovedParticipant: row.participationStatus === 'APPROVED',
          }
        },
        { actorUserId: userId ?? 'system', purpose: 'resolve-access-context' },
      )
    },
  }
}
