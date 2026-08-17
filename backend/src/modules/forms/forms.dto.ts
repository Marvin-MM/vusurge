import { t } from 'elysia'
import { PageOf, PaginationQuery, Uuid } from '../../shared/http'

const FormPurpose = t.Union([
  t.Literal('ORGANIZATION_JOIN_REQUEST'),
  t.Literal('CHALLENGE_PARTICIPATION'),
  t.Literal('MENTOR_JUDGE_APPLICATION'),
  t.Literal('POST_EVENT_SURVEY'),
  t.Literal('PORTFOLIO_STAGE_GATE'),
])

export const CreateFormDefinitionBody = t.Object({
  purpose: FormPurpose,
  challengeId: t.Optional(Uuid),
  name: t.String({ minLength: 2, maxLength: 200 }),
})

export const UpdateFormDefinitionBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 200 }),
})

export const FormDefinitionResponse = t.Object({
  id: Uuid,
  purpose: FormPurpose,
  challengeId: t.Union([Uuid, t.Null()]),
  name: t.String(),
  createdAt: t.String(),
})

export const FormDefinitionListResponse = PageOf(FormDefinitionResponse)
export const FormDefinitionListQuery = t.Composite([
  PaginationQuery,
  t.Object({ purpose: t.Optional(FormPurpose), challengeId: t.Optional(Uuid) }),
])

/**
 * `schema` is genuinely dynamic — its shape is the fixed field-definition
 * format documented in master prompt section 11, validated by AJV in the
 * service layer rather than by this TypeBox contract. TypeBox only confirms
 * "some JSON value was sent."
 */
export const CreateFormVersionBody = t.Object({
  schema: t.Unknown(),
})

export const FormVersionResponse = t.Object({
  id: Uuid,
  formDefinitionId: Uuid,
  version: t.Integer(),
  schema: t.Unknown(),
  isPublished: t.Boolean(),
  publishedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
})

export const FormVersionListResponse = t.Array(FormVersionResponse)

export const SubmitFormResponseBody = t.Object({
  responseData: t.Record(t.String(), t.Unknown()),
})

export const FormResponseResponse = t.Object({
  id: Uuid,
  formVersionId: Uuid,
  userId: Uuid,
  responseData: t.Unknown(),
  submittedAt: t.String(),
})

export const FormResponseListResponse = PageOf(FormResponseResponse)
