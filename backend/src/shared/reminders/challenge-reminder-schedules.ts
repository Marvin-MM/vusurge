import type { PrismaTransactionClient } from '../database'
import { newId } from '../ids'

type ChallengeReminderSource = {
  id: string
  organizationId: string
  status: string
  registrationCloseAt: Date | null
  submissionDeadline: Date | null
  judgingEndAt: Date | null
}

const TERMINAL_CHALLENGE_STATUSES = new Set(['CANCELLED', 'ARCHIVED'])

/**
 * Make the relational reminder schedule match the authoritative challenge
 * schedule inside the same transaction as the challenge change.
 *
 * `deterministicKey` gives each challenge/kind exactly one mutable schedule.
 * A changed deadline increments `revision`; a previously emitted outbox event
 * carries the old revision and its handler will refuse to notify.
 */
export async function syncChallengeReminderSchedules(
  tx: PrismaTransactionClient,
  challenge: ChallengeReminderSource,
  now: Date,
  leadHours: number,
): Promise<void> {
  const leadMs = leadHours * 60 * 60 * 1000
  const definitions = [
    ['REGISTRATION_DEADLINE', challenge.registrationCloseAt],
    ['SUBMISSION_DEADLINE', challenge.submissionDeadline],
    ['JUDGING_DEADLINE', challenge.judgingEndAt],
  ] as const

  for (const [kind, targetAt] of definitions) {
    const deterministicKey = `challenge:${challenge.id}:${kind}`
    const shouldCancel =
      TERMINAL_CHALLENGE_STATUSES.has(challenge.status) || targetAt === null || targetAt <= now

    const existing = await tx.reminderSchedule.findUnique({ where: { deterministicKey } })
    if (shouldCancel) {
      if (existing !== null && existing.status !== 'CANCELLED') {
        await tx.reminderSchedule.update({
          where: { id: existing.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            sentAt: null,
            revision: { increment: 1 },
          },
        })
      }
      continue
    }

    const scheduledFor = new Date(Math.max(now.getTime(), targetAt.getTime() - leadMs))
    if (existing === null) {
      await tx.reminderSchedule.create({
        data: {
          id: newId(),
          organizationId: challenge.organizationId,
          challengeId: challenge.id,
          kind,
          deterministicKey,
          scheduledFor,
          targetAt,
        },
      })
      continue
    }

    const unchangedTarget = existing.targetAt.getTime() === targetAt.getTime()
    const unchangedSchedule = existing.scheduledFor.getTime() === scheduledFor.getTime()
    if (unchangedTarget && unchangedSchedule && existing.status !== 'CANCELLED') continue

    await tx.reminderSchedule.update({
      where: { id: existing.id },
      data: {
        scheduledFor,
        targetAt,
        status: 'SCHEDULED',
        sentAt: null,
        cancelledAt: null,
        revision: { increment: 1 },
      },
    })
  }
}

type PortfolioReminderSource = {
  id: string
  organizationId: string
  stage: string
  nextReviewDate: Date | null
}

export async function syncPortfolioReviewSchedule(
  tx: PrismaTransactionClient,
  innovation: PortfolioReminderSource,
  now: Date,
  leadHours: number,
): Promise<void> {
  const deterministicKey = `innovation:${innovation.id}:PORTFOLIO_REVIEW`
  const existing = await tx.reminderSchedule.findUnique({ where: { deterministicKey } })
  const targetAt = innovation.nextReviewDate
  const shouldCancel = innovation.stage === 'CLOSED' || targetAt === null || targetAt <= now

  if (shouldCancel) {
    if (existing !== null && existing.status !== 'CANCELLED') {
      await tx.reminderSchedule.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          sentAt: null,
          revision: { increment: 1 },
        },
      })
    }
    return
  }

  const scheduledFor = new Date(
    Math.max(now.getTime(), targetAt.getTime() - leadHours * 60 * 60 * 1000),
  )
  if (existing === null) {
    await tx.reminderSchedule.create({
      data: {
        id: newId(),
        organizationId: innovation.organizationId,
        innovationId: innovation.id,
        kind: 'PORTFOLIO_REVIEW',
        deterministicKey,
        scheduledFor,
        targetAt,
      },
    })
    return
  }

  if (
    existing.targetAt.getTime() === targetAt.getTime() &&
    existing.scheduledFor.getTime() === scheduledFor.getTime() &&
    existing.status !== 'CANCELLED'
  ) {
    return
  }

  await tx.reminderSchedule.update({
    where: { id: existing.id },
    data: {
      scheduledFor,
      targetAt,
      status: 'SCHEDULED',
      sentAt: null,
      cancelledAt: null,
      revision: { increment: 1 },
    },
  })
}
