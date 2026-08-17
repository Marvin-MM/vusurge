import { t } from 'elysia'
import { PageOf, Uuid } from '../../shared/http'

export const AuditActorType = t.Union([
  t.Literal('USER'),
  t.Literal('SYSTEM'),
  t.Literal('PLATFORM_ADMIN'),
])

export const AuditEventResponse = t.Object({
  id: Uuid,
  organizationId: t.Union([Uuid, t.Null()]),
  actorType: AuditActorType,
  actorUserId: t.Union([Uuid, t.Null()]),
  action: t.String(),
  resourceType: t.String(),
  resourceId: t.Union([Uuid, t.Null()]),
  summary: t.String(),
  changes: t.Union([t.Unknown(), t.Null()]),
  reason: t.Union([t.String(), t.Null()]),
  requestId: t.Union([t.String(), t.Null()]),
  ipAddress: t.Union([t.String(), t.Null()]),
  userAgent: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const AuditEventListResponse = PageOf(AuditEventResponse)

export const PlatformAuditListQuery = t.Object({
  organizationId: t.Optional(Uuid),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
  cursor: t.Optional(t.String({ maxLength: 512 })),
})
