import type { PrismaTransactionClient } from '../../shared/database'

export interface TechnologyTagCount {
  tag: string
  count: number
}

export interface AnalyticsOverviewRow {
  members: number
  registrations: number
  approvedParticipants: number
  activeTeams: number
  submissionsStarted: number
  finalSubmissions: number
  completionRate: number
  judgingCompletion: number
  averageScoringTurnaroundHours: number | null
  topTechnologyTags: TechnologyTagCount[]
  finalistCount: number
  winnerCount: number
}

export interface ChallengeAnalyticsSummaryRow {
  challengeId: string
  title: string
  registrations: number
  approvedParticipants: number
  finalSubmissions: number
  judgingCompletion: number
}

export interface SubmissionsPerTrackRow {
  trackId: string | null
  trackName: string | null
  submissions: number
}

async function scoringTurnaroundHours(
  tx: PrismaTransactionClient,
  organizationId: string,
  challengeId?: string,
): Promise<number | null> {
  const rows = challengeId
    ? await tx.$queryRaw<{ avg_hours: number | null }[]>`
        select avg(extract(epoch from (s.submitted_at - ja.created_at)) / 3600.0) as avg_hours
        from scorecard s
        join judge_assignment ja on ja.id = s.judge_assignment_id
        where s.organization_id = ${organizationId}::uuid
          and ja.challenge_id = ${challengeId}::uuid
          and s.submitted_at is not null
      `
    : await tx.$queryRaw<{ avg_hours: number | null }[]>`
        select avg(extract(epoch from (s.submitted_at - ja.created_at)) / 3600.0) as avg_hours
        from scorecard s
        join judge_assignment ja on ja.id = s.judge_assignment_id
        where s.organization_id = ${organizationId}::uuid
          and s.submitted_at is not null
      `
  const value = rows[0]?.avg_hours
  return value === null || value === undefined ? null : Number(value)
}

async function topTechnologyTags(
  tx: PrismaTransactionClient,
  organizationId: string,
  challengeId?: string,
): Promise<TechnologyTagCount[]> {
  const rows = challengeId
    ? await tx.$queryRaw<{ tag: string; count: bigint }[]>`
        select st.display_label_snapshot as tag, count(*)::bigint as count
        from submission_version sv
        join submission s on s.id = sv.submission_id and s.final_version_id = sv.id
        join submission_technology st on st.submission_version_id = sv.id
        where s.organization_id = ${organizationId}::uuid and s.challenge_id = ${challengeId}::uuid
        group by st.technology_tag_id, st.display_label_snapshot
        order by count desc
        limit 10
      `
    : await tx.$queryRaw<{ tag: string; count: bigint }[]>`
        select st.display_label_snapshot as tag, count(*)::bigint as count
        from submission_version sv
        join submission s on s.id = sv.submission_id and s.final_version_id = sv.id
        join submission_technology st on st.submission_version_id = sv.id
        where s.organization_id = ${organizationId}::uuid
        group by st.technology_tag_id, st.display_label_snapshot
        order by count desc
        limit 10
      `
  return rows.map((row) => ({ tag: row.tag, count: Number(row.count) }))
}

export interface PortfolioAnalyticsRow {
  totalInnovations: number
  byStage: { stage: string; count: number }[]
  portfolioConversionRate: number
  activeMilestones: number
  overdueMilestones: number
}

export interface AnalyticsRepository {
  getOverview(tx: PrismaTransactionClient, organizationId: string): Promise<AnalyticsOverviewRow>
  getChallengeAnalytics(
    tx: PrismaTransactionClient,
    organizationId: string,
    challengeId: string,
  ): Promise<AnalyticsOverviewRow & { submissionsPerTrack: SubmissionsPerTrackRow[] }>
  listChallengeSummaries(
    tx: PrismaTransactionClient,
    organizationId: string,
  ): Promise<ChallengeAnalyticsSummaryRow[]>
  getPortfolioAnalytics(
    tx: PrismaTransactionClient,
    organizationId: string,
  ): Promise<PortfolioAnalyticsRow>
}

const ROLLUP_FRESHNESS_MS = 5 * 60 * 1000

function completion(completed: number, total: number): number {
  return total > 0 ? completed / total : 0
}

