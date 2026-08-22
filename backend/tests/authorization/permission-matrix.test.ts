import { describe, expect, test } from 'bun:test'
import type { OrganizationRole } from '../../src/generated/prisma/enums'
import type { AccessContext } from '../../src/shared/authorization'
import {
  ALL_PERMISSIONS,
  authorize,
  canAssignRole,
  checkPermission,
  ORGANIZATION_ROLE_PERMISSIONS,
  Permission,
  PLATFORM_ROLE_PERMISSIONS,
} from '../../src/shared/authorization'

/**
 * The authorization policy, exercised exhaustively.
 *
 * Every sensitive capability is checked from four directions: the role that
 * should hold it, a lower role that must not, an unrelated organization's
 * member who must not, and an anonymous caller who must not. Cross-tenant
 * escape is release-blocking (master prompt sections 41.3 and 54).
 */

const ORG_A = '01930000-0000-7000-8000-00000000d001'
const ORG_B = '01930000-0000-7000-8000-00000000d002'

function actor(
  overrides: Partial<AccessContext['actor']> = {},
): NonNullable<AccessContext['actor']> {
  return {
    userId: '01930000-0000-7000-8000-00000000e001',
    sessionId: '01930000-0000-7000-8000-00000000e002',
    email: 'member@example.org',
    emailVerified: true,
    platformRoles: [],
    sessionCreatedAt: new Date(),
    twoFactorEnabled: false,
    mfaVerifiedAt: null,
    authenticationMethod: 'password',
    ...overrides,
  }
}

function contextFor(
  role: OrganizationRole | null,
  overrides: Partial<AccessContext> = {},
): AccessContext {
  return {
    actor: actor(),
    organization: {
      organizationId: ORG_A,
      organizationStatus: 'ACTIVE',
      role,
      membershipStatus: role === null ? null : 'ACTIVE',
    },
    ...overrides,
  }
}

const ANONYMOUS: AccessContext = { actor: null }

describe('deny by default', () => {
  test('an anonymous caller holds no permission at all', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(checkPermission(ANONYMOUS, permission).allowed).toBe(false)
    }
  })

  test('an authenticated non-member holds no organization permission', () => {
    const context = contextFor(null)
    for (const permission of ORGANIZATION_ROLE_PERMISSIONS.ORG_OWNER) {
      expect(checkPermission(context, permission).allowed).toBe(false)
    }
  })

  test('every permission is reachable by some role', () => {
    // A permission no role can hold is dead code that will eventually be
    // "fixed" by granting it too broadly.
    const granted = new Set<string>([
      ...Object.values(ORGANIZATION_ROLE_PERMISSIONS).flat(),
      ...Object.values(PLATFORM_ROLE_PERMISSIONS).flat(),
      Permission.JudgingViewAssigned,
      Permission.JudgingScoreAssigned,
      Permission.MentoringViewAssigned,
    ])

    const unreachable = ALL_PERMISSIONS.filter((permission) => !granted.has(permission))
    expect(unreachable).toEqual([])
  })
})

