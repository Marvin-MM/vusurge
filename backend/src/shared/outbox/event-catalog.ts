import { QueueName, type QueueName as QueueNameType } from '../queue'

/** Authoritative domain-event to queue contract. */
export const DOMAIN_EVENT_CATALOG = {
  'account.deletion_requested': QueueName.Reminders,
  'account.deletion_executed': QueueName.CacheMaintenance,
  'challenge.cancelled': QueueName.NotificationFanout,
  'challenge.deadline_extended': QueueName.NotificationFanout,
  'challenge.published': QueueName.NotificationFanout,
  'challenge.reopened': QueueName.NotificationFanout,
  'challenge.rescheduled': QueueName.NotificationFanout,
  'challenge.results_published': QueueName.NotificationFanout,
  'challenge.staff_invitation_created': QueueName.Email,
  'challenge.feedback_released': QueueName.NotificationFanout,
  'announcement.published': QueueName.NotificationFanout,
  'email.delivery_requested': QueueName.Email,
  'export.requested': QueueName.Exports,
  'file.deletion_requested': QueueName.MediaCleanup,
  'file.scan_requested': QueueName.MediaCleanup,
  'innovation.stage_changed': QueueName.NotificationFanout,
  'integration.delivery_requested': QueueName.Integrations,
  'judging.assignment_created': QueueName.Email,
  'judging.scorecard_submitted': QueueName.NotificationFanout,
  'matchmaking.interest_expressed': QueueName.NotificationFanout,
  'media.asset_deletion_requested': QueueName.MediaCleanup,
  'organization_application.decided': QueueName.Email,
  'organization_invitation.created': QueueName.Email,
  'organization_join_request.decided': QueueName.Email,
  'participation.decided': QueueName.NotificationFanout,
  'reminder.due': QueueName.Reminders,
  'submission.finalized': QueueName.NotificationFanout,
  'support_ticket.updated': QueueName.Email,
  'team.invitation_created': QueueName.Email,
  'team.membership_changed': QueueName.NotificationFanout,
  'webhook.resend_event_received': QueueName.Email,
} as const satisfies Record<string, QueueNameType>

export type DomainEventType = keyof typeof DOMAIN_EVENT_CATALOG

export const ALL_DOMAIN_EVENT_TYPES = Object.freeze(
  Object.keys(DOMAIN_EVENT_CATALOG).sort() as DomainEventType[],
)

export function expectedQueueFor(eventType: DomainEventType): QueueNameType {
  return DOMAIN_EVENT_CATALOG[eventType]
}
