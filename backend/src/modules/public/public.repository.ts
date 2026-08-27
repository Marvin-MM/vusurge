import type { PrismaTransactionClient } from '../../shared/database'
import { buildPage, type Page, type PageRequest } from '../../shared/http'

export interface PublicOrganizationRow {
  id: string
  slug: string
  name: string
  description: string | null
  organizationType: string
  websiteUrl: string | null
  country: string | null
  region: string | null
  logoAssetId: string | null
  createdAt: Date
}

interface PublicOrganizationSqlRow {
  id: string
  slug: string
  name: string
  description: string | null
  organization_type: string
  website_url: string | null
  country: string | null
  region: string | null
  logo_asset_id: string | null
  created_at: Date
}

function fromSqlRow(row: PublicOrganizationSqlRow): PublicOrganizationRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    organizationType: row.organization_type,
    websiteUrl: row.website_url,
    country: row.country,
    region: row.region,
    logoAssetId: row.logo_asset_id,
    createdAt: row.created_at,
  }
}

export interface PublicChallengeRow {
  id: string
  organizationId: string
  organizationSlug: string
  organizationName: string
  slug: string
  title: string
  summary: string | null
  description: string | null
  coverAssetId: string | null
  status: string
  publishedAt: Date
  registrationOpenAt: Date | null
  registrationCloseAt: Date | null
  submissionOpenAt: Date | null
  submissionDeadline: Date | null
  judgingStartAt: Date | null
  judgingEndAt: Date | null
  resultsPublishedAt: Date | null
  displayTimeZone: string
  minTeamSize: number
  maxTeamSize: number
  soloParticipationAllowed: boolean
  participationPolicy: string
  createdAt: Date
}

interface PublicChallengeSqlRow {
  id: string
  organization_id: string
  organization_slug: string
  organization_name: string
  slug: string
  title: string
  summary: string | null
  description: string | null
  cover_asset_id: string | null
  status: string
  published_at: Date
  registration_open_at: Date | null
  registration_close_at: Date | null
  submission_open_at: Date | null
  submission_deadline: Date | null
  judging_start_at: Date | null
  judging_end_at: Date | null
  results_published_at: Date | null
  display_time_zone: string
  min_team_size: number
  max_team_size: number
  solo_participation_allowed: boolean
  participation_policy: string
  created_at: Date
}

function challengeFromSqlRow(row: PublicChallengeSqlRow): PublicChallengeRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationSlug: row.organization_slug,
    organizationName: row.organization_name,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    coverAssetId: row.cover_asset_id,
    status: row.status,
    publishedAt: row.published_at,
    registrationOpenAt: row.registration_open_at,
    registrationCloseAt: row.registration_close_at,
    submissionOpenAt: row.submission_open_at,
    submissionDeadline: row.submission_deadline,
    judgingStartAt: row.judging_start_at,
    judgingEndAt: row.judging_end_at,
    resultsPublishedAt: row.results_published_at,
    displayTimeZone: row.display_time_zone,
    minTeamSize: row.min_team_size,
    maxTeamSize: row.max_team_size,
    soloParticipationAllowed: row.solo_participation_allowed,
    participationPolicy: row.participation_policy,
    createdAt: row.created_at,
  }
}

export interface PublicInnovationRow {
  id: string
  organizationSlug: string
  organizationName: string
  title: string
  opportunityStatement: string | null
  thesis: string | null
  expectedImpact: string | null
  beneficiaries: string | null
  strategicThemes: string[]
  stage: string
  createdAt: Date
}

interface PublicInnovationSqlRow {
  id: string
  organization_slug: string
  organization_name: string
  title: string
  opportunity_statement: string | null
  thesis: string | null
  expected_impact: string | null
  beneficiaries: string | null
  strategic_themes: string[]
  stage: string
  created_at: Date
}

function innovationFromSqlRow(row: PublicInnovationSqlRow): PublicInnovationRow {
  return {
    id: row.id,
    organizationSlug: row.organization_slug,
    organizationName: row.organization_name,
    title: row.title,
    opportunityStatement: row.opportunity_statement,
    thesis: row.thesis,
    expectedImpact: row.expected_impact,
    beneficiaries: row.beneficiaries,
    strategicThemes: row.strategic_themes,
    stage: row.stage,
    createdAt: row.created_at,
  }
}

export interface PublicChallengeTrackRow {
  id: string
  challengeId: string
  name: string
  description: string | null
  archivedAt: Date | null
}

interface PublicChallengeTrackSqlRow {
  id: string
  challenge_id: string
  name: string
  description: string | null
  archived_at: Date | null
}

