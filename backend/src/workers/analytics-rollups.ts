import type { Infrastructure } from '../container'
import type { PrismaTransactionClient } from '../shared/database'
import { newId } from '../shared/ids'

async function recomputeOrganization(
  infrastructure: Infrastructure,
  organizationId: string,
  rollupDate: Date,
  calculatedAt: Date,
): Promise<void> {
  await infrastructure.transactions.withTenant(organizationId, async (tx) => {
    const challengeIds = (
      await tx.challenge.findMany({ where: { organizationId }, select: { id: true } })
    ).map((row) => row.id)

    await writeScope(tx, organizationId, null, rollupDate, calculatedAt)
    for (const challengeId of challengeIds) {
      await writeScope(tx, organizationId, challengeId, rollupDate, calculatedAt)
    }
  })
}

async function writeScope(
  tx: PrismaTransactionClient,
  organizationId: string,
  challengeId: string | null,
  rollupDate: Date,
  calculatedAt: Date,
): Promise<void> {
  const scope = challengeId === null ? { organizationId } : { organizationId, challengeId }
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
    totalInnovations,
    promotedInnovations,
    activeMilestones,
    overdueMilestones,
  ] = await Promise.all([
    challengeId === null
      ? tx.organizationMembership.count({ where: { organizationId, status: 'ACTIVE' } })
      : Promise.resolve(0),
    tx.challengeParticipation.count({ where: scope }),
    tx.challengeParticipation.count({ where: { ...scope, status: 'APPROVED' } }),
    tx.challengeTeam.count({ where: scope }),
    tx.submission.count({ where: scope }),
    tx.submission.count({ where: { ...scope, finalVersionId: { not: null } } }),
    tx.judgeAssignment.count({ where: { ...scope, status: { not: 'REASSIGNED' } } }),
    tx.scorecard.count({ where: { ...scope, status: { in: ['SUBMITTED', 'LOCKED'] } } }),
    tx.submissionResult.count({ where: { ...scope, rank: { not: null } } }),
    tx.submissionResult.count({ where: { ...scope, rank: 1 } }),
    challengeId === null ? tx.innovation.count({ where: { organizationId } }) : Promise.resolve(0),
    challengeId === null
      ? tx.innovation.count({ where: { organizationId, sourceSubmissionId: { not: null } } })
      : Promise.resolve(0),
    challengeId === null
      ? tx.innovationMilestone.count({
          where: { organizationId, status: { in: ['PLANNED', 'IN_PROGRESS', 'AT_RISK'] } },
        })
      : Promise.resolve(0),
    challengeId === null
      ? tx.innovationMilestone.count({
          where: {
            organizationId,
            status: { in: ['PLANNED', 'IN_PROGRESS', 'AT_RISK'] },
            dueDate: { lt: calculatedAt },
          },
        })
      : Promise.resolve(0),
  ])

  const turnaround =
    challengeId === null
      ? await tx.$queryRaw<{ value: number | null }[]>`
        select avg(extract(epoch from (s.submitted_at - ja.created_at)) / 3600.0) as value
        from scorecard s join judge_assignment ja on ja.id = s.judge_assignment_id
        where s.organization_id = ${organizationId}::uuid and s.submitted_at is not null
      `
      : await tx.$queryRaw<{ value: number | null }[]>`
        select avg(extract(epoch from (s.submitted_at - ja.created_at)) / 3600.0) as value
        from scorecard s join judge_assignment ja on ja.id = s.judge_assignment_id
        where s.organization_id = ${organizationId}::uuid
          and s.challenge_id = ${challengeId}::uuid and s.submitted_at is not null
      `

  const dateKey = rollupDate.toISOString().slice(0, 10)
  const scopeKey = `${challengeId === null ? 'organization' : 'challenge'}:${challengeId ?? organizationId}:${dateKey}`
  await tx.analyticsDailyRollup.upsert({
    where: { scopeKey },
    create: {
      id: newId(),
      organizationId,
      challengeId,
      scopeKey,
      rollupDate,
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
      totalInnovations,
      promotedInnovations,
      activeMilestones,
      overdueMilestones,
      averageScoringTurnaroundHours: turnaround[0]?.value ?? null,
      calculatedAt,
    },
    update: {
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
      totalInnovations,
      promotedInnovations,
      activeMilestones,
      overdueMilestones,
      averageScoringTurnaroundHours: turnaround[0]?.value ?? null,
      calculatedAt,
    },
  })
}

/** Rebuild today's rollups from authoritative tables; safe to run repeatedly. */
export async function repairAnalyticsRollups(infrastructure: Infrastructure): Promise<number> {
  const { organizationIds, now } = await infrastructure.transactions.withPlatformAccess(
    async (tx) => ({
      organizationIds: (await tx.organization.findMany({ select: { id: true } })).map(
        (row) => row.id,
      ),
      now: await infrastructure.transactions.databaseNow(tx),
    }),
    { purpose: 'Enumerate tenants for authoritative analytics rollup repair.' },
  )
  const rollupDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  for (const organizationId of organizationIds) {
    await recomputeOrganization(infrastructure, organizationId, rollupDate, now)
  }
  return organizationIds.length
}