describe('organization role escalation', () => {
  const escalationCases: { permission: Permission; allowed: OrganizationRole[] }[] = [
    { permission: Permission.OrganizationTransferOwnership, allowed: ['ORG_OWNER'] },
    { permission: Permission.OrganizationArchive, allowed: ['ORG_OWNER'] },
    { permission: Permission.OrganizationManageRoles, allowed: ['ORG_OWNER', 'ORG_ADMIN'] },
    { permission: Permission.OrganizationManageMembers, allowed: ['ORG_OWNER', 'ORG_ADMIN'] },
    { permission: Permission.OrganizationManageIntegrations, allowed: ['ORG_OWNER', 'ORG_ADMIN'] },
    { permission: Permission.OrganizationViewAudit, allowed: ['ORG_OWNER', 'ORG_ADMIN'] },
    { permission: Permission.AnalyticsExportSensitive, allowed: ['ORG_OWNER', 'ORG_ADMIN'] },
    {
      permission: Permission.ChallengePublish,
      allowed: ['ORG_OWNER', 'ORG_ADMIN', 'CHALLENGE_MANAGER'],
    },
    {
      permission: Permission.ChallengeChangeSchedule,
      allowed: ['ORG_OWNER', 'ORG_ADMIN', 'CHALLENGE_MANAGER'],
    },
    {
      permission: Permission.JudgingFinalize,
      allowed: ['ORG_OWNER', 'ORG_ADMIN', 'CHALLENGE_MANAGER'],
    },
    {
      permission: Permission.SubmissionViewAll,
      allowed: ['ORG_OWNER', 'ORG_ADMIN', 'CHALLENGE_MANAGER'],
    },
  ]

  const ALL_ROLES: OrganizationRole[] = ['ORG_OWNER', 'ORG_ADMIN', 'CHALLENGE_MANAGER', 'MEMBER']

  for (const { permission, allowed } of escalationCases) {
    test(`${permission} is held by exactly ${allowed.join(', ')}`, () => {
      for (const role of ALL_ROLES) {
        const expected = allowed.includes(role)
        expect(checkPermission(contextFor(role), permission).allowed).toBe(expected)
      }
    })
  }

  test('an ordinary member cannot manage members or roles', () => {
    // The single most valuable escalation to attempt.
    const member = contextFor('MEMBER')
    expect(checkPermission(member, Permission.OrganizationManageMembers).allowed).toBe(false)
    expect(checkPermission(member, Permission.OrganizationManageRoles).allowed).toBe(false)
    expect(checkPermission(member, Permission.OrganizationManageJoinCodes).allowed).toBe(false)
  })

  test('a challenge manager cannot govern the organization', () => {
    const manager = contextFor('CHALLENGE_MANAGER')
    expect(checkPermission(manager, Permission.OrganizationManageMembers).allowed).toBe(false)
    expect(checkPermission(manager, Permission.OrganizationManageIntegrations).allowed).toBe(false)
    expect(checkPermission(manager, Permission.OrganizationViewAudit).allowed).toBe(false)
    // ...but does run challenges.
    expect(checkPermission(manager, Permission.ChallengePublish).allowed).toBe(true)
  })
})

describe('role assignment ceiling', () => {
  test('a role holder can never grant a role above their own', () => {
    // Otherwise an admin could promote a second account to owner and take the
    // organization.
    expect(canAssignRole('ORG_ADMIN', 'ORG_OWNER')).toBe(false)
    expect(canAssignRole('CHALLENGE_MANAGER', 'ORG_ADMIN')).toBe(false)
    expect(canAssignRole('MEMBER', 'CHALLENGE_MANAGER')).toBe(false)
  })

  test('a role holder can grant their own role and below', () => {
    expect(canAssignRole('ORG_OWNER', 'ORG_OWNER')).toBe(true)
    expect(canAssignRole('ORG_ADMIN', 'ORG_ADMIN')).toBe(true)
    expect(canAssignRole('ORG_ADMIN', 'CHALLENGE_MANAGER')).toBe(true)
    expect(canAssignRole('CHALLENGE_MANAGER', 'MEMBER')).toBe(true)
  })
})

describe('cross-tenant isolation', () => {
  test('an owner of one organization holds nothing in another', () => {
    // The resolver populates the context for the organization named in the
    // ROUTE. An owner of ORG_B arriving at an ORG_A route resolves to no
    // membership, so every organization permission is denied.
    const ownerOfB: AccessContext = {
      actor: actor({ userId: 'owner-of-b' }),
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'ACTIVE',
        role: null,
        membershipStatus: null,
      },
    }

    for (const permission of ORGANIZATION_ROLE_PERMISSIONS.ORG_OWNER) {
      expect(checkPermission(ownerOfB, permission).allowed).toBe(false)
    }
    expect(ORG_B).not.toBe(ORG_A)
  })

  test('an inactive membership grants nothing', () => {
    // A removed member whose row is retained for history must not retain access.
    const removed: AccessContext = {
      actor: actor(),
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'ACTIVE',
        role: 'ORG_ADMIN',
        membershipStatus: 'INACTIVE',
      },
    }

    expect(checkPermission(removed, Permission.OrganizationManageMembers).allowed).toBe(false)
    expect(checkPermission(removed, Permission.ChallengeView).allowed).toBe(false)
  })
})

describe('organization status gating', () => {
  test('a suspended organization blocks even its owner', () => {
    // Suspension exists to stop the organization operating; an owner override
    // would make it meaningless.
    const suspended: AccessContext = {
      actor: actor(),
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'SUSPENDED',
        role: 'ORG_OWNER',
        membershipStatus: 'ACTIVE',
      },
    }

    expect(checkPermission(suspended, Permission.ChallengePublish).allowed).toBe(false)
    expect(checkPermission(suspended, Permission.OrganizationManageMembers).allowed).toBe(false)
    expect(() => authorize(suspended, Permission.ChallengePublish)).toThrow(/suspended/i)
  })

  test('a suspended organization still permits explicitly allowed read paths', () => {
    const suspended: AccessContext = {
      actor: actor(),
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'SUSPENDED',
        role: 'ORG_OWNER',
        membershipStatus: 'ACTIVE',
      },
    }

    expect(
      checkPermission(suspended, Permission.OrganizationViewPrivate, {
        allowSuspendedOrganization: true,
      }).allowed,
    ).toBe(true)
  })

  test('an archived organization blocks writes', () => {
    const archived: AccessContext = {
      actor: actor(),
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'ARCHIVED',
        role: 'ORG_OWNER',
        membershipStatus: 'ACTIVE',
      },
    }

    expect(checkPermission(archived, Permission.ChallengeCreate).allowed).toBe(false)
  })
})

