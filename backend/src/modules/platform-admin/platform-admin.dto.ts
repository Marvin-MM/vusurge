import { t } from 'elysia'
import { ActionReason, PageOf, PaginationQuery, Uuid } from '../../shared/http'

const OrganizationStatus = t.Union([
  t.Literal('ACTIVE'),
  t.Literal('SUSPENDED'),
  t.Literal('ARCHIVED'),
])

export const PlatformOrganizationResponse = t.Object({
  id: Uuid,
  slug: t.String(),
  name: t.String(),
  organizationType: t.String(),
  status: OrganizationStatus,
  visibility: t.Union([t.Literal('PRIVATE'), t.Literal('PUBLIC')]),
  createdAt: t.String(),
})

export const PlatformOrganizationListResponse = PageOf(PlatformOrganizationResponse)
export const PlatformOrganizationListQuery = t.Composite([
  PaginationQuery,
  t.Object({ status: t.Optional(OrganizationStatus) }),
])

export const SuspendOrganizationBody = t.Object({ reason: ActionReason })
export const ReinstateOrganizationBody = t.Object({ reason: ActionReason })
export const PlatformArchiveOrganizationBody = t.Object({ reason: ActionReason })

export const AuditSummaryResponse = t.Object({
  totalEvents: t.Integer(),
  firstEventAt: t.Union([t.String(), t.Null()]),
  lastEventAt: t.Union([t.String(), t.Null()]),
  topActions: t.Array(t.Object({ action: t.String(), count: t.Integer() })),
})
