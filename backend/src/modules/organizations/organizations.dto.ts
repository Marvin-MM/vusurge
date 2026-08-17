import { t } from 'elysia'
import { ActionReason, HttpsUrl, MarkdownText, Uuid } from '../../shared/http'

const OrganizationStatus = t.Union([
  t.Literal('ACTIVE'),
  t.Literal('SUSPENDED'),
  t.Literal('ARCHIVED'),
])
const OrganizationVisibility = t.Union([t.Literal('PRIVATE'), t.Literal('PUBLIC')])
const JoinPolicy = t.Union([
  t.Literal('INVITE_ONLY'),
  t.Literal('CODE_OR_INVITE'),
  t.Literal('REQUEST_TO_JOIN'),
])

export const OrganizationResponse = t.Object({
  id: Uuid,
  slug: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  organizationType: t.String(),
  websiteUrl: t.Union([t.String(), t.Null()]),
  country: t.Union([t.String(), t.Null()]),
  region: t.Union([t.String(), t.Null()]),
  logoAssetId: t.Union([Uuid, t.Null()]),
  status: OrganizationStatus,
  visibility: OrganizationVisibility,
  createdAt: t.String(),
})

export const OrganizationSettingsResponse = t.Object({
  joinPolicy: JoinPolicy,
  allowedEmailDomains: t.Array(t.String()),
  memberDirectoryVisibleToMembers: t.Boolean(),
  publicProjectGalleryEnabled: t.Boolean(),
  publicMetricsEnabled: t.Boolean(),
  publicContactEmail: t.Union([t.String(), t.Null()]),
})

export const UpdateProfileBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
  description: t.Optional(MarkdownText(4000)),
  websiteUrl: t.Optional(t.Union([HttpsUrl, t.Null()])),
  country: t.Optional(t.Union([t.String({ maxLength: 80 }), t.Null()])),
  region: t.Optional(t.Union([t.String({ maxLength: 120 }), t.Null()])),
  logoAssetId: t.Optional(t.Union([Uuid, t.Null()])),
})

/**
 * Settings PATCH deliberately excludes platform lifecycle state, ownership,
 * and any other high-value security field (master prompt section 34.6): those
 * change only through their own explicit action endpoints.
 */
export const UpdateSettingsBody = t.Object({
  visibility: t.Optional(OrganizationVisibility),
  joinPolicy: t.Optional(JoinPolicy),
  allowedEmailDomains: t.Optional(t.Array(t.String({ maxLength: 253 }), { maxItems: 20 })),
  memberDirectoryVisibleToMembers: t.Optional(t.Boolean()),
  publicProjectGalleryEnabled: t.Optional(t.Boolean()),
  publicMetricsEnabled: t.Optional(t.Boolean()),
  publicContactEmail: t.Optional(t.Union([t.String({ format: 'email' }), t.Null()])),
})

export const TransferOwnershipBody = t.Object({
  newOwnerUserId: Uuid,
  reason: ActionReason,
})

export const ArchiveOrganizationBody = t.Object({
  reason: ActionReason,
})