describe('platform roles', () => {
  const superadmin: AccessContext = {
    actor: actor({
      platformRoles: ['PLATFORM_SUPERADMIN'],
      twoFactorEnabled: true,
      mfaVerifiedAt: new Date(),
      authenticationMethod: 'mfa',
    }),
  }

  test('hold platform permissions', () => {
    expect(checkPermission(superadmin, Permission.PlatformReviewApplications).allowed).toBe(true)
    expect(checkPermission(superadmin, Permission.PlatformManageOrganizations).allowed).toBe(true)
  })

  test('do NOT confer ordinary organization membership', () => {
    // A superadmin is not an implicit member of every organization. Reaching
    // tenant data requires an explicit, audited platform route.
    const inTenant: AccessContext = {
      ...superadmin,
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'ACTIVE',
        role: null,
        membershipStatus: null,
      },
    }

    expect(checkPermission(inTenant, Permission.ChallengePublish).allowed).toBe(false)
    expect(checkPermission(inTenant, Permission.SubmissionViewAll).allowed).toBe(false)
    expect(checkPermission(inTenant, Permission.OrganizationManageMembers).allowed).toBe(false)
  })

  test('a support agent holds strictly less than a superadmin', () => {
    const support: AccessContext = { actor: actor({ platformRoles: ['PLATFORM_SUPPORT_AGENT'] }) }

    expect(checkPermission(support, Permission.PlatformSupport).allowed).toBe(true)
    expect(checkPermission(support, Permission.PlatformManageOrganizations).allowed).toBe(false)
    expect(checkPermission(support, Permission.PlatformManageRoles).allowed).toBe(false)
    expect(checkPermission(support, Permission.PlatformManageFeatureFlags).allowed).toBe(false)
  })
})

describe('challenge-scoped staff', () => {
  const judgeContext: AccessContext = {
    actor: actor({ userId: 'external-judge' }),
    organization: {
      organizationId: ORG_A,
      organizationStatus: 'ACTIVE',
      // An external judge holds NO organization membership by design.
      role: null,
      membershipStatus: null,
    },
    challenge: {
      challengeId: '01930000-0000-7000-8000-00000000f001',
      organizationId: ORG_A,
      staffRole: 'JUDGE',
      isApprovedParticipant: false,
    },
  }

  test('a judge can view and score assigned work', () => {
    expect(checkPermission(judgeContext, Permission.JudgingViewAssigned).allowed).toBe(true)
    expect(checkPermission(judgeContext, Permission.JudgingScoreAssigned).allowed).toBe(true)
  })

  test('a judge can view the challenge and its rubric to know what they are scoring against', () => {
    // Without challenge.view a judge could never fetch rubric criteria
    // through any real endpoint, making it impossible to render a scoring
    // form at all.
    expect(checkPermission(judgeContext, Permission.ChallengeView).allowed).toBe(true)
  })

  test('a judge gains no organization access whatsoever', () => {
    // The whole point of challenge-scoped staff: a sponsor's judge must not
    // gain the member directory, other challenges, analytics, or the audit log.
    expect(checkPermission(judgeContext, Permission.OrganizationViewPrivate).allowed).toBe(false)
    expect(checkPermission(judgeContext, Permission.OrganizationManageMembers).allowed).toBe(false)
    expect(checkPermission(judgeContext, Permission.SubmissionViewAll).allowed).toBe(false)
    expect(checkPermission(judgeContext, Permission.AnalyticsViewOrg).allowed).toBe(false)
    expect(checkPermission(judgeContext, Permission.OrganizationViewAudit).allowed).toBe(false)
  })

  test('a judge cannot finalize judging or publish results', () => {
    expect(checkPermission(judgeContext, Permission.JudgingFinalize).allowed).toBe(false)
    expect(checkPermission(judgeContext, Permission.ChallengePublishResults).allowed).toBe(false)
    expect(checkPermission(judgeContext, Permission.JudgingReopenScorecard).allowed).toBe(false)
  })

  test('a mentor cannot score', () => {
    const mentor: AccessContext = {
      ...judgeContext,
      challenge: {
        challengeId: '01930000-0000-7000-8000-00000000f001',
        organizationId: ORG_A,
        staffRole: 'MENTOR',
        isApprovedParticipant: false,
      },
    }

    expect(checkPermission(mentor, Permission.MentoringViewAssigned).allowed).toBe(true)
    expect(checkPermission(mentor, Permission.JudgingScoreAssigned).allowed).toBe(false)
    expect(checkPermission(mentor, Permission.JudgingViewAssigned).allowed).toBe(false)
  })
})

