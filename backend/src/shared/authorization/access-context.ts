import type {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  PlatformRole,
} from '../../generated/prisma/enums'
import type { ChallengeStaffRole } from './roles'

/**
 * Everything an authorization decision is allowed to consider.
 *
 * Assembled by the access-context resolver from authoritative database state,
 * never from the request body, a header, or a cookie-selected "active
 * organization". A client-supplied tenant identifier would make every tenant
 * check self-certifying.
 */

/** The authenticated caller, or an anonymous visitor. */
export interface Actor {
  readonly userId: string
  readonly sessionId: string
  readonly email: string
  readonly emailVerified: boolean
  /** Platform roles currently held. Empty for ordinary users. */
  readonly platformRoles: readonly PlatformRole[]
  /** When the session was created; drives the fresh-session requirement. */
  readonly sessionCreatedAt: Date
  readonly twoFactorEnabled: boolean
  readonly mfaVerifiedAt: Date | null
  readonly authenticationMethod: string | null
}

/** The caller's standing within one organization. */
export interface OrganizationContext {
  readonly organizationId: string
  readonly organizationStatus: OrganizationStatus
  /** Null when the actor is not a member at all. */
  readonly role: OrganizationRole | null
  readonly membershipStatus: MembershipStatus | null
}

/** The caller's standing within one challenge. */
export interface ChallengeContext {
  readonly challengeId: string
  readonly organizationId: string
  /** Challenge-scoped staff role, for judges and mentors. */
  readonly staffRole: ChallengeStaffRole | null
  /** Whether the actor is an approved participant of this challenge. */
  readonly isApprovedParticipant: boolean
}

/**
 * The resolved authorization context for one request.
 *
 * `organization` and `challenge` are populated only when the route names them,
 * and only after confirming the named resource actually belongs to the route's
 * organization.
 */
export interface AccessContext {
  readonly actor: Actor | null
  readonly organization?: OrganizationContext
  readonly challenge?: ChallengeContext
  /** Request metadata recorded on audit entries. */
  readonly ipAddress?: string
  readonly userAgent?: string
}

export function isAuthenticated(context: AccessContext): context is AccessContext & {
  actor: Actor
} {
  return context.actor !== null
}

/** Whether the actor holds any platform role at all. */
export function isPlatformStaff(context: AccessContext): boolean {
  return (context.actor?.platformRoles.length ?? 0) > 0
}

/**
 * Whether the session is recent enough for a sensitive operation.
 *
 * Applied to ownership transfer, elevated role grants, organization
 * suspension, primary email changes, MFA reset, and highly sensitive exports.
 * A long-lived session found on an unattended machine must not be enough.
 */
export function hasFreshSession(context: AccessContext, maxAgeSeconds: number): boolean {
  if (context.actor === null) return false
  const ageSeconds = (Date.now() - context.actor.sessionCreatedAt.getTime()) / 1000
  return ageSeconds <= maxAgeSeconds
}

export function hasMfaAssurance(context: AccessContext, maxAgeSeconds?: number): boolean {
  const verifiedAt = context.actor?.mfaVerifiedAt
  if (verifiedAt === null || verifiedAt === undefined) return false
  if (maxAgeSeconds === undefined) return true
  return (Date.now() - verifiedAt.getTime()) / 1000 <= maxAgeSeconds
}

/** Whether the actor is an active member of the route's organization. */
export function isActiveMember(context: AccessContext): boolean {
  return context.organization?.role !== null && context.organization?.membershipStatus === 'ACTIVE'
}
