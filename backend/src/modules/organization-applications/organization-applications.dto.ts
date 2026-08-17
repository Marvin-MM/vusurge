import { t } from 'elysia'
import {
  ActionReason,
  HttpsUrl,
  MarkdownText,
  PageOf,
  PaginationQuery,
  Slug,
  Uuid,
} from '../../shared/http'

/**
 * Organization application contracts (master prompt sections 8, 34.5).
 *
 * Internal notes are a platform-only field and never appear in any of these
 * schemas — the applicant-facing and platform-facing response shapes are
 * separate types, not one type with a field conditionally hidden.
 */

export const ApplicationStatus = t.Union([
  t.Literal('PENDING_REVIEW'),
  t.Literal('APPROVED'),
  t.Literal('REJECTED'),
  t.Literal('WITHDRAWN'),
])

const SocialLinks = t.Optional(t.Array(HttpsUrl, { maxItems: 10 }))

export const CreateApplicationBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 200 }),
  requestedSlug: Slug,
  organizationType: t.String({ minLength: 2, maxLength: 60 }),
  description: MarkdownText(4000),
  websiteUrl: t.Optional(HttpsUrl),
  socialLinks: SocialLinks,
  country: t.Optional(t.String({ maxLength: 80 })),
  region: t.Optional(t.String({ maxLength: 120 })),
  affiliatedInstitution: t.Optional(t.String({ maxLength: 200 })),
  requesterRelationship: t.String({ minLength: 2, maxLength: 200 }),
  requestedVisibility: t.Union([t.Literal('PRIVATE'), t.Literal('PUBLIC')]),
  acceptedTermsVersion: t.String({ minLength: 1, maxLength: 40 }),
})

export const UpdateApplicationBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
  requestedSlug: t.Optional(Slug),
  organizationType: t.Optional(t.String({ minLength: 2, maxLength: 60 })),
  description: t.Optional(MarkdownText(4000)),
  websiteUrl: t.Optional(HttpsUrl),
  socialLinks: SocialLinks,
  country: t.Optional(t.String({ maxLength: 80 })),
  region: t.Optional(t.String({ maxLength: 120 })),
  affiliatedInstitution: t.Optional(t.String({ maxLength: 200 })),
  requesterRelationship: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
  requestedVisibility: t.Optional(t.Union([t.Literal('PRIVATE'), t.Literal('PUBLIC')])),
})

export const ApplicationResponse = t.Object({
  id: Uuid,
  name: t.String(),
  requestedSlug: t.String(),
  organizationType: t.String(),
  description: t.String(),
  websiteUrl: t.Union([t.String(), t.Null()]),
  country: t.Union([t.String(), t.Null()]),
  region: t.Union([t.String(), t.Null()]),
  affiliatedInstitution: t.Union([t.String(), t.Null()]),
  requesterRelationship: t.String(),
  requestedVisibility: t.Union([t.Literal('PRIVATE'), t.Literal('PUBLIC')]),
  status: ApplicationStatus,
  submittedAt: t.Union([t.String(), t.Null()]),
  reviewedAt: t.Union([t.String(), t.Null()]),
  decisionReason: t.Union([t.String(), t.Null()]),
  createdOrganizationId: t.Union([Uuid, t.Null()]),
  createdAt: t.String(),
})

export const ApplicationListResponse = PageOf(ApplicationResponse)

export const ApplicationListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(ApplicationStatus) }),
])

export const ApproveApplicationBody = t.Object({
  notes: t.Optional(t.String({ maxLength: 2000 })),
})

export const RejectApplicationBody = t.Object({
  reason: ActionReason,
  internalNotes: t.Optional(t.String({ maxLength: 4000 })),
})

export const IdempotencyKeyHeader = t.Object({
  'idempotency-key': t.String({ minLength: 8, maxLength: 255 }),
})
