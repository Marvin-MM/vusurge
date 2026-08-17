import { ErrorCode, forbidden, notFound, unauthenticated } from '../errors'
import {
  type AccessContext,
  hasFreshSession,
  hasMfaAssurance,
  isAuthenticated,
} from './access-context'
import type { Permission } from './permissions'
import {
  challengeParticipantHas,
  challengeStaffRoleHas,
  organizationRoleHas,
  platformRoleHas,
} from './roles'

/**
 * The central authorization policy.
 *
 * Every decision about a tenant object runs through here, and every decision
 * answers the same five questions in the same order (master prompt section 5.3):
 *
 *   1. Is there an authenticated actor, where one is required?
 *   2. Is the organization in a state that permits this action?
 *   3. Does the actor hold membership or an explicit challenge assignment?
 *   4. Does the resource belong to the organization named in the route?
 *   5. Do the action's own lifecycle and state rules allow it?
 *
 * Question 4 is answered by the repository layer, which scopes every query by
 * tenant; questions 1-3 are answered here; question 5 belongs to the service
 * that owns the workflow.
 *
 * Deny by default. Every path that does not explicitly grant, denies.
 */

export interface AuthorizationOptions {
  /**
   * Require a recently authenticated session. Used for irreversible or
   * privilege-changing operations.
   */
  readonly requireFreshSession?: boolean
  readonly freshSessionMaxAgeSeconds?: number
  /** Require verified email. Every membership-granting path sets this. */
  readonly requireVerifiedEmail?: boolean
  /**
   * Permit the action while the organization is SUSPENDED. Almost nothing
   * should: suspension exists to stop the organization operating.
   */
  readonly allowSuspendedOrganization?: boolean
  /** Permit the action while the organization is ARCHIVED. Read-only paths only. */
  readonly allowArchivedOrganization?: boolean
}

export interface AuthorizationDecision {
  readonly allowed: boolean
  /** Why the request was denied. Never returned verbatim to the client. */
  readonly reason?: string
  readonly code?: ErrorCode
}

/**
 * Decide whether the actor may exercise `permission` in the resolved context.
 *
 * Returns a decision rather than throwing so that callers which need to branch
 * (for example, choosing between a full and a redacted projection) can do so
 * without exception control flow. `authorize` throws for the common case.
 */
export function checkPermission(
  context: AccessContext,
  permission: Permission,
  options: AuthorizationOptions = {},
): AuthorizationDecision {
  if (!isAuthenticated(context)) {
    return {
      allowed: false,
      reason: 'no authenticated actor',
      code: ErrorCode.UNAUTHENTICATED,
    }
  }

  const { actor } = context

  if (options.requireVerifiedEmail === true && !actor.emailVerified) {
    return {
      allowed: false,
      reason: 'email not verified',
      code: ErrorCode.EMAIL_NOT_VERIFIED,
    }
  }

  if (options.requireFreshSession === true) {
    const maxAge = options.freshSessionMaxAgeSeconds ?? 900
    if (!hasFreshSession(context, maxAge)) {
      return {
        allowed: false,
        reason: 'session is not fresh enough for a sensitive operation',
        code: ErrorCode.FRESH_SESSION_REQUIRED,
      }
    }

    if (actor.platformRoles.includes('PLATFORM_SUPERADMIN') && !hasMfaAssurance(context, maxAge)) {
      return {
        allowed: false,
        reason: 'platform superadmin session lacks recent MFA assurance',
        code: ErrorCode.MFA_REQUIRED,
      }
    }
  }

  // --- Platform permissions -------------------------------------------------
  // Platform roles are evaluated first and independently: they are not a
  // super-set of organization roles, and they grant only platform permissions.
  for (const role of actor.platformRoles) {
    if (platformRoleHas(role, permission)) {
      if (
        role === 'PLATFORM_SUPERADMIN' &&
        (!actor.twoFactorEnabled || !hasMfaAssurance(context))
      ) {
        return {
          allowed: false,
          reason: 'platform superadmin session lacks MFA assurance',
          code: ErrorCode.MFA_REQUIRED,
        }
      }
      return { allowed: true }
    }
  }

  // --- Organization permissions --------------------------------------------
  const organization = context.organization
  if (organization !== undefined) {
    const statusDecision = checkOrganizationStatus(organization.organizationStatus, options)
    if (statusDecision !== undefined) return statusDecision

    if (organization.role !== null && organization.membershipStatus === 'ACTIVE') {
      if (organizationRoleHas(organization.role, permission)) {
        return { allowed: true }
      }
    } else if (organization.role !== null) {
      return {
        allowed: false,
        reason: 'membership is not active',
        code: ErrorCode.MEMBERSHIP_REQUIRED,
      }
    }
  }

  // --- Challenge-scoped permissions ----------------------------------------
  // An external judge holds no organization membership at all, so this is
  // evaluated independently rather than as a fallback within the org branch.
  const challenge = context.challenge
  if (challenge?.staffRole != null && challengeStaffRoleHas(challenge.staffRole, permission)) {
    return { allowed: true }
  }

  // An APPROVED participant holds a narrow set of challenge-scoped
  // permissions independent of organization membership (master prompt
  // section 12) — this is what lets an OPEN_AUTHENTICATED registrant, who by
  // definition has no organization role, view the challenge and manage their
  // own team/submission.
  if (challenge?.isApprovedParticipant === true && challengeParticipantHas(permission)) {
    return { allowed: true }
  }

  // A caller with NO relationship at all to the named organization — not a
  // member, not challenge staff, not an approved participant — must be
  // denied identically to a caller asking about an organization that does
  // not exist. Otherwise a 403 here and a 404 for a fabricated ID become
  // distinguishable, which is precisely the cross-tenant existence oracle
  // master prompt sections 35 and 54 (threat class 1–2) prohibit. A caller
  // who WAS a member (removed/inactive), holds a challenge-staff
  // relationship, or is an approved participant already knows this
  // organization exists, so those cases stay a 403.
  const hasNoRelationship =
    organization?.role === null &&
    (challenge?.staffRole ?? null) === null &&
    challenge?.isApprovedParticipant !== true
  if (hasNoRelationship) {
    return {
      allowed: false,
      reason: `actor has no relationship to this organization`,
      code: ErrorCode.NOT_FOUND,
    }
  }

  return {
    allowed: false,
    reason: `actor does not hold ${permission}`,
    code: ErrorCode.INSUFFICIENT_ROLE,
  }
}

