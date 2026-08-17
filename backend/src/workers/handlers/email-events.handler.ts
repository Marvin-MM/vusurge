import { notifyUser } from '../../modules/notifications/notify'
import { EmailCategory, EmailTemplates } from '../../shared/email'
import { enqueueJobEmail } from '../email-obligation'
import type { JobContext, JobHandler } from '../job-router'

/**
 * Handlers for the transactional-email outbox events written by the
 * identity/tenancy modules built so far.
 *
 * Each handler creates a separate, encrypted, locally de-duplicated delivery
 * obligation. Provider delivery and retry state therefore cannot hold the
 * source domain event hostage or be lost when the provider is unavailable.
 */

interface OrganizationApplicationDecidedPayload {
  applicantUserId: string
  organizationName: string
  approved: boolean
  reason?: string
}

interface OrganizationInvitationCreatedPayload {
  email: string
  token: string
  role: string
  organizationName: string
}

interface OrganizationJoinRequestDecidedPayload {
  userId: string
  organizationName: string
  approved: boolean
  reason?: string
}

interface TeamInvitationCreatedPayload {
  invitationId: string
  invitedUserId: string
  teamId: string
  teamName: string
  token: string
}

interface AccountDeletionRequestedPayload {
  userId: string
  eligibleAt: string
}

async function resolveEmail(context: JobContext, userId: string): Promise<string | null> {
  const user = await context.infrastructure.database.client.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  })
  return user?.email ?? null
}

export const handleOrganizationApplicationDecided: JobHandler = async (context) => {
  const payload = context.payload as unknown as OrganizationApplicationDecidedPayload
  const email = await resolveEmail(context, payload.applicantUserId)
  if (email === null) {
    // The account no longer exists; nothing to deliver. Not a retryable failure.
    return
  }

  const { subject, text } = EmailTemplates.organizationApplicationDecisionEmail({
    organizationName: payload.organizationName,
    approved: payload.approved,
    reason: payload.reason,
    dashboardUrl: `${context.infrastructure.config.app.webAppBaseUrl}/organizations`,
  })

  await enqueueJobEmail(context, {
    to: email,
    recipientUserId: payload.applicantUserId,
    category: EmailCategory.OrganizationApplicationDecision,
    subject,
    text,
    sourceType: 'organization_application.decided',
    sourceKey: `org-application-decided:${context.outboxEventId}:${payload.applicantUserId}`,
  })

  await notifyUser(context.infrastructure.transactions, {
    userId: payload.applicantUserId,
    sourceKey: `${context.outboxEventId}:${payload.applicantUserId}:application-decision-notification`,
    category: 'ORGANIZATION_APPLICATION_DECISION',
    title: payload.approved
      ? `${payload.organizationName} approved`
      : `${payload.organizationName} update`,
    body: subject,
  })
}

export const handleOrganizationInvitationCreated: JobHandler = async (context) => {
  const payload = context.payload as unknown as OrganizationInvitationCreatedPayload

  const acceptUrl = `${context.infrastructure.config.app.webAppBaseUrl}/invitations/${payload.token}/accept`
  const { subject, text } = EmailTemplates.organizationInviteEmail({
    organizationName: payload.organizationName,
    inviterName: 'An organizer',
    acceptUrl,
    role: payload.role,
  })

  // The invitee may not have an account yet — only fan out an in-app
  // notification when one already exists to receive it.
  const invitee = await context.infrastructure.database.client.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  })
  await enqueueJobEmail(context, {
    to: payload.email,
    ...(invitee === null ? {} : { recipientUserId: invitee.id }),
    category: EmailCategory.OrganizationInvite,
    subject,
    text,
    sourceType: 'organization_invitation.created',
    sourceKey: `org-invitation:${context.outboxEventId}:${payload.email.toLowerCase()}`,
  })
  if (invitee !== null) {
    await notifyUser(context.infrastructure.transactions, {
      userId: invitee.id,
      sourceKey: `${context.outboxEventId}:${invitee.id}:organization-invite-notification`,
      organizationId: context.organizationId ?? undefined,
      category: 'ORGANIZATION_INVITE',
      title: `Invited to join ${payload.organizationName}`,
      body: subject,
    })
  }
}

