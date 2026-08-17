import { AuditAction, type AuditWriter } from '../../shared/audit'
import type { AccessContext } from '../../shared/authorization'
import { authorize, Permission } from '../../shared/authorization'
import type { TenantTransactionRunner } from '../../shared/database'
import { badRequest, conflict, ErrorCode, forbidden, notFound } from '../../shared/errors'
import { isConfirmedMediaBinding, type MediaRepository } from '../media/media.repository'
import type { MembershipsRepository } from '../memberships/memberships.repository'
import type {
  OrganizationRow,
  OrganizationSettingsRow,
  OrganizationsRepository,
} from './organizations.repository'

export interface ProfilePatch {
  name?: string
  description?: string
  websiteUrl?: string | null
  country?: string | null
  region?: string | null
  logoAssetId?: string | null
}

export interface SettingsPatch {
  visibility?: 'PRIVATE' | 'PUBLIC'
  joinPolicy?: 'INVITE_ONLY' | 'CODE_OR_INVITE' | 'REQUEST_TO_JOIN'
  allowedEmailDomains?: string[]
  memberDirectoryVisibleToMembers?: boolean
  publicProjectGalleryEnabled?: boolean
  publicMetricsEnabled?: boolean
  publicContactEmail?: string | null
}

export interface OrganizationsService {
  get(access: AccessContext, organizationId: string): Promise<OrganizationRow>
  getSettings(access: AccessContext, organizationId: string): Promise<OrganizationSettingsRow>
  updateProfile(
    access: AccessContext,
    organizationId: string,
    patch: ProfilePatch,
  ): Promise<OrganizationRow>
  updateSettings(
    access: AccessContext,
    organizationId: string,
    patch: SettingsPatch,
  ): Promise<OrganizationSettingsRow>
  transferOwnership(
    access: AccessContext,
    organizationId: string,
    newOwnerUserId: string,
    reason: string,
  ): Promise<void>
  archive(access: AccessContext, organizationId: string, reason: string): Promise<void>
}

const FRESH_SESSION_MAX_AGE_SECONDS = 900

