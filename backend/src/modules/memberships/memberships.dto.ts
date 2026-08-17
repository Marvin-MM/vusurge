import { t } from 'elysia'
import { PageOf, PaginationQuery, Uuid } from '../../shared/http'

export const OrgRoleSchema = t.Union([
  t.Literal('ORG_OWNER'),
  t.Literal('ORG_ADMIN'),
  t.Literal('CHALLENGE_MANAGER'),
  t.Literal('MEMBER'),
])

export const MembershipStatusSchema = t.Union([t.Literal('ACTIVE'), t.Literal('INACTIVE')])

export const MemberResponse = t.Object({
  userId: Uuid,
  displayName: t.Union([t.String(), t.Null()]),
  role: OrgRoleSchema,
  status: MembershipStatusSchema,
  joinedAt: t.String(),
  removedAt: t.Union([t.String(), t.Null()]),
})

export const MemberListResponse = PageOf(MemberResponse)

export const MemberListQuery = t.Composite([
  PaginationQuery,
  t.Object({
    role: t.Optional(OrgRoleSchema),
    status: t.Optional(MembershipStatusSchema),
  }),
])

export const ChangeRoleBody = t.Object({ role: OrgRoleSchema })
export const ReactivateBody = t.Object({ role: t.Optional(OrgRoleSchema) })