function checkOrganizationStatus(
  status: string,
  options: AuthorizationOptions,
): AuthorizationDecision | undefined {
  if (status === 'SUSPENDED' && options.allowSuspendedOrganization !== true) {
    // An owner cannot override a platform suspension: that is the point of it.
    return {
      allowed: false,
      reason: 'organization is suspended',
      code: ErrorCode.ORGANIZATION_SUSPENDED,
    }
  }
  if (status === 'ARCHIVED' && options.allowArchivedOrganization !== true) {
    return {
      allowed: false,
      reason: 'organization is archived',
      code: ErrorCode.ORGANIZATION_ARCHIVED,
    }
  }
  return undefined
}

/**
 * Enforce a permission, throwing the appropriate error when denied.
 *
 * The thrown error distinguishes 401 from 403 but never explains *which*
 * organization or resource the actor is missing access to: that would turn a
 * denial into an oracle for probing other tenants.
 */
export function authorize(
  context: AccessContext,
  permission: Permission,
  options: AuthorizationOptions = {},
): void {
  const decision = checkPermission(context, permission, options)
  if (decision.allowed) return

  if (decision.code === ErrorCode.UNAUTHENTICATED) {
    throw unauthenticated()
  }

  if (decision.code === ErrorCode.EMAIL_NOT_VERIFIED) {
    throw forbidden(
      'Verify your email address before performing this action.',
      ErrorCode.EMAIL_NOT_VERIFIED,
    )
  }

  if (decision.code === ErrorCode.FRESH_SESSION_REQUIRED) {
    throw forbidden(
      'This action requires a recent sign-in. Authenticate again and retry.',
      ErrorCode.FRESH_SESSION_REQUIRED,
    )
  }

  if (decision.code === ErrorCode.MFA_REQUIRED) {
    throw forbidden(
      'Two-factor authentication must be enabled on this account before performing this action.',
      ErrorCode.MFA_REQUIRED,
    )
  }

  if (decision.code === ErrorCode.ORGANIZATION_SUSPENDED) {
    throw forbidden('This organization is suspended.', ErrorCode.ORGANIZATION_SUSPENDED)
  }

  if (decision.code === ErrorCode.ORGANIZATION_ARCHIVED) {
    throw forbidden('This organization is archived.', ErrorCode.ORGANIZATION_ARCHIVED)
  }

  if (decision.code === ErrorCode.NOT_FOUND) {
    // A caller with no relationship to this organization at all sees exactly
    // what a caller naming a nonexistent organization sees — never a 403
    // that would confirm the ID refers to something real (master prompt
    // section 35).
    throw notFound()
  }

  throw forbidden(
    'You do not have permission to perform this action.',
    decision.code ?? ErrorCode.FORBIDDEN,
  )
}

/** Require an authenticated actor without checking any specific permission. */
export function requireActor(
  context: AccessContext,
): AccessContext & { actor: NonNullable<AccessContext['actor']> } {
  if (!isAuthenticated(context)) {
    throw unauthenticated()
  }
  return context
}

/** Require an authenticated actor whose email is verified. */
export function requireVerifiedActor(
  context: AccessContext,
): AccessContext & { actor: NonNullable<AccessContext['actor']> } {
  const authenticated = requireActor(context)
  if (!authenticated.actor.emailVerified) {
    throw forbidden(
      'Verify your email address before performing this action.',
      ErrorCode.EMAIL_NOT_VERIFIED,
    )
  }
  return authenticated
}

/** Require a recently authenticated actor for sensitive self-service actions. */
export function requireFreshActor(
  context: AccessContext,
  maxAgeSeconds = 900,
): AccessContext & { actor: NonNullable<AccessContext['actor']> } {
  const authenticated = requireVerifiedActor(context)
  if (!hasFreshSession(authenticated, maxAgeSeconds)) {
    throw forbidden(
      'This action requires a recent sign-in. Authenticate again and retry.',
      ErrorCode.FRESH_SESSION_REQUIRED,
    )
  }
  if (
    authenticated.actor.platformRoles.includes('PLATFORM_SUPERADMIN') &&
    !hasMfaAssurance(authenticated, maxAgeSeconds)
  ) {
    throw forbidden('This action requires recent two-factor verification.', ErrorCode.MFA_REQUIRED)
  }
  return authenticated
}