export const handleTeamInvitationCreated: JobHandler = async (context) => {
  const payload = context.payload as unknown as TeamInvitationCreatedPayload
  const email = await resolveEmail(context, payload.invitedUserId)
  if (email === null) return

  const acceptUrl = `${context.infrastructure.config.app.webAppBaseUrl}/team-invitations/${payload.token}/accept`
  const { subject, text } = EmailTemplates.teamInvitationEmail({
    teamName: payload.teamName,
    acceptUrl,
  })

  await enqueueJobEmail(context, {
    to: email,
    recipientUserId: payload.invitedUserId,
    category: EmailCategory.TeamInvitation,
    subject,
    text,
    sourceType: 'team.invitation_created',
    sourceKey: `team-invitation:${context.outboxEventId}:${payload.invitedUserId}`,
  })

  await notifyUser(context.infrastructure.transactions, {
    userId: payload.invitedUserId,
    sourceKey: `${context.outboxEventId}:${payload.invitedUserId}:team-invite-notification`,
    organizationId: context.organizationId ?? undefined,
    category: 'TEAM_INVITATION',
    title: subject,
    body: `You've been invited to join the team "${payload.teamName}".`,
  })
}

export const handleOrganizationJoinRequestDecided: JobHandler = async (context) => {
  const payload = context.payload as unknown as OrganizationJoinRequestDecidedPayload
  const email = await resolveEmail(context, payload.userId)
  if (email === null) return

  const { subject, text } = EmailTemplates.joinRequestDecisionEmail({
    organizationName: payload.organizationName,
    approved: payload.approved,
    reason: payload.reason,
    dashboardUrl: `${context.infrastructure.config.app.webAppBaseUrl}/organizations`,
  })

  await enqueueJobEmail(context, {
    to: email,
    recipientUserId: payload.userId,
    category: EmailCategory.ParticipationDecision,
    subject,
    text,
    sourceType: 'organization_join_request.decided',
    sourceKey: `join-request-decided:${context.outboxEventId}:${payload.userId}`,
  })

  await notifyUser(context.infrastructure.transactions, {
    userId: payload.userId,
    sourceKey: `${context.outboxEventId}:${payload.userId}:join-decision-notification`,
    organizationId: context.organizationId ?? undefined,
    category: 'PARTICIPATION_DECISION',
    title: subject,
    body: payload.approved
      ? `Your request to join ${payload.organizationName} was approved.`
      : `Your request to join ${payload.organizationName} was not approved.`,
  })
}

export const handleAccountDeletionRequested: JobHandler = async (context) => {
  const payload = context.payload as unknown as AccountDeletionRequestedPayload
  const email = await resolveEmail(context, payload.userId)
  if (email === null) return

  const { subject, text } = EmailTemplates.accountDeletionRequestedEmail({
    eligibleAtDisplay: payload.eligibleAt.slice(0, 10),
    cancelUrl: `${context.infrastructure.config.app.webAppBaseUrl}/settings/account`,
  })

  await enqueueJobEmail(context, {
    to: email,
    recipientUserId: payload.userId,
    category: EmailCategory.AccountDeletionRequested,
    subject,
    text,
    sourceType: 'account.deletion_requested',
    sourceKey: `account-deletion-requested:${context.outboxEventId}:${payload.userId}`,
    disableTracking: true,
  })

  // No in-app notification fan-out here: there is no NotificationCategory
  // for account deletion, and adding one for this single, rare, already
  // security-emailed event is not proportionate to a schema migration
  // (NotificationCategory is a Postgres enum, not a free-text column).
}
