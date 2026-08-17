/**
 * The transactional email boundary.
 *
 * Every part of the system that sends email depends on this interface, never
 * on Resend directly (master prompt section 4.2). That is what makes a real
 * second provider addable later without touching a single call site, and what
 * lets tests substitute an in-memory fake instead of hitting a real API.
 *
 * Emails are plain text, never HTML. The backend stores and returns Markdown
 * source verbatim and never renders it — including in email — which removes
 * an entire class of email-borne XSS/HTML-injection risk (master prompt
 * section 37, threat class 11). Any link the recipient should follow is a
 * plain URL in the text body.
 */

export interface EmailMessage {
  readonly to: string
  /** Stable category used for suppression policy and observability. */
  readonly category: EmailCategory
  readonly subject: string
  /** Plain text only. Never HTML. */
  readonly text: string
  /**
   * Deduplicates retried sends at the provider. Required for every category:
   * a retried "final submission confirmed" email must not resend N times.
   */
  readonly idempotencyKey: string
  /** Disables open/click tracking. Required for auth/security categories. */
  readonly disableTracking?: boolean
}

/**
 * The fixed set of email categories (master prompt section 21). Centralising
 * them is what lets the suppression and observability layers reason about
 * "is this a security email that must never be suppressed" in one place.
 */
export const EmailCategory = {
  Verification: 'verification',
  PasswordReset: 'password_reset',
  OrganizationInvite: 'organization_invite',
  ChallengeStaffInvite: 'challenge_staff_invite',
  OrganizationApplicationDecision: 'organization_application_decision',
  ParticipationDecision: 'participation_decision',
  Announcement: 'announcement',
  TeamInvitation: 'team_invitation',
  DeadlineReminder: 'deadline_reminder',
  DeadlineChanged: 'deadline_changed',
  SubmissionConfirmation: 'submission_confirmation',
  JudgingAssignment: 'judging_assignment',
  JudgingReminder: 'judging_reminder',
  ResultsPublished: 'results_published',
  FeedbackReleased: 'feedback_released',
  SupportTicketUpdate: 'support_ticket_update',
  AccountDeletionRequested: 'account_deletion_requested',
} as const

export type EmailCategory = (typeof EmailCategory)[keyof typeof EmailCategory]

/** Categories a user is never permitted to disable via notification preferences. */
export const SECURITY_EMAIL_CATEGORIES: ReadonlySet<EmailCategory> = new Set([
  EmailCategory.Verification,
  EmailCategory.PasswordReset,
  EmailCategory.OrganizationApplicationDecision,
  EmailCategory.AccountDeletionRequested,
])

export interface EmailSendResult {
  readonly providerMessageId: string
  readonly suppressed: boolean
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>
}

/** Provider failures expose retryability without leaking provider-specific types. */
export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'EmailProviderError'
  }
}

export function isRetryableEmailProviderError(error: unknown): boolean {
  return error instanceof EmailProviderError ? error.retryable : true
}
