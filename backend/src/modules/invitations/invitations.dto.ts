import { t } from 'elysia'
import { EmailAddress, PageOf, PaginationQuery, Uuid } from '../../shared/http'

const OrgRoleSchema = t.Union([
  t.Literal('ORG_OWNER'),
  t.Literal('ORG_ADMIN'),
  t.Literal('CHALLENGE_MANAGER'),
  t.Literal('MEMBER'),
])

export const InvitationStatus = t.Union([
  t.Literal('PENDING'),
  t.Literal('ACCEPTED'),
  t.Literal('DECLINED'),
  t.Literal('REVOKED'),
  t.Literal('EXPIRED'),
])

export const CreateInvitationBody = t.Object({
  email: t.Optional(EmailAddress),
  role: OrgRoleSchema,
})

/** Never includes the token hash (master prompt section 34.8). */
export const InvitationResponse = t.Object({
  id: Uuid,
  email: t.Union([t.String(), t.Null()]),
  role: OrgRoleSchema,
  status: InvitationStatus,
  expiresAt: t.String(),
  createdAt: t.String(),
  acceptedAt: t.Union([t.String(), t.Null()]),
  revokedAt: t.Union([t.String(), t.Null()]),
  resendCount: t.Integer(),
})

export const InvitationListResponse = PageOf(InvitationResponse)
export const InvitationListQuery = PaginationQuery
