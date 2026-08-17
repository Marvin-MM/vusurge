/**
 * Named permissions.
 *
 * Authorization is expressed as "does this actor hold permission X in this
 * organization", never as "is this actor an admin". Named permissions keep the
 * policy readable, make the permissions matrix documentable, and mean a role
 * change is a data change in one table rather than a scattered edit across
 * every route.
 *
 * Deny by default: a permission that is not explicitly granted to a role is
 * denied. There is no wildcard grant.
 */
export const Permission = {
  // --- Organization --------------------------------------------------------
  OrganizationViewPrivate: 'organization.view_private',
  OrganizationManageSettings: 'organization.manage_settings',
  OrganizationManageProfile: 'organization.manage_profile',
  OrganizationManageMembers: 'organization.manage_members',
  OrganizationManageRoles: 'organization.manage_roles',
  OrganizationTransferOwnership: 'organization.transfer_ownership',
  OrganizationArchive: 'organization.archive',
  OrganizationManageInvitations: 'organization.manage_invitations',
  OrganizationManageJoinCodes: 'organization.manage_join_codes',
  OrganizationReviewJoinRequests: 'organization.review_join_requests',
  OrganizationManageIntegrations: 'organization.manage_integrations',
  OrganizationViewAudit: 'organization.view_audit',
  OrganizationManageForms: 'organization.manage_forms',
  OrganizationManageAnnouncements: 'organization.manage_announcements',
  OrganizationManageFaqs: 'organization.manage_faqs',

  // --- Challenge -----------------------------------------------------------
  ChallengeCreate: 'challenge.create',
  ChallengeEdit: 'challenge.edit',
  ChallengeView: 'challenge.view',
  ChallengePublish: 'challenge.publish',
  ChallengeChangeSchedule: 'challenge.change_schedule',
  ChallengeCancel: 'challenge.cancel',
  ChallengeArchive: 'challenge.archive',
  ChallengeManageTracks: 'challenge.manage_tracks',
  ChallengeManagePrizes: 'challenge.manage_prizes',
  ChallengeManageSponsors: 'challenge.manage_sponsors',
  ChallengeManageTerms: 'challenge.manage_terms',
  ChallengeManageParticipants: 'challenge.manage_participants',
  ChallengeManageTeams: 'challenge.manage_teams',
  ChallengeManageJudges: 'challenge.manage_judges',
  ChallengeManageRubric: 'challenge.manage_rubric',
  ChallengePublishResults: 'challenge.publish_results',

  // --- Submission ----------------------------------------------------------
  SubmissionCreate: 'submission.create',
  SubmissionEditOwn: 'submission.edit_own',
  SubmissionSubmit: 'submission.submit',
  SubmissionViewAll: 'submission.view_all',
  SubmissionDisqualify: 'submission.disqualify',
  SubmissionReopen: 'submission.reopen',

  // --- Judging -------------------------------------------------------------
  JudgingViewAssigned: 'judging.view_assigned',
  JudgingScoreAssigned: 'judging.score_assigned',
  JudgingViewProgress: 'judging.view_progress',
  JudgingReopenScorecard: 'judging.reopen_scorecard',
  JudgingFinalize: 'judging.finalize',
  JudgingReleaseFeedback: 'judging.release_feedback',

  // --- Mentoring -----------------------------------------------------------
  MentoringViewAssigned: 'mentoring.view_assigned',

  // --- Analytics and exports ----------------------------------------------
  AnalyticsViewOrg: 'analytics.view_org',
  AnalyticsExportSensitive: 'analytics.export_sensitive',

  // --- Innovation portfolio ------------------------------------------------
  InnovationView: 'innovation.view',
  InnovationManage: 'innovation.manage',
  InnovationTransitionStage: 'innovation.transition_stage',

  // --- Platform ------------------------------------------------------------
  PlatformReviewApplications: 'platform.review_applications',
  PlatformManageOrganizations: 'platform.manage_organizations',
  PlatformModerate: 'platform.moderate',
  PlatformSupport: 'platform.support',
  PlatformViewAudit: 'platform.view_audit',
  PlatformManageFeatureFlags: 'platform.manage_feature_flags',
  PlatformManageRoles: 'platform.manage_roles',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission)
