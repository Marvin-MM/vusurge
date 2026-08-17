import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission, requireVerifiedActor } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { newId } from '../../shared/ids'
import { type RateLimiter, RateLimitPolicies } from '../../shared/rate-limit'
import { generateJoinCode, hashJoinCode, normalizeJoinCode } from '../../shared/security'
import { addDays } from '../../shared/time'
import type { MembershipsRepository } from '../memberships/memberships.repository'
import type { OrganizationsRepository } from '../organizations/organizations.repository'
import type { JoinCodeRow, JoinCodesRepository } from './join-codes.repository'

const DEFAULT_VALIDITY_DAYS = 30
const MAX_VALIDITY_DAYS = 365

export interface CreateJoinCodeInput {
  label?: string
  expiresInDays?: number
  maxUses?: number
  allowedEmailDomains?: string[]
}

export interface JoinCodesService {
  create(
    access: AccessContext,
    organizationId: string,
    input: CreateJoinCodeInput,
  ): Promise<{ code: JoinCodeRow; plaintextCode: string }>
  list(access: AccessContext, organizationId: string): Promise<JoinCodeRow[]>
  revoke(access: AccessContext, organizationId: string, id: string): Promise<void>
  redeem(
    access: AccessContext,
    code: string,
  ): Promise<{ organizationId: string; organizationSlug: string }>
}

export function createJoinCodesService(
  repository: JoinCodesRepository,
  organizationsRepository: OrganizationsRepository,
  membershipsRepository: MembershipsRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
  rateLimiter: RateLimiter,
): JoinCodesService {
  return {
    async create(access, organizationId, input) {
      authorize(access, Permission.OrganizationManageJoinCodes)

      const validityDays = Math.min(input.expiresInDays ?? DEFAULT_VALIDITY_DAYS, MAX_VALIDITY_DAYS)
      const plaintextCode = generateJoinCode()
      const codeHash = hashJoinCode(plaintextCode)

      const code = await transactions.withTenant(
        organizationId,
        async (tx) => {
          const now = await transactions.databaseNow(tx)
          const created = await repository.create(tx, {
            id: newId(),
            organizationId,
            codeHash,
            label: input.label,
            expiresAt: addDays(now, validityDays),
            maxUses: input.maxUses,
            allowedEmailDomains: input.allowedEmailDomains ?? [],
            createdByUserId: access.actor?.userId as string,
          })

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.JoinCodeCreated,
            resourceType: 'organization_join_code',
            resourceId: created.id,
            summary: 'Created an organization join code.',
          })

          return created
        },
        { actorUserId: access.actor?.userId },
      )

      // The plaintext is returned exactly once, here. No endpoint can ever
      // reveal it again — only the hash is stored (master prompt section 9.2).
      return { code, plaintextCode }
    },

    async list(access, organizationId) {
      authorize(access, Permission.OrganizationManageJoinCodes)
      return transactions.withTenant(organizationId, (tx) => repository.list(tx, organizationId))
    },

    async revoke(access, organizationId, id) {
      authorize(access, Permission.OrganizationManageJoinCodes)

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const revoked = await repository.revoke(tx, organizationId, id)
          if (!revoked) {
            throw conflict(ErrorCode.JOIN_CODE_INVALID, 'This join code cannot be revoked.')
          }
          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.JoinCodeRevoked,
            resourceType: 'organization_join_code',
            resourceId: id,
            summary: 'Revoked an organization join code.',
          })
        },
        { actorUserId: access.actor?.userId },
      )
    },

    async redeem(access, code) {
      const { actor } = requireVerifiedActor(access)
      // High-risk, fail-closed: this is the single most brute-forceable
      // surface in the product (master prompt sections 9.2, 36, 54).
      await rateLimiter.enforce(RateLimitPolicies.JoinCodeRedemption, {
        userId: actor.userId,
        ipAddress: access.ipAddress,
      })

      const codeHash = hashJoinCode(normalizeJoinCode(code))

      // One atomic guarded UPDATE — increments use_count only if the code is
      // still valid — run under secret-lookup access because the code's
      // organization is not known until this resolves. This is what makes
      // "usage cannot exceed max_uses under concurrent redemption" a property
      // of a single SQL statement rather than of transaction timing.
      const redeemed = await transactions.withSecretLookup((tx) => repository.redeem(tx, codeHash))

      if (redeemed === null) {
        throw notFound(
          'This join code is invalid, expired, revoked, or has reached its usage limit.',
        )
      }

      if (redeemed.allowedEmailDomains.length > 0) {
        const domain = actor.email.split('@')[1]?.toLowerCase()
        if (domain === undefined || !redeemed.allowedEmailDomains.includes(domain)) {
          throw forbidden(
            'Your email address is not eligible to redeem this join code.',
            ErrorCode.JOIN_CODE_DOMAIN_MISMATCH,
          )
        }
      }

      return transactions.withTenant(
        redeemed.organizationId,
        async (tx) => {
          const organization = await organizationsRepository.findById(tx, redeemed.organizationId)
          if (organization === null || organization.status !== 'ACTIVE') {
            throw conflict(
              ErrorCode.ORGANIZATION_SUSPENDED,
              'This organization is not currently active.',
            )
          }

          const existing = await membershipsRepository.find(
            tx,
            redeemed.organizationId,
            actor.userId,
          )
          if (existing !== null && existing.status === 'ACTIVE') {
            throw conflict(
              ErrorCode.ALREADY_A_MEMBER,
              'You are already a member of this organization.',
            )
          }

          if (existing !== null) {
            await membershipsRepository.reactivate(
              tx,
              redeemed.organizationId,
              actor.userId,
              redeemed.role,
              'JOIN_CODE',
            )
          } else {
            await membershipsRepository.create(tx, {
              id: newId(),
              organizationId: redeemed.organizationId,
              userId: actor.userId,
              role: redeemed.role,
              source: 'JOIN_CODE',
            })
          }

          await audit.write(tx, {
            organizationId: redeemed.organizationId,
            actorType: 'USER',
            actorUserId: actor.userId,
            action: AuditAction.JoinCodeRedeemed,
            resourceType: 'organization_join_code',
            resourceId: redeemed.id,
            summary: `Redeemed a join code and joined as ${redeemed.role}.`,
          })

          return { organizationId: organization.id, organizationSlug: organization.slug }
        },
        { actorUserId: actor.userId },
      )
    },
  }
}