function trackFromSqlRow(row: PublicChallengeTrackSqlRow): PublicChallengeTrackRow {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    name: row.name,
    description: row.description,
    archivedAt: row.archived_at,
  }
}

export interface PublicAnnouncementRow {
  id: string
  challengeId: string
  title: string
  body: string
  priority: string
  publishedAt: Date | null
}

interface PublicAnnouncementSqlRow {
  id: string
  challenge_id: string
  title: string
  body: string
  priority: string
  published_at: Date | null
}

function announcementFromSqlRow(row: PublicAnnouncementSqlRow): PublicAnnouncementRow {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    publishedAt: row.published_at,
  }
}

export interface PublicFaqRow {
  id: string
  challengeId: string
  question: string
  answer: string
}

interface PublicFaqSqlRow {
  id: string
  challenge_id: string
  question: string
  answer: string
}

function faqFromSqlRow(row: PublicFaqSqlRow): PublicFaqRow {
  return { id: row.id, challengeId: row.challenge_id, question: row.question, answer: row.answer }
}

export interface PublicSubmissionResultRow {
  id: string
  challengeId: string
  submissionId: string
  trackId: string | null
  rankLabel: string | null
  rank: number | null
  aggregateScore: number | null
}

interface PublicSubmissionResultSqlRow {
  id: string
  challenge_id: string
  submission_id: string
  track_id: string | null
  rank_label: string | null
  rank: number | null
  aggregate_score: number | null
}

function resultFromSqlRow(row: PublicSubmissionResultSqlRow): PublicSubmissionResultRow {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    submissionId: row.submission_id,
    trackId: row.track_id,
    rankLabel: row.rank_label,
    rank: row.rank,
    aggregateScore: row.aggregate_score,
  }
}

export interface PublicProjectRow {
  id: string
  organizationSlug: string
  organizationName: string
  challengeSlug: string
  challengeTitle: string
  teamName: string
  title: string | null
  tagline: string | null
  solutionDescription: string | null
  impactBeneficiaries: string | null
  technologyTags: string[]
  repositoryUrl: string | null
  demoUrl: string | null
  pitchVideoUrl: string | null
  presentationUrl: string | null
  createdAt: Date
}

interface PublicProjectSqlRow {
  id: string
  organization_slug: string
  organization_name: string
  challenge_slug: string
  challenge_title: string
  team_name: string
  title: string | null
  tagline: string | null
  solution_description: string | null
  impact_beneficiaries: string | null
  technology_tags: string[]
  repository_url: string | null
  demo_url: string | null
  pitch_video_url: string | null
  presentation_url: string | null
  created_at: Date
}

function projectFromSqlRow(row: PublicProjectSqlRow): PublicProjectRow {
  return {
    id: row.id,
    organizationSlug: row.organization_slug,
    organizationName: row.organization_name,
    challengeSlug: row.challenge_slug,
    challengeTitle: row.challenge_title,
    teamName: row.team_name,
    title: row.title,
    tagline: row.tagline,
    solutionDescription: row.solution_description,
    impactBeneficiaries: row.impact_beneficiaries,
    technologyTags: row.technology_tags,
    repositoryUrl: row.repository_url,
    demoUrl: row.demo_url,
    pitchVideoUrl: row.pitch_video_url,
    presentationUrl: row.presentation_url,
    createdAt: row.created_at,
  }
}

export interface PublicRepository {
  listOrganizations(
    client: PrismaTransactionClient,
    query: string | undefined,
    page: PageRequest,
  ): Promise<Page<PublicOrganizationRow>>
  findOrganizationBySlug(
    client: PrismaTransactionClient,
    slug: string,
  ): Promise<PublicOrganizationRow | null>
  listChallenges(
    client: PrismaTransactionClient,
    query: string | undefined,
    page: PageRequest,
  ): Promise<Page<PublicChallengeRow>>
  listChallengesForOrganization(
    client: PrismaTransactionClient,
    organizationSlug: string,
    page: PageRequest,
  ): Promise<Page<PublicChallengeRow>>
  findChallenge(
    client: PrismaTransactionClient,
    organizationSlug: string,
    challengeSlug: string,
  ): Promise<PublicChallengeRow | null>
  listInnovationsForOrganization(
    client: PrismaTransactionClient,
    organizationSlug: string,
    page: PageRequest,
  ): Promise<Page<PublicInnovationRow>>
  listTracksForChallenge(
    client: PrismaTransactionClient,
    organizationSlug: string,
    challengeSlug: string,
  ): Promise<PublicChallengeTrackRow[]>
  listAnnouncementsForChallenge(
    client: PrismaTransactionClient,
    organizationSlug: string,
    challengeSlug: string,
  ): Promise<PublicAnnouncementRow[]>
  listFaqsForChallenge(
    client: PrismaTransactionClient,
    organizationSlug: string,
    challengeSlug: string,
  ): Promise<PublicFaqRow[]>
  listResultsForChallenge(
    client: PrismaTransactionClient,
    organizationSlug: string,
    challengeSlug: string,
  ): Promise<PublicSubmissionResultRow[]>
  listProjectsForOrganization(
    client: PrismaTransactionClient,
    organizationSlug: string,
    page: PageRequest,
  ): Promise<Page<PublicProjectRow>>
}