export function createAnalyticsRepository(): AnalyticsRepository {
  return {
    async getOverview(tx, organizationId) {
      const rollup = await tx.analyticsDailyRollup.findFirst({
        where: {
          organizationId,
          challengeId: null,
          calculatedAt: { gte: new Date(Date.now() - ROLLUP_FRESHNESS_MS) },
        },
        orderBy: { calculatedAt: 'desc' },
      })
      if (rollup !== null) {
        return {
          members: rollup.members,
          registrations: rollup.registrations,
          approvedParticipants: rollup.approvedParticipants,
          activeTeams: rollup.activeTeams,
          submissionsStarted: rollup.submissionsStarted,
          finalSubmissions: rollup.finalSubmissions,
          completionRate: completion(rollup.finalSubmissions, rollup.registrations),
          judgingCompletion: completion(rollup.scorecardsSubmitted, rollup.assignmentsTotal),
          averageScoringTurnaroundHours:
            rollup.averageScoringTurnaroundHours === null
              ? null
              : Number(rollup.averageScoringTurnaroundHours),
          topTechnologyTags: await topTechnologyTags(tx, organizationId),
          finalistCount: rollup.finalistCount,
          winnerCount: rollup.winnerCount,
        }
      }

      const [
        members,
        registrations,
        approvedParticipants,
        activeTeams,
        submissionsStarted,
        finalSubmissions,
        assignmentsTotal,
        scorecardsSubmitted,
        finalistCount,
        winnerCount,
      ] = await Promise.all([
        tx.organizationMembership.count({ where: { organizationId, status: 'ACTIVE' } }),
        tx.challengeParticipation.count({ where: { organizationId } }),
        tx.challengeParticipation.count({ where: { organizationId, status: 'APPROVED' } }),
        tx.challengeTeam.count({ where: { organizationId } }),
        tx.submission.count({ where: { organizationId } }),
        tx.submission.count({ where: { organizationId, finalVersionId: { not: null } } }),
        tx.judgeAssignment.count({ where: { organizationId, status: { not: 'REASSIGNED' } } }),
        tx.scorecard.count({ where: { organizationId, status: { in: ['SUBMITTED', 'LOCKED'] } } }),
        tx.submissionResult.count({ where: { organizationId, rank: { not: null } } }),
        tx.submissionResult.count({ where: { organizationId, rank: 1 } }),
      ])

      const [averageScoringTurnaroundHours, tags] = await Promise.all([
        scoringTurnaroundHours(tx, organizationId),
        topTechnologyTags(tx, organizationId),
      ])

      return {
        members,
        registrations,
        approvedParticipants,
        activeTeams,
        submissionsStarted,
        finalSubmissions,
        completionRate: registrations > 0 ? finalSubmissions / registrations : 0,
        judgingCompletion: assignmentsTotal > 0 ? scorecardsSubmitted / assignmentsTotal : 0,
        averageScoringTurnaroundHours,
        topTechnologyTags: tags,
        finalistCount,
        winnerCount,
      }
    },

    async getChallengeAnalytics(tx, organizationId, challengeId) {
      const rollup = await tx.analyticsDailyRollup.findFirst({
        where: {
          organizationId,
          challengeId,
          calculatedAt: { gte: new Date(Date.now() - ROLLUP_FRESHNESS_MS) },
        },
        orderBy: { calculatedAt: 'desc' },
      })
      if (rollup !== null) {
        const [tags, perTrack] = await Promise.all([
          topTechnologyTags(tx, organizationId, challengeId),
          tx.$queryRaw<
            { track_id: string | null; track_name: string | null; submissions: bigint }[]
          >`
            select t.id as track_id, t.name as track_name, count(s.id)::bigint as submissions
            from submission s
            left join challenge_track t on t.id = s.track_id
            where s.organization_id = ${organizationId}::uuid
              and s.challenge_id = ${challengeId}::uuid
            group by t.id, t.name
            order by submissions desc
          `,
        ])
        return {
          members: 0,
          registrations: rollup.registrations,
          approvedParticipants: rollup.approvedParticipants,
          activeTeams: rollup.activeTeams,
          submissionsStarted: rollup.submissionsStarted,
          finalSubmissions: rollup.finalSubmissions,
          completionRate: completion(rollup.finalSubmissions, rollup.registrations),
          judgingCompletion: completion(rollup.scorecardsSubmitted, rollup.assignmentsTotal),
          averageScoringTurnaroundHours:
            rollup.averageScoringTurnaroundHours === null
              ? null
              : Number(rollup.averageScoringTurnaroundHours),
          topTechnologyTags: tags,
          finalistCount: rollup.finalistCount,
          winnerCount: rollup.winnerCount,
          submissionsPerTrack: perTrack.map((row) => ({
            trackId: row.track_id,
            trackName: row.track_name,
            submissions: Number(row.submissions),
          })),
        }
      }

      const [
        registrations,
        approvedParticipants,
        activeTeams,
        submissionsStarted,
        finalSubmissions,
        assignmentsTotal,
        scorecardsSubmitted,
        finalistCount,
        winnerCount,
      ] = await Promise.all([
        tx.challengeParticipation.count({ where: { organizationId, challengeId } }),
        tx.challengeParticipation.count({
          where: { organizationId, challengeId, status: 'APPROVED' },
        }),
        tx.challengeTeam.count({ where: { organizationId, challengeId } }),
        tx.submission.count({ where: { organizationId, challengeId } }),
        tx.submission.count({
          where: { organizationId, challengeId, finalVersionId: { not: null } },
        }),
        tx.judgeAssignment.count({
          where: { organizationId, challengeId, status: { not: 'REASSIGNED' } },
        }),
        tx.scorecard.count({
          where: { organizationId, challengeId, status: { in: ['SUBMITTED', 'LOCKED'] } },
        }),
        tx.submissionResult.count({ where: { organizationId, challengeId, rank: { not: null } } }),
        tx.submissionResult.count({ where: { organizationId, challengeId, rank: 1 } }),
      ])

      const [averageScoringTurnaroundHours, tags, perTrack] = await Promise.all([
        scoringTurnaroundHours(tx, organizationId, challengeId),
        topTechnologyTags(tx, organizationId, challengeId),
        tx.$queryRaw<{ track_id: string | null; track_name: string | null; submissions: bigint }[]>`
          select t.id as track_id, t.name as track_name, count(s.id)::bigint as submissions
          from submission s
          left join challenge_track t on t.id = s.track_id
          where s.organization_id = ${organizationId}::uuid and s.challenge_id = ${challengeId}::uuid
          group by t.id, t.name
          order by submissions desc
        `,
      ])

      // Membership count has no per-challenge meaning; a challenge-scoped
      // summary reports registrations, not organization headcount.
      return {
        members: 0,
        registrations,
        approvedParticipants,
        activeTeams,
        submissionsStarted,
        finalSubmissions,
        completionRate: registrations > 0 ? finalSubmissions / registrations : 0,
        judgingCompletion: assignmentsTotal > 0 ? scorecardsSubmitted / assignmentsTotal : 0,
        averageScoringTurnaroundHours,
        topTechnologyTags: tags,
        finalistCount,
        winnerCount,
        submissionsPerTrack: perTrack.map((row) => ({
          trackId: row.track_id,
          trackName: row.track_name,
          submissions: Number(row.submissions),
        })),
      }
    },

    async listChallengeSummaries(tx, organizationId) {
      const challenges = await tx.challenge.findMany({
        where: { organizationId },
        select: { id: true, title: true },
        orderBy: { createdAt: 'desc' },
      })
      if (challenges.length === 0) return []

      const rollups = await tx.analyticsDailyRollup.findMany({
        where: {
          organizationId,
          challengeId: { in: challenges.map((challenge) => challenge.id) },
          calculatedAt: { gte: new Date(Date.now() - ROLLUP_FRESHNESS_MS) },
        },
        orderBy: { calculatedAt: 'desc' },
      })
      const latest = new Map<string, (typeof rollups)[number]>()
      for (const rollup of rollups) {
        if (rollup.challengeId !== null && !latest.has(rollup.challengeId)) {
          latest.set(rollup.challengeId, rollup)
        }
      }
      if (latest.size === challenges.length) {
        return challenges.map((challenge) => {
          const row = latest.get(challenge.id)
          if (row === undefined) throw new Error('Fresh analytics rollup set became inconsistent.')
          return {
            challengeId: challenge.id,
            title: challenge.title,
            registrations: row.registrations,
            approvedParticipants: row.approvedParticipants,
            finalSubmissions: row.finalSubmissions,
            judgingCompletion: completion(row.scorecardsSubmitted, row.assignmentsTotal),
          }
        })
      }

      // One bounded aggregate query for a cold/stale cache. The previous
      // implementation issued five queries per challenge (an N+1 dashboard).
      const rows = await tx.$queryRaw<
        {
          challenge_id: string
          registrations: bigint
          approved_participants: bigint
          final_submissions: bigint
          assignments_total: bigint
          scorecards_submitted: bigint
        }[]
      >`
        select c.id as challenge_id,
          count(distinct cp.id)::bigint as registrations,
          (count(distinct cp.id) filter (where cp.status = 'APPROVED'))::bigint
            as approved_participants,
          (count(distinct s.id) filter (where s.final_version_id is not null))::bigint
            as final_submissions,
          (count(distinct ja.id) filter (where ja.status <> 'REASSIGNED'))::bigint
            as assignments_total,
          (count(distinct sc.id) filter (where sc.status in ('SUBMITTED', 'LOCKED')))::bigint
            as scorecards_submitted
        from challenge c
        left join challenge_participation cp on cp.challenge_id = c.id
        left join submission s on s.challenge_id = c.id
        left join judge_assignment ja on ja.challenge_id = c.id
        left join scorecard sc on sc.challenge_id = c.id
        where c.organization_id = ${organizationId}::uuid
        group by c.id
      `
      const byChallenge = new Map(rows.map((row) => [row.challenge_id, row]))
      return challenges.map((challenge) => {
        const row = byChallenge.get(challenge.id)
        const assignmentsTotal = Number(row?.assignments_total ?? 0)
        const scorecardsSubmitted = Number(row?.scorecards_submitted ?? 0)
        return {
          challengeId: challenge.id,
          title: challenge.title,
          registrations: Number(row?.registrations ?? 0),
          approvedParticipants: Number(row?.approved_participants ?? 0),
          finalSubmissions: Number(row?.final_submissions ?? 0),
          judgingCompletion: completion(scorecardsSubmitted, assignmentsTotal),
        }
      })
    },

    async getPortfolioAnalytics(tx, organizationId) {
      const rollup = await tx.analyticsDailyRollup.findFirst({
        where: {
          organizationId,
          challengeId: null,
          calculatedAt: { gte: new Date(Date.now() - ROLLUP_FRESHNESS_MS) },
        },
        orderBy: { calculatedAt: 'desc' },
      })
      if (rollup !== null) {
        const byStageGroups = await tx.innovation.groupBy({
          by: ['stage'],
          where: { organizationId },
          _count: { _all: true },
        })
        return {
          totalInnovations: rollup.totalInnovations,
          byStage: byStageGroups.map((group) => ({ stage: group.stage, count: group._count._all })),
          portfolioConversionRate: completion(rollup.promotedInnovations, rollup.finalSubmissions),
          activeMilestones: rollup.activeMilestones,
          overdueMilestones: rollup.overdueMilestones,
        }
      }

      const [
        totalInnovations,
        byStageGroups,
        promotedInnovations,
        finalSubmissions,
        activeMilestones,
        overdueMilestones,
      ] = await Promise.all([
        tx.innovation.count({ where: { organizationId } }),
        tx.innovation.groupBy({
          by: ['stage'],
          where: { organizationId },
          _count: { _all: true },
        }),
        tx.innovation.count({ where: { organizationId, sourceSubmissionId: { not: null } } }),
        tx.submission.count({ where: { organizationId, finalVersionId: { not: null } } }),
        tx.innovationMilestone.count({
          where: { organizationId, status: { in: ['PLANNED', 'IN_PROGRESS', 'AT_RISK'] } },
        }),
        tx.innovationMilestone.count({
          where: {
            organizationId,
            status: { in: ['PLANNED', 'IN_PROGRESS', 'AT_RISK'] },
            dueDate: { lt: new Date() },
          },
        }),
      ])

      return {
        totalInnovations,
        byStage: byStageGroups.map((group) => ({ stage: group.stage, count: group._count._all })),
        portfolioConversionRate: finalSubmissions > 0 ? promotedInnovations / finalSubmissions : 0,
        activeMilestones,
        overdueMilestones,
      }
    },
  }
}
