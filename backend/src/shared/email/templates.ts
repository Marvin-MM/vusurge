/**
 * Plain-text email bodies.
 *
 * Every template renders to plain text only — no HTML, ever (see the note on
 * `EmailProvider`). Keeping the copy here, rather than scattered across
 * modules, is what keeps tone and structure consistent across the ~13 email
 * categories.
 */

export interface VerificationEmailInput {
  readonly displayName: string
  readonly verificationUrl: string
}

export function verificationEmail(input: VerificationEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: 'Verify your email address',
    text: [
      `Hi ${input.displayName},`,
      '',
      'Confirm your email address to finish setting up your account:',
      input.verificationUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  }
}

export interface PasswordResetEmailInput {
  readonly displayName: string
  readonly resetUrl: string
}

export function passwordResetEmail(input: PasswordResetEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: 'Reset your password',
    text: [
      `Hi ${input.displayName},`,
      '',
      'A password reset was requested for your account. Use the link below to choose a new password:',
      input.resetUrl,
      '',
      'This link expires shortly. If you did not request this, you can ignore this email and your password will not change.',
    ].join('\n'),
  }
}

export interface OrganizationInviteEmailInput {
  readonly organizationName: string
  readonly inviterName: string
  readonly acceptUrl: string
  readonly role: string
}

export function organizationInviteEmail(input: OrganizationInviteEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: `You've been invited to join ${input.organizationName}`,
    text: [
      `${input.inviterName} has invited you to join ${input.organizationName} as ${input.role}.`,
      '',
      'Accept the invitation:',
      input.acceptUrl,
      '',
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n'),
  }
}

export interface TeamInvitationEmailInput {
  readonly teamName: string
  readonly acceptUrl: string
}

export function teamInvitationEmail(input: TeamInvitationEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: `You've been invited to join team "${input.teamName}"`,
    text: [
      `You've been invited to join the team "${input.teamName}" for a challenge.`,
      '',
      'Accept the invitation:',
      input.acceptUrl,
      '',
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n'),
  }
}

export interface OrganizationApplicationDecisionEmailInput {
  readonly organizationName: string
  readonly approved: boolean
  readonly reason?: string
  readonly dashboardUrl: string
}

export function organizationApplicationDecisionEmail(
  input: OrganizationApplicationDecisionEmailInput,
): { subject: string; text: string } {
  if (input.approved) {
    return {
      subject: `${input.organizationName} has been approved`,
      text: [
        `Your application to create ${input.organizationName} has been approved.`,
        '',
        `You are now the owner of ${input.organizationName}.`,
        '',
        'Get started:',
        input.dashboardUrl,
      ].join('\n'),
    }
  }

  return {
    subject: `An update on your application for ${input.organizationName}`,
    text: [
      `Your application to create ${input.organizationName} was not approved.`,
      ...(input.reason ? ['', `Reason: ${input.reason}`] : []),
      '',
      'You may revise and resubmit your application from your dashboard:',
      input.dashboardUrl,
    ].join('\n'),
  }
}

export interface JoinRequestDecisionEmailInput {
  readonly organizationName: string
  readonly approved: boolean
  readonly reason?: string
  readonly dashboardUrl: string
}

export function joinRequestDecisionEmail(input: JoinRequestDecisionEmailInput): {
  subject: string
  text: string
} {
  if (input.approved) {
    return {
      subject: `You've joined ${input.organizationName}`,
      text: [
        `Your request to join ${input.organizationName} has been approved.`,
        '',
        input.dashboardUrl,
      ].join('\n'),
    }
  }
  return {
    subject: `An update on your request to join ${input.organizationName}`,
    text: [
      `Your request to join ${input.organizationName} was not approved.`,
      ...(input.reason ? ['', `Reason: ${input.reason}`] : []),
    ].join('\n'),
  }
}

export interface ChallengeStaffInviteEmailInput {
  readonly challengeTitle: string
  readonly role: string
  readonly acceptUrl: string
}

export function challengeStaffInviteEmail(input: ChallengeStaffInviteEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: `You've been invited to ${input.role.toLowerCase()} "${input.challengeTitle}"`,
    text: [
      `You've been invited to serve as a ${input.role.toLowerCase()} for "${input.challengeTitle}".`,
      'This does not make you a member of the organizing organization.',
      '',
      'Accept the invitation:',
      input.acceptUrl,
      '',
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n'),
  }
}

export interface JudgingAssignmentEmailInput {
  readonly dashboardUrl: string
}

export function judgingAssignmentEmail(input: JudgingAssignmentEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: 'A submission has been assigned to you for judging',
    text: [
      'A submission has been assigned to you for judging.',
      '',
      'Review it and submit your scorecard:',
      input.dashboardUrl,
    ].join('\n'),
  }
}

export interface ResultsPublishedEmailInput {
  readonly challengeTitle: string
  readonly resultsUrl: string
}

export function resultsPublishedEmail(input: ResultsPublishedEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: `Results are live: ${input.challengeTitle}`,
    text: [`Results for "${input.challengeTitle}" have been published.`, '', input.resultsUrl].join(
      '\n',
    ),
  }
}

export interface SupportTicketUpdateEmailInput {
  readonly subject: string
  readonly summary: string
  readonly ticketUrl: string
}

export function supportTicketUpdateEmail(input: SupportTicketUpdateEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: `Update on your support ticket: ${input.subject}`,
    text: [input.summary, '', 'View the ticket:', input.ticketUrl].join('\n'),
  }
}

export interface AccountDeletionRequestedEmailInput {
  readonly eligibleAtDisplay: string
  readonly cancelUrl: string
}

export function accountDeletionRequestedEmail(input: AccountDeletionRequestedEmailInput): {
  subject: string
  text: string
} {
  return {
    subject: 'Your account deletion request',
    text: [
      "We've received your request to delete your account.",
      '',
      `Your account will be permanently deleted on ${input.eligibleAtDisplay} unless you cancel first.`,
      '',
      'Changed your mind? Cancel the request here:',
      input.cancelUrl,
      '',
      'If you did not request this, cancel it immediately using the link above and contact support.',
    ].join('\n'),
  }
}
