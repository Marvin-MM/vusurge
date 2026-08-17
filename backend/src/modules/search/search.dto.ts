import { t } from 'elysia'
import { PublicChallengeResponse, PublicOrganizationResponse } from '../public/public.dto'

export const PublicSearchQuery = t.Object({
  q: t.String({ minLength: 1, maxLength: 100 }),
})

export const PublicSearchResponse = t.Object({
  organizations: t.Array(PublicOrganizationResponse),
  challenges: t.Array(PublicChallengeResponse),
})