describe('sensitive operation gating', () => {
  test('requires a recently authenticated session', () => {
    const stale: AccessContext = {
      actor: actor({
        // A long-lived session found on an unattended machine must not be
        // enough to transfer ownership.
        sessionCreatedAt: new Date(Date.now() - 3 * 3600 * 1000),
      }),
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'ACTIVE',
        role: 'ORG_OWNER',
        membershipStatus: 'ACTIVE',
      },
    }

    expect(
      checkPermission(stale, Permission.OrganizationTransferOwnership, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: 900,
      }).allowed,
    ).toBe(false)

    expect(() =>
      authorize(stale, Permission.OrganizationTransferOwnership, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: 900,
      }),
    ).toThrow(/recent sign-in/i)
  })

  test('accepts a fresh session', () => {
    const fresh = contextFor('ORG_OWNER')
    expect(
      checkPermission(fresh, Permission.OrganizationTransferOwnership, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: 900,
      }).allowed,
    ).toBe(true)
  })

  test('a superadmin without MFA cannot perform a sensitive operation', () => {
    const noMfa: AccessContext = {
      actor: actor({ platformRoles: ['PLATFORM_SUPERADMIN'], twoFactorEnabled: false }),
    }

    expect(
      checkPermission(noMfa, Permission.PlatformManageOrganizations, {
        requireFreshSession: true,
      }).allowed,
    ).toBe(false)

    expect(() =>
      authorize(noMfa, Permission.PlatformManageOrganizations, { requireFreshSession: true }),
    ).toThrow(/two-factor/i)
  })

  test('MFA enrollment without session assurance grants no platform permission', () => {
    const enrolledOnly: AccessContext = {
      actor: actor({
        platformRoles: ['PLATFORM_SUPERADMIN'],
        twoFactorEnabled: true,
        mfaVerifiedAt: null,
        authenticationMethod: 'oauth',
      }),
    }

    expect(checkPermission(enrolledOnly, Permission.PlatformManageOrganizations).allowed).toBe(
      false,
    )
    expect(() => authorize(enrolledOnly, Permission.PlatformManageOrganizations)).toThrow(
      /two-factor/i,
    )
  })

  test('sensitive platform operations reject stale MFA assurance', () => {
    const staleMfa: AccessContext = {
      actor: actor({
        platformRoles: ['PLATFORM_SUPERADMIN'],
        twoFactorEnabled: true,
        mfaVerifiedAt: new Date(Date.now() - 901_000),
        authenticationMethod: 'mfa',
      }),
    }

    expect(
      checkPermission(staleMfa, Permission.PlatformManageOrganizations, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: 900,
      }).allowed,
    ).toBe(false)
  })

  test('a superadmin with MFA can', () => {
    const withMfa: AccessContext = {
      actor: actor({
        platformRoles: ['PLATFORM_SUPERADMIN'],
        twoFactorEnabled: true,
        mfaVerifiedAt: new Date(),
        authenticationMethod: 'mfa',
      }),
    }

    expect(
      checkPermission(withMfa, Permission.PlatformManageOrganizations, {
        requireFreshSession: true,
      }).allowed,
    ).toBe(true)
  })
})

describe('email verification gating', () => {
  test('an unverified email blocks membership-granting actions', () => {
    const unverified: AccessContext = {
      actor: actor({ emailVerified: false }),
      organization: {
        organizationId: ORG_A,
        organizationStatus: 'ACTIVE',
        role: 'ORG_ADMIN',
        membershipStatus: 'ACTIVE',
      },
    }

    expect(
      checkPermission(unverified, Permission.OrganizationManageInvitations, {
        requireVerifiedEmail: true,
      }).allowed,
    ).toBe(false)

    // The same action is permitted once the address is verified.
    expect(
      checkPermission(contextFor('ORG_ADMIN'), Permission.OrganizationManageInvitations, {
        requireVerifiedEmail: true,
      }).allowed,
    ).toBe(true)
  })
})