export function createPublicRepository(): PublicRepository {
  return {
    async listOrganizations(client, query, page) {
      // Reads only ever touch the curated view, never the base `organization`
      // table (master prompt section 6.4). The view's own WHERE clause is
      // what keeps a suspended/archived/private organization out, so nothing
      // here needs to repeat that filter.
      const cursorAt = page.cursor ? new Date(page.cursor.at) : null
      const cursorId = page.cursor?.id ?? null

      const rows = await client.$queryRaw<PublicOrganizationSqlRow[]>`
        select id, slug, name, description, organization_type, website_url, country, region,
               logo_asset_id, created_at
        from public_organization_view
        where (${query}::text is null or name ilike '%' || ${query}::text || '%')
          and (
            ${cursorAt}::timestamptz is null
            or created_at < ${cursorAt}::timestamptz
            or (created_at = ${cursorAt}::timestamptz and id < ${cursorId}::uuid)
          )
        order by created_at desc, id desc
        limit ${page.limit + 1}
      `
      return buildPage(rows.map(fromSqlRow), page, (row) => ({
        at: row.createdAt.toISOString(),
        id: row.id,
      }))
    },

    async findOrganizationBySlug(client, slug) {
      const rows = await client.$queryRaw<PublicOrganizationSqlRow[]>`
        select id, slug, name, description, organization_type, website_url, country, region,
               logo_asset_id, created_at
        from public_organization_view
        where lower(slug) = lower(${slug})
        limit 1
      `
      const row = rows[0]
      return row === undefined ? null : fromSqlRow(row)
    },

    async listChallenges(client, query, page) {
      const cursorAt = page.cursor ? new Date(page.cursor.at) : null
      const cursorId = page.cursor?.id ?? null

      const rows = await client.$queryRaw<PublicChallengeSqlRow[]>`
        select id, organization_id, organization_slug, organization_name, slug, title, summary,
               description, cover_asset_id, status, published_at, registration_open_at,
               registration_close_at, submission_open_at, submission_deadline, judging_start_at,
               judging_end_at, results_published_at, display_time_zone, min_team_size,
               max_team_size, solo_participation_allowed, participation_policy, created_at
        from public_challenge_view
        where (${query}::text is null or title ilike '%' || ${query}::text || '%')
          and (
            ${cursorAt}::timestamptz is null
            or published_at < ${cursorAt}::timestamptz
            or (published_at = ${cursorAt}::timestamptz and id < ${cursorId}::uuid)
          )
        order by published_at desc, id desc
        limit ${page.limit + 1}
      `
      return buildPage(rows.map(challengeFromSqlRow), page, (row) => ({
        at: row.publishedAt.toISOString(),
        id: row.id,
      }))
    },

    async listChallengesForOrganization(client, organizationSlug, page) {
      const cursorAt = page.cursor ? new Date(page.cursor.at) : null
      const cursorId = page.cursor?.id ?? null

      const rows = await client.$queryRaw<PublicChallengeSqlRow[]>`
        select id, organization_id, organization_slug, organization_name, slug, title, summary,
               description, cover_asset_id, status, published_at, registration_open_at,
               registration_close_at, submission_open_at, submission_deadline, judging_start_at,
               judging_end_at, results_published_at, display_time_zone, min_team_size,
               max_team_size, solo_participation_allowed, participation_policy, created_at
        from public_challenge_view
        where lower(organization_slug) = lower(${organizationSlug})
          and (
            ${cursorAt}::timestamptz is null
            or published_at < ${cursorAt}::timestamptz
            or (published_at = ${cursorAt}::timestamptz and id < ${cursorId}::uuid)
          )
        order by published_at desc, id desc
        limit ${page.limit + 1}
      `
      return buildPage(rows.map(challengeFromSqlRow), page, (row) => ({
        at: row.publishedAt.toISOString(),
        id: row.id,
      }))
    },

    async findChallenge(client, organizationSlug, challengeSlug) {
      const rows = await client.$queryRaw<PublicChallengeSqlRow[]>`
        select id, organization_id, organization_slug, organization_name, slug, title, summary,
               description, cover_asset_id, status, published_at, registration_open_at,
               registration_close_at, submission_open_at, submission_deadline, judging_start_at,
               judging_end_at, results_published_at, display_time_zone, min_team_size,
               max_team_size, solo_participation_allowed, participation_policy, created_at
        from public_challenge_view
        where lower(organization_slug) = lower(${organizationSlug})
          and lower(slug) = lower(${challengeSlug})
        limit 1
      `
      const row = rows[0]
      return row === undefined ? null : challengeFromSqlRow(row)
    },

    async listInnovationsForOrganization(client, organizationSlug, page) {
      const cursorAt = page.cursor ? new Date(page.cursor.at) : null
      const cursorId = page.cursor?.id ?? null

      const rows = await client.$queryRaw<PublicInnovationSqlRow[]>`
        select id, organization_slug, organization_name, title, opportunity_statement, thesis,
               expected_impact, beneficiaries, strategic_themes, stage, created_at
        from public_innovation_view
        where lower(organization_slug) = lower(${organizationSlug})
          and (
            ${cursorAt}::timestamptz is null
            or created_at < ${cursorAt}::timestamptz
            or (created_at = ${cursorAt}::timestamptz and id < ${cursorId}::uuid)
          )
        order by created_at desc, id desc
        limit ${page.limit + 1}
      `
      return buildPage(rows.map(innovationFromSqlRow), page, (row) => ({
        at: row.createdAt.toISOString(),
        id: row.id,
      }))
    },

    async listTracksForChallenge(client, organizationSlug, challengeSlug) {
      const rows = await client.$queryRaw<PublicChallengeTrackSqlRow[]>`
        select id, challenge_id, name, description, archived_at
        from public_challenge_track_view
        where lower(organization_slug) = lower(${organizationSlug})
          and lower(challenge_slug) = lower(${challengeSlug})
        order by display_order asc, created_at asc
      `
      return rows.map(trackFromSqlRow)
    },

    async listAnnouncementsForChallenge(client, organizationSlug, challengeSlug) {
      const rows = await client.$queryRaw<PublicAnnouncementSqlRow[]>`
        select id, challenge_id, title, body, priority, published_at
        from public_announcement_view
        where lower(organization_slug) = lower(${organizationSlug})
          and lower(challenge_slug) = lower(${challengeSlug})
        order by published_at desc, created_at desc
      `
      return rows.map(announcementFromSqlRow)
    },

    async listFaqsForChallenge(client, organizationSlug, challengeSlug) {
      const rows = await client.$queryRaw<PublicFaqSqlRow[]>`
        select id, challenge_id, question, answer
        from public_faq_view
        where lower(organization_slug) = lower(${organizationSlug})
          and lower(challenge_slug) = lower(${challengeSlug})
        order by display_order asc, created_at asc
      `
      return rows.map(faqFromSqlRow)
    },

    async listResultsForChallenge(client, organizationSlug, challengeSlug) {
      const rows = await client.$queryRaw<PublicSubmissionResultSqlRow[]>`
        select id, challenge_id, submission_id, track_id, rank_label, rank, aggregate_score
        from public_submission_result_view
        where lower(organization_slug) = lower(${organizationSlug})
          and lower(challenge_slug) = lower(${challengeSlug})
        order by rank asc nulls last, aggregate_score desc nulls last
      `
      return rows.map(resultFromSqlRow)
    },

    async listProjectsForOrganization(client, organizationSlug, page) {
      const cursorAt = page.cursor ? new Date(page.cursor.at) : null
      const cursorId = page.cursor?.id ?? null

      const rows = await client.$queryRaw<PublicProjectSqlRow[]>`
        select id, organization_slug, organization_name, challenge_slug, challenge_title,
               team_name, title, tagline, solution_description, impact_beneficiaries,
               technology_tags, repository_url, demo_url, pitch_video_url, presentation_url,
               created_at
        from public_project_view
        where lower(organization_slug) = lower(${organizationSlug})
          and (
            ${cursorAt}::timestamptz is null
            or created_at < ${cursorAt}::timestamptz
            or (created_at = ${cursorAt}::timestamptz and id < ${cursorId}::uuid)
          )
        order by created_at desc, id desc
        limit ${page.limit + 1}
      `
      return buildPage(rows.map(projectFromSqlRow), page, (row) => ({
        at: row.createdAt.toISOString(),
        id: row.id,
      }))
    },
  }
}
