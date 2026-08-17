/**
 * The catalogue of auditable actions.
 *
 * Every high-value business or security change in master prompt section 29 has
 * a stable name here. Centralising them keeps the audit log queryable and stops
 * two modules inventing different names for the same event.
 *
 * Documented for operators in docs/audit-events.md.
 */
export const AuditAction = {
  // Organization applications and lifecycle
  OrganizationApplicationSubmitted: 'organization_application.submitted',
  OrganizationApplicationUpdated: 'organization_application.updated',
  OrganizationApplicationResubmitted: 'organization_application.resubmitted',
  OrganizationApplicationApproved: 'organization_application.approved',
  OrganizationApplicationRejected: 'organization_application.rejected',
  OrganizationCreated: 'organization.created',
  OrganizationProfileUpdated: 'organization.profile_updated',
  OrganizationSettingsUpdated: 'organization.settings_updated',
  OrganizationVisibilityChanged: 'organization.visibility_changed',
  OrganizationJoinPolicyChanged: 'organization.join_policy_changed',
  OrganizationSuspended: 'organization.suspended',
  OrganizationReinstated: 'organization.reinstated',
  OrganizationArchived: 'organization.archived',
  OrganizationLimitsChanged: 'organization.limits_changed',

  // Membership and roles
  MembershipCreated: 'organization.membership.created',
  MembershipRoleChanged: 'organization.membership.role_changed',
  MembershipRemoved: 'organization.membership.removed',
  MembershipReactivated: 'organization.membership.reactivated',
  OwnershipTransferred: 'organization.ownership_transferred',

  // Invitations, join codes, join requests
  InvitationCreated: 'organization.invitation.created',
  InvitationRevoked: 'organization.invitation.revoked',
  InvitationResent: 'organization.invitation.resent',
  InvitationAccepted: 'organization.invitation.accepted',
  InvitationDeclined: 'organization.invitation.declined',
  JoinCodeCreated: 'organization.join_code.created',
  JoinCodeRevoked: 'organization.join_code.revoked',
  JoinCodeRedeemed: 'organization.join_code.redeemed',
  JoinRequestSubmitted: 'organization.join_request.submitted',
  JoinRequestWithdrawn: 'organization.join_request.withdrawn',
  JoinRequestApproved: 'organization.join_request.approved',
  JoinRequestRejected: 'organization.join_request.rejected',

  // Challenges
  ChallengeCreated: 'challenge.created',
  ChallengeUpdated: 'challenge.updated',
  ChallengePublished: 'challenge.published',
  ChallengeRescheduled: 'challenge.rescheduled',
  ChallengeDeadlineExtended: 'challenge.deadline_extended',
  ChallengeDeadlineShortened: 'challenge.deadline_shortened',
  ChallengeReopened: 'challenge.reopened',
  ChallengeCancelled: 'challenge.cancelled',
  ChallengeArchived: 'challenge.archived',
  ChallengeTrackCreated: 'challenge.track.created',
  ChallengeTrackUpdated: 'challenge.track.updated',
  ChallengeTrackArchived: 'challenge.track.archived',
  ChallengePrizeChanged: 'challenge.prize.changed',
  ChallengeSponsorChanged: 'challenge.sponsor.changed',

  // Terms and consent
  TermsVersionCreated: 'challenge.terms_version.created',
  TermsVersionActivated: 'challenge.terms_version.activated',
  TermsAccepted: 'challenge.terms.accepted',

  // Forms
  FormCreated: 'form.created',
  FormUpdated: 'form.updated',
  FormVersionCreated: 'form.version.created',
  FormVersionPublished: 'form.version.published',
  FormResponseSubmitted: 'form.response.submitted',

  // Participation
  ParticipationRegistered: 'participation.registered',
  ParticipationApplicationSubmitted: 'participation.application_submitted',
  ParticipationApplicationDraftSaved: 'participation.application_draft_saved',
  ParticipationApproved: 'participation.approved',
  ParticipationRejected: 'participation.rejected',
  ParticipationWithdrawn: 'participation.withdrawn',
  ParticipationDisqualified: 'participation.disqualified',
  ParticipationReinstated: 'participation.reinstated',

  // Teams
  TeamCreated: 'team.created',
  TeamUpdated: 'team.updated',
  TeamInvitationCreated: 'team.invitation.created',
  TeamInvitationRevoked: 'team.invitation.revoked',
  TeamInvitationDeclined: 'team.invitation.declined',
  TeamMemberJoined: 'team.member.joined',
  TeamMemberLeft: 'team.member.left',
  TeamMemberRemoved: 'team.member.removed',
  TeamCaptainTransferred: 'team.captain_transferred',
  TeamOrganizerException: 'team.organizer_exception',

  // Matchmaking
  MatchmakingPostCreated: 'matchmaking.post.created',
  MatchmakingPostUpdated: 'matchmaking.post.updated',
  MatchmakingPostClosed: 'matchmaking.post.closed',
  MatchmakingPostDeleted: 'matchmaking.post.deleted',
  MatchmakingInterestExpressed: 'matchmaking.interest.expressed',

  // Submissions
  SubmissionCreated: 'submission.created',
  SubmissionDraftSaved: 'submission.draft_saved',
  SubmissionFinalized: 'submission.finalized',
  SubmissionReopened: 'submission.reopened',
  SubmissionDisqualified: 'submission.disqualified',
  SubmissionReinstated: 'submission.reinstated',

  // Judging
  ChallengeStaffInvited: 'judging.staff_invited',
  ChallengeStaffInvitationRevoked: 'judging.staff_invitation_revoked',
  ChallengeStaffAccepted: 'judging.staff_accepted',
  ChallengeStaffRemoved: 'judging.staff_removed',
  RubricCreated: 'judging.rubric.created',
  RubricVersionCreated: 'judging.rubric_version.created',
  RubricVersionActivated: 'judging.rubric_version.activated',
  JudgeAssigned: 'judging.assignment.created',
  JudgeAssignmentReassigned: 'judging.assignment.reassigned',
  JudgeAssignmentRemoved: 'judging.assignment.removed',
  JudgeConflictDeclared: 'judging.conflict_declared',
  JudgeRecused: 'judging.recused',
  ScorecardSubmitted: 'judging.scorecard.submitted',
  ScorecardReopened: 'judging.scorecard.reopened',
  JudgingFinalized: 'judging.finalized',
  ResultsFinalized: 'results.finalized',
  ResultsPublished: 'results.published',
  ResultsRetracted: 'results.retracted',
  FeedbackReleased: 'results.feedback_released',

  // Communication
  AnnouncementCreated: 'announcement.created',
  AnnouncementUpdated: 'announcement.updated',
  AnnouncementPublished: 'announcement.published',
  AnnouncementUnpublished: 'announcement.unpublished',
  FaqChanged: 'faq.changed',

  // Integrations
  IntegrationCreated: 'integration.created',
  IntegrationUpdated: 'integration.updated',
  IntegrationCredentialRotated: 'integration.credential_rotated',
  IntegrationDeleted: 'integration.deleted',
  IntegrationDeliveryRequested: 'integration.delivery_requested',
  IntegrationTested: 'integration.tested',

  // Media and files
  MediaAssetClaimed: 'media.asset_claimed',
  MediaAssetDeletionRequested: 'media.asset_deletion_requested',
  MediaAssetDeleted: 'media.asset_deleted',
  FileUploaded: 'file.uploaded',
  FileDeletionRequested: 'file.deletion_requested',
  FileDeleted: 'file.deleted',
  FileQuarantined: 'file.quarantined',

  // Exports and analytics
  ExportRequested: 'export.requested',
  ExportDownloaded: 'export.downloaded',
  ExportDeleted: 'export.deleted',

  // Innovation portfolio
  InnovationCreated: 'innovation.created',
  InnovationUpdated: 'innovation.updated',
  InnovationPromotedFromSubmission: 'innovation.promoted_from_submission',
  InnovationStageChanged: 'innovation.stage_changed',
  InnovationMilestoneChanged: 'innovation.milestone_changed',
  InnovationEvidenceChanged: 'innovation.evidence_changed',
  InnovationMetricChanged: 'innovation.metric_changed',

  // Support and moderation
  SupportTicketCreated: 'support.ticket_created',
  SupportTicketStatusChanged: 'support.ticket_status_changed',
  SupportTicketAssigned: 'support.ticket_assigned',
  SupportTicketPriorityChanged: 'support.ticket_priority_changed',
  SupportTicketResolved: 'support.ticket_resolved',
  ContentReported: 'moderation.content_reported',
  ContentReportDismissed: 'moderation.report_dismissed',
  ContentReportActionTaken: 'moderation.report_action_taken',
  ContentHidden: 'moderation.content_hidden',
  ContentRestored: 'moderation.content_restored',

  // Email deliverability
  EmailSuppressed: 'email.suppressed',

  // Platform and account security
  PlatformRoleGranted: 'platform.role_granted',
  PlatformRoleRevoked: 'platform.role_revoked',
  PlatformFeatureFlagChanged: 'platform.feature_flag_changed',
  PlatformAuditAccessed: 'platform.audit_accessed',
  AccountDeletionRequested: 'account.deletion_requested',
  AccountDeletionCancelled: 'account.deletion_cancelled',
  AccountDeletionApplied: 'account.deletion_applied',
} as const

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]
