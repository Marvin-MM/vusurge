import { Elysia, t } from 'elysia'
import type { AuthPlugin } from '../../shared/auth'
import { CommonErrorResponses, Uuid } from '../../shared/http'
import type { OrganizationsController } from './organizations.controller'
import {
  ArchiveOrganizationBody,
  OrganizationResponse,
  OrganizationSettingsResponse,
  TransferOwnershipBody,
  UpdateProfileBody,
  UpdateSettingsBody,
} from './organizations.dto'

export function organizationsRoutes(controller: OrganizationsController, auth: AuthPlugin) {
  return new Elysia({ name: 'organizations-routes' })
    .use(auth)
    .get(
      '/organizations/:organizationId',
      ({ access, params }) => controller.get(access, params.organizationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: OrganizationResponse, ...CommonErrorResponses },
        detail: { tags: ['Organizations'], summary: 'Get an organization' },
      },
    )
    .get(
      '/organizations/:organizationId/settings',
      ({ access, params }) => controller.getSettings(access, params.organizationId),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        response: { 200: OrganizationSettingsResponse, ...CommonErrorResponses },
        detail: { tags: ['Organizations'], summary: 'Get organization settings' },
      },
    )
    .patch(
      '/organizations/:organizationId/profile',
      ({ access, params, body }) => controller.updateProfile(access, params.organizationId, body),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: UpdateProfileBody,
        response: { 200: OrganizationResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Organizations'],
          summary: 'Update organization profile',
          description:
            'Descriptive/configuration fields only. Platform lifecycle state, ownership, and ' +
            'other security-sensitive fields never change through this endpoint.',
        },
      },
    )
    .patch(
      '/organizations/:organizationId/settings',
      ({ access, params, body }) => controller.updateSettings(access, params.organizationId, body),
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: UpdateSettingsBody,
        response: { 200: OrganizationSettingsResponse, ...CommonErrorResponses },
        detail: {
          tags: ['Organizations'],
          summary: 'Update organization settings',
          description: 'The OPEN join policy is reserved and cannot be activated through this API.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/transfer-ownership',
      async ({ access, params, body, set }) => {
        await controller.transferOwnership(
          access,
          params.organizationId,
          body.newOwnerUserId,
          body.reason,
        )
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: TransferOwnershipBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Organizations'],
          summary: 'Transfer ownership',
          description:
            'Requires a fresh session. The current owner becomes an admin, not a plain member.',
        },
      },
    )
    .post(
      '/organizations/:organizationId/archive',
      async ({ access, params, body, set }) => {
        await controller.archive(access, params.organizationId, body.reason)
        set.status = 204
      },
      {
        requireAuth: true,
        orgContext: true,
        params: t.Object({ organizationId: Uuid }),
        body: ArchiveOrganizationBody,
        response: { 204: t.Void(), ...CommonErrorResponses },
        detail: {
          tags: ['Organizations'],
          summary: 'Archive the organization',
          description: 'Requires a fresh session.',
        },
      },
    )
}