export function createOrganizationsService(
  repository: OrganizationsRepository,
  membershipsRepository: MembershipsRepository,
  mediaRepository: MediaRepository,
  transactions: TenantTransactionRunner,
  audit: AuditWriter,
): OrganizationsService {
  return {
    async get(access, organizationId) {
      authorize(access, Permission.OrganizationViewPrivate)
      const organization = await transactions.withTenant(organizationId, (tx) =>
        repository.findById(tx, organizationId),
      )
      if (organization === null) throw notFound('Organization not found.')
      return organization
    },

    async getSettings(access, organizationId) {
      authorize(access, Permission.OrganizationViewPrivate)
      const settings = await transactions.withTenant(organizationId, (tx) =>
        repository.getSettings(tx, organizationId),
      )
      if (settings === null) throw notFound('Organization not found.')
      return settings
    },

    async updateProfile(access, organizationId, patch) {
      authorize(access, Permission.OrganizationManageProfile)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await repository.findById(tx, organizationId)
          if (before === null) throw notFound('Organization not found.')

          if (patch.logoAssetId !== undefined && patch.logoAssetId !== null) {
            const asset = await mediaRepository.findById(tx, patch.logoAssetId)
            if (
              !isConfirmedMediaBinding(asset, {
                purpose: 'ORGANIZATION_LOGO',
                organizationId,
                challengeId: null,
                resourceType: 'organization',
                resourceId: organizationId,
              })
            ) {
              throw badRequest(
                'The logo is not a confirmed upload authorized for this organization.',
              )
            }
          }

          await repository.updateProfile(tx, organizationId, patch)

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.OrganizationProfileUpdated,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: 'Updated organization profile.',
            changes: { before: pick(before, Object.keys(patch)), after: patch },
          })

          const after = await repository.findById(tx, organizationId)
          if (after === null) throw notFound('Organization not found.')
          return after
        },
        { actorUserId: access.actor?.userId },
      )
    },

    async updateSettings(access, organizationId, patch) {
      authorize(access, Permission.OrganizationManageSettings)

      return transactions.withTenant(
        organizationId,
        async (tx) => {
          const before = await repository.getSettings(tx, organizationId)
          const beforeOrg = await repository.findById(tx, organizationId)
          if (before === null || beforeOrg === null) throw notFound('Organization not found.')

          const { visibility, ...settingsPatch } = patch

          if (Object.keys(settingsPatch).length > 0) {
            await repository.updateSettings(tx, organizationId, settingsPatch)
            await audit.write(tx, {
              organizationId,
              actorType: 'USER',
              actorUserId: access.actor?.userId,
              action:
                settingsPatch.joinPolicy !== undefined
                  ? AuditAction.OrganizationJoinPolicyChanged
                  : AuditAction.OrganizationSettingsUpdated,
              resourceType: 'organization_settings',
              resourceId: organizationId,
              summary: 'Updated organization settings.',
              changes: { before: pick(before, Object.keys(settingsPatch)), after: settingsPatch },
            })
          }

          if (visibility !== undefined && visibility !== beforeOrg.visibility) {
            await repository.updateVisibility(tx, organizationId, visibility)
            await audit.write(tx, {
              organizationId,
              actorType: 'USER',
              actorUserId: access.actor?.userId,
              action: AuditAction.OrganizationVisibilityChanged,
              resourceType: 'organization',
              resourceId: organizationId,
              summary: `Changed organization visibility from ${beforeOrg.visibility} to ${visibility}.`,
              changes: { before: { visibility: beforeOrg.visibility }, after: { visibility } },
            })
          }

          const after = await repository.getSettings(tx, organizationId)
          if (after === null) throw notFound('Organization not found.')
          return after
        },
        { actorUserId: access.actor?.userId },
      )
    },

    async transferOwnership(access, organizationId, newOwnerUserId, reason) {
      authorize(access, Permission.OrganizationTransferOwnership, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
      })

      const currentOwnerId = access.actor?.userId
      if (currentOwnerId === undefined) throw forbidden()

      if (newOwnerUserId === currentOwnerId) {
        throw conflict(ErrorCode.CONFLICT, 'You already own this organization.')
      }

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const target = await membershipsRepository.find(tx, organizationId, newOwnerUserId)
          if (target === null || target.status !== 'ACTIVE') {
            throw notFound('The target user is not an active member of this organization.')
          }

          // Order matters: promote the new owner first, so the organization
          // never has zero owners even for an instant within the transaction.
          await membershipsRepository.updateRole(tx, organizationId, newOwnerUserId, 'ORG_OWNER')
          await membershipsRepository.updateRole(tx, organizationId, currentOwnerId, 'ORG_ADMIN')

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: currentOwnerId,
            action: AuditAction.OwnershipTransferred,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: `Transferred ownership to ${newOwnerUserId}.`,
            reason,
            changes: { before: { owner: currentOwnerId }, after: { owner: newOwnerUserId } },
          })
        },
        { actorUserId: currentOwnerId },
      )
    },

    async archive(access, organizationId, reason) {
      authorize(access, Permission.OrganizationArchive, {
        requireFreshSession: true,
        freshSessionMaxAgeSeconds: FRESH_SESSION_MAX_AGE_SECONDS,
        allowArchivedOrganization: true,
      })

      await transactions.withTenant(
        organizationId,
        async (tx) => {
          const organization = await repository.findById(tx, organizationId)
          if (organization === null) throw notFound('Organization not found.')
          if (organization.status === 'ARCHIVED') {
            throw conflict(
              ErrorCode.ORGANIZATION_ARCHIVED,
              'This organization is already archived.',
            )
          }

          await repository.setStatus(tx, organizationId, 'ARCHIVED', {})

          await audit.write(tx, {
            organizationId,
            actorType: 'USER',
            actorUserId: access.actor?.userId,
            action: AuditAction.OrganizationArchived,
            resourceType: 'organization',
            resourceId: organizationId,
            summary: 'Archived the organization.',
            reason,
          })
        },
        { actorUserId: access.actor?.userId },
      )
    },
  }
}

function pick<T extends object>(source: T, keys: string[]): Partial<T> {
  const result: Partial<T> = {}
  for (const key of keys) {
    if (key in source) {
      ;(result as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key]
    }
  }
  return result
}
