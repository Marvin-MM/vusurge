import type { Infrastructure } from '../container'
import { ALL_DOMAIN_EVENT_TYPES } from '../shared/outbox'
import { handleAccountDeletionExecuted } from './handlers/account-events.handler'
import {
  handleChallengeCancelled,
  handleChallengeDeadlineExtended,
  handleChallengePublished,
  handleChallengeReopened,
  handleChallengeRescheduled,
  handleResultsPublished,
} from './handlers/challenge-events.handler'
import { handleEmailDeliveryRequested } from './handlers/email-delivery.handler'
import {
  handleAccountDeletionRequested,
  handleOrganizationApplicationDecided,
  handleOrganizationInvitationCreated,
  handleOrganizationJoinRequestDecided,
  handleTeamInvitationCreated,
} from './handlers/email-events.handler'
import {
  handleAnnouncementPublished,
  handleFeedbackReleased,
  handleParticipationDecided,
  handleTeamMembershipChanged,
} from './handlers/engagement-events.handler'
import { handleExportRequested } from './handlers/export-events.handler'
import {
  handleFileDeletionRequested,
  handleFileScanRequested,
} from './handlers/file-events.handler'
import { handleInnovationStageChanged } from './handlers/innovation-events.handler'
import { handleIntegrationDeliveryRequested } from './handlers/integration-events.handler'
import {
  handleChallengeStaffInvitationCreated,
  handleJudgeAssignmentCreated,
  handleScorecardSubmitted,
} from './handlers/judging-events.handler'
import { handleMatchmakingInterestExpressed } from './handlers/matchmaking-events.handler'
import { handleMediaAssetDeletionRequested } from './handlers/media-events.handler'
import { handleReminderDue } from './handlers/reminder-events.handler'
import { handleSubmissionFinalized } from './handlers/submission-events.handler'
import { handleSupportTicketUpdated } from './handlers/support-events.handler'
import { handleResendWebhookEventReceived } from './handlers/webhook-events.handler'
import { createJobRouter, type JobRouter } from './job-router'

/**
 * Wiring of every outbox event type to its handler.
 *
 * One place, so the set of asynchronous effects the system can perform is
 * readable in a single file and documented in docs/queue-catalog.md. Handlers
 * are registered by the modules that own the effect; this function only
 * assembles them.
 */
export function registerJobHandlers(infrastructure: Infrastructure): JobRouter {
  const router = createJobRouter()
  void infrastructure

  router.register('organization_application.decided', handleOrganizationApplicationDecided)
  router.register('organization_invitation.created', handleOrganizationInvitationCreated)
  router.register('organization_join_request.decided', handleOrganizationJoinRequestDecided)
  router.register('team.invitation_created', handleTeamInvitationCreated)
  router.register('account.deletion_requested', handleAccountDeletionRequested)
  router.register('account.deletion_executed', handleAccountDeletionExecuted)
  router.register('email.delivery_requested', handleEmailDeliveryRequested)
  router.register('announcement.published', handleAnnouncementPublished)
  router.register('participation.decided', handleParticipationDecided)
  router.register('team.membership_changed', handleTeamMembershipChanged)
  router.register('challenge.feedback_released', handleFeedbackReleased)

  router.register('challenge.published', handleChallengePublished)
  router.register('challenge.rescheduled', handleChallengeRescheduled)
  router.register('challenge.deadline_extended', handleChallengeDeadlineExtended)
  router.register('challenge.reopened', handleChallengeReopened)
  router.register('challenge.cancelled', handleChallengeCancelled)
  router.register('challenge.results_published', handleResultsPublished)

  router.register('challenge.staff_invitation_created', handleChallengeStaffInvitationCreated)
  router.register('judging.assignment_created', handleJudgeAssignmentCreated)
  router.register('judging.scorecard_submitted', handleScorecardSubmitted)

  router.register('matchmaking.interest_expressed', handleMatchmakingInterestExpressed)
  router.register('reminder.due', handleReminderDue)

  router.register('media.asset_deletion_requested', handleMediaAssetDeletionRequested)
  router.register('file.scan_requested', handleFileScanRequested)
  router.register('file.deletion_requested', handleFileDeletionRequested)

  router.register('webhook.resend_event_received', handleResendWebhookEventReceived)

  router.register('support_ticket.updated', handleSupportTicketUpdated)

  router.register('submission.finalized', handleSubmissionFinalized)

  router.register('export.requested', handleExportRequested)

  router.register('innovation.stage_changed', handleInnovationStageChanged)
  router.register('integration.delivery_requested', handleIntegrationDeliveryRequested)

  const registered = new Set(router.registeredEventTypes())
  const missing = ALL_DOMAIN_EVENT_TYPES.filter((eventType) => !registered.has(eventType))
  const undeclared = [...registered].filter(
    (eventType) => !ALL_DOMAIN_EVENT_TYPES.includes(eventType as never),
  )
  if (missing.length > 0 || undeclared.length > 0) {
    throw new Error(
      `Domain event handler catalogue mismatch: missing=[${missing.join(', ')}], ` +
        `undeclared=[${undeclared.join(', ')}].`,
    )
  }

  return router
}
