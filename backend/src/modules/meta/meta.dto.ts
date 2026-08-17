import { t } from 'elysia'
import { PageOf, PaginationQuery, Uuid } from '../../shared/http'

/**
 * Read-only catalogue and capability endpoints (master prompt section 34.1).
 * No authentication required; no tenant scoping applies.
 */

export const SkillDto = t.Object({
  id: Uuid,
  name: t.String(),
  slug: t.String(),
  category: t.Union([t.String(), t.Null()]),
})
export type SkillDto = typeof SkillDto.static

export const SkillListQuery = t.Composite([
  PaginationQuery,
  t.Object({
    /** Case-insensitive substring/fuzzy match over the skill name. */
    q: t.Optional(t.String({ maxLength: 100 })),
  }),
])

export const SkillListResponse = PageOf(SkillDto)

export const TechnologyTagDto = t.Object({
  id: Uuid,
  name: t.String(),
  slug: t.String(),
  category: t.Union([t.String(), t.Null()]),
})
export type TechnologyTagDto = typeof TechnologyTagDto.static

export const TechnologyTagListQuery = t.Composite([
  PaginationQuery,
  t.Object({
    /** Case-insensitive substring/fuzzy match over the tag name. */
    q: t.Optional(t.String({ maxLength: 100 })),
  }),
])

export const TechnologyTagListResponse = PageOf(TechnologyTagDto)

/**
 * Client-visible, non-secret feature flags. Never includes operational
 * configuration, secrets, or anything that would let a client infer internal
 * infrastructure state.
 */
export const CapabilitiesResponse = t.Object({
  sseNotifications: t.Boolean(),
  documentUploads: t.Boolean(),
  slackIntegration: t.Boolean(),
  discordIntegration: t.Boolean(),
  unlistedChallenges: t.Boolean(),
  openAuthenticatedParticipation: t.Boolean(),
  mentorRole: t.Boolean(),
  directInnovationIntake: t.Boolean(),
})
