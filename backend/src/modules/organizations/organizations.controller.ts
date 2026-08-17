import type { AccessContext } from '../../shared/authorization'
import { requireActor } from '../../shared/authorization'
import type { OrganizationRow, OrganizationSettingsRow } from './organizations.repository'
import type { OrganizationsService, ProfilePatch, SettingsPatch } from './organizations.service'

function serializeOrg(row: OrganizationRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    organizationType: row.organizationType,
    websiteUrl: row.websiteUrl,
    country: row.country,
    region: row.region,
    logoAssetId: row.logoAssetId,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeSettings(row: OrganizationSettingsRow) {
  return {
    joinPolicy: row.joinPolicy,
    allowedEmailDomains: row.allowedEmailDomains,
    memberDirectoryVisibleToMembers: row.memberDirectoryVisibleToMembers,
    publicProjectGalleryEnabled: row.publicProjectGalleryEnabled,
    publicMetricsEnabled: row.publicMetricsEnabled,
    publicContactEmail: row.publicContactEmail,
  }
}

export function createOrganizationsController(service: OrganizationsService) {
  return {
    async get(access: AccessContext, organizationId: string) {
      requireActor(access)
      const row = await service.get(access, organizationId)
      return serializeOrg(row)
    },

    async getSettings(access: AccessContext, organizationId: string) {
      requireActor(access)
      const row = await service.getSettings(access, organizationId)
      return serializeSettings(row)
    },

    async updateProfile(access: AccessContext, organizationId: string, patch: ProfilePatch) {
      requireActor(access)
      const row = await service.updateProfile(access, organizationId, patch)
      return serializeOrg(row)
    },

    async updateSettings(access: AccessContext, organizationId: string, patch: SettingsPatch) {
      requireActor(access)
      const row = await service.updateSettings(access, organizationId, patch)
      return serializeSettings(row)
    },

    async transferOwnership(
      access: AccessContext,
      organizationId: string,
      newOwnerUserId: string,
      reason: string,
    ) {
      requireActor(access)
      await service.transferOwnership(access, organizationId, newOwnerUserId, reason)
    },

    async archive(access: AccessContext, organizationId: string, reason: string) {
      requireActor(access)
      await service.archive(access, organizationId, reason)
    },
  }
}

export type OrganizationsController = ReturnType<typeof createOrganizationsController>
