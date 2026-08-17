import { t } from 'elysia'
import { Uuid } from '../../shared/http'

export const CreateJoinCodeBody = t.Object({
  label: t.Optional(t.String({ maxLength: 120 })),
  expiresInDays: t.Optional(t.Integer({ minimum: 1, maximum: 365 })),
  maxUses: t.Optional(t.Integer({ minimum: 1, maximum: 100_000 })),
  allowedEmailDomains: t.Optional(t.Array(t.String({ maxLength: 253 }), { maxItems: 20 })),
})

/** Never includes the code hash. The plaintext appears only in CreatedJoinCodeResponse, once. */
export const JoinCodeResponse = t.Object({
  id: Uuid,
  label: t.Union([t.String(), t.Null()]),
  role: t.Literal('MEMBER'),
  expiresAt: t.String(),
  maxUses: t.Union([t.Integer(), t.Null()]),
  useCount: t.Integer(),
  allowedEmailDomains: t.Array(t.String()),
  revoked: t.Boolean(),
  createdAt: t.String(),
})

export const CreatedJoinCodeResponse = t.Composite([
  JoinCodeResponse,
  t.Object({
    plaintextCode: t.String({ description: 'Shown exactly once. It cannot be retrieved again.' }),
  }),
])

export const JoinCodeListResponse = t.Array(JoinCodeResponse)

export const RedeemJoinCodeBody = t.Object({
  code: t.String({ minLength: 6, maxLength: 32 }),
})
