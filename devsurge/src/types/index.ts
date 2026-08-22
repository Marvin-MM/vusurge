// DevArena Core Domain Types & Enums
//
// These enums mirror the real backend's Prisma schema / permission catalogue
// exactly (see backend/docs/permissions-matrix.md, challenge-states.md,
// organization-states.md) — they are NOT independently invented. Where a
// value below has no backend equivalent, it is a client-side-only sentinel
// and is documented as such.

/**
 * "PLATFORM_SUPERADMIN" and "PLATFORM_SUPPORT_AGENT" are real backend
 * PlatformRole values (assigned via a separate PlatformRoleAssignment
 * table). "USER" is a client-side sentinel meaning "no platform role
 * assigned" — most accounts — the backend has no literal "USER" role.
 */
export type GlobalRole = "PLATFORM_SUPERADMIN" | "PLATFORM_SUPPORT_AGENT" | "USER";

export type OrgRole =
  | "ORG_OWNER"
  | "ORG_ADMIN"
  | "CHALLENGE_MANAGER"
  | "MEMBER";

/**
 * "JUDGE"/"MENTOR" are real, challenge-scoped ChallengeStaffRole values —
 * NOT organization membership. "PARTICIPANT" is a client-side convenience
 * representing an APPROVED ChallengeParticipation, which the backend does
 * not model as a "role" at all (see CHALLENGE_PARTICIPANT_PERMISSIONS in
 * permissions.ts). There is no "CHALLENGE_LEAD" role on the backend —
 * challenge management is the organization-level CHALLENGE_MANAGER role.
 */
export type ChallengeRole = "PARTICIPANT" | "JUDGE" | "MENTOR";

export type OrgVisibility = "PUBLIC" | "PRIVATE";
export type OrgStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
/** Independent of visibility and status. See docs/organization-states.md. */
export type OrgJoinPolicy = "INVITE_ONLY" | "CODE_OR_INVITE" | "REQUEST_TO_JOIN" | "OPEN";
export type ApplicationStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";

/**
 * The backend's Challenge model has no "type" taxonomy field — this is a
 * client-side-only display concept with no server backing. Do not gate any
 * eligibility/permission logic on it.
 */
export type ChallengeType =
  | "HACKATHON"
  | "INNOVATION_CHALLENGE"
  | "BOUNTY"
  | "ACCELERATOR"
  | "DATA_COMPETITION"
  | string;

/**
 * The real, persisted ChallengeStatus enum. "CLOSED" is deliberately never
 * persisted by the backend — a challenge whose submissionDeadline has
 * passed stays literally "OPEN" in the database. Never compare a challenge's
 * status against the literal string "CLOSED"; use
 * `src/lib/challengeStatus.ts`'s `isEffectivelyClosed()` instead, which
 * derives it the same way the backend's own business logic does.
 */
export type ChallengeStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "OPEN"
  | "JUDGING"
  | "RESULTS_READY"
  | "RESULTS_PUBLISHED"
  | "ARCHIVED"
  | "CANCELLED";

/** Who may register for a challenge. Independent of visibility. */
export type ChallengeParticipationPolicy =
  | "ORG_MEMBERS_ONLY"
  | "APPROVED_CHALLENGE_PARTICIPANTS"
  | "OPEN_AUTHENTICATED";

export type SubmissionStatus = "DRAFT" | "FINALIZED" | "DISQUALIFIED";

export type ParticipationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "DISQUALIFIED";

/** Matches the backend's TeamMemberRole enum. */
export type TeamRole = "CAPTAIN" | "MEMBER";

export interface Skill {
  id: string;
  name: string;
  category: "ENGINEERING" | "DESIGN" | "PRODUCT" | "AI_ML" | "BUSINESS" | "OTHER";
}

export interface UserProfile {
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  githubUsername?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  skills: Skill[];
  yearsOfExperience?: number;
  availableForTeams: boolean;
  timezone: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  username: string;
  globalRole: GlobalRole;
  avatarUrl?: string;
  createdAt: string;
  twoFactorEnabled: boolean;
  profile: UserProfile;
}

export interface ApplicationReviewNote {
  id: string;
  authorId: string;
  authorName: string;
  note: string;
  createdAt: string;
}

export interface ApplicationEvidence {
  id: string;
  title: string;
  type: "BUSINESS_REGISTRATION" | "TAX_DOCUMENT" | "DOMAIN_VERIFICATION" | "IDENTITY_PROOF" | "LINK";
  url?: string;
  documentNumber?: string;
  verified?: boolean;
}

/** Verified against `POST/GET .../organization-applications` — the applicant's own identity is derived server-side from the session, never submitted as a field. */
export interface OrganizationApplication {
  id: string;
  name: string;
  requestedSlug: string;
  /** Free-form on the backend (VarChar), not a closed enum. */
  organizationType: string;
  description: string;
  websiteUrl?: string | null;
  socialLinks?: Record<string, string>;
  country?: string | null;
  region?: string | null;
  affiliatedInstitution?: string | null;
  requesterRelationship: string;
  requestedVisibility: OrgVisibility;
  status: ApplicationStatus;
  submittedAt: string | null;
  reviewedAt?: string | null;
  decisionReason?: string | null;
  createdOrganizationId?: string | null;
  createdAt: string;
}

/**
 * The real shape of `GET/PATCH /organizations/:id/settings` — a narrow,
 * distinct resource, not embedded in the `Organization` object itself.
 * Every field below is verified against backend/docs/openapi.json; there is
 * no customDomain/brandColor/timezone/notificationDefaults concept
 * server-side.
 */
export interface OrgSettings {
  joinPolicy: OrgJoinPolicy;
  allowedEmailDomains: string[];
  memberDirectoryVisibleToMembers: boolean;
  publicProjectGalleryEnabled: boolean;
  publicMetricsEnabled: boolean;
  publicContactEmail?: string | null;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Free-form on the backend (VarChar), not a closed enum. */
  organizationType: string;
  websiteUrl?: string | null;
  country?: string | null;
  region?: string | null;
  /** Resolve to a displayable URL via useAssetUrl()/resolveAssetUrl() — this is an opaque asset id, never a URL itself. */
  logoAssetId?: string | null;
  /** Present on authenticated org-scoped responses; absent from the public projection (`/public/organizations*`). */
  status?: OrgStatus;
  visibility?: OrgVisibility;
  createdAt: string;
}

export interface Membership {
  userId: string;
  displayName: string | null;
  role: OrgRole;
  status: "ACTIVE" | "INACTIVE";
  joinedAt: string;
  removedAt: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: OrgRole;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  resendCount: number;
}

export interface JoinCode {
  id: string;
  label: string | null;
  role: OrgRole;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  allowedEmailDomains: string[];
  revoked: boolean;
  createdAt: string;
  /** Only present once, in the create-response — never retrievable again afterward. */
  plaintextCode?: string;
}

export interface JoinRequest {
  id: string;
  organizationId: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  message: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
}

export interface IntegrationWebhook {
  id: string;
  organizationId: string;
  provider: "SLACK" | "DISCORD" | "CUSTOM";
  name: string;
  webhookUrl: string;
  endpointUrl?: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
  maskedUrl?: string;
}

export interface Track {
  id: string;
  challengeId: string;
  name: string;
  description: string | null;
  /** Non-null only once archived; tracks are soft-deleted, never hard-deleted. */
  archivedAt?: string | null;
  displayOrder?: number;
  createdAt?: string;
}

/**
 * Prize value is organizer-authored free text ("$5,000 cash + mentorship"),
 * not a structured amount/currency pair — the backend has no numeric prize
 * total to aggregate across a challenge.
 */
export interface Prize {
  id: string;
  challengeId: string;
  title: string;
  description: string | null;
  valueLabel: string;
  trackId?: string | null;
  displayOrder?: number;
  createdAt?: string;
}

export interface Sponsor {
  id: string;
  challengeId: string;
  name: string;
  websiteUrl?: string | null;
  /** Resolve via useAssetUrl()/resolveAssetUrl(), not a direct URL. */
  logoAssetId?: string | null;
  /** Free-form organizer-authored label (e.g. "Gold", "Community") — not a closed enum server-side. */
  tier?: string | null;
  displayOrder?: number;
}

export interface TermsVersion {
  id: string;
  challengeId: string;
  version: string;
  title: string;
  content: string;
  required: boolean;
  effectiveDate: string;
}

/** `backend/src/modules/forms/forms.service.ts`'s fixed field-type catalogue
 * (master prompt section 11) — a closed set validated server-side by AJV,
 * not free-form. */
export type FormFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "URL"
  | "DATE"
  | "CONSENT"
  | "FILE_REF";

export type FormPurpose =
  | "ORGANIZATION_JOIN_REQUEST"
  | "CHALLENGE_PARTICIPATION"
  | "MENTOR_JUDGE_APPLICATION"
  | "POST_EVENT_SURVEY"
  | "PORTFOLIO_STAGE_GATE";

export interface FormFieldDefinition {
  /** Stable machine key the response payload is keyed by — server-validated
   * against `^[a-zA-Z][a-zA-Z0-9_]{0,63}$`, unique within the form. */
  key: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  helpText?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Required for SINGLE_SELECT/MULTI_SELECT — plain strings, not label/value pairs. */
  options?: string[];
  maxSelections?: number;
  /** Required for FILE_REF; the only real value the backend accepts. */
  uploadPurpose?: "FORM_ATTACHMENT";
}

export interface FormSchema {
  fields: FormFieldDefinition[];
}

/** A form's identity — purpose, optional challenge scope, display name.
 * Its actual question set lives entirely on its `FormVersion`s, not here. */
export interface FormDefinition {
  id: string;
  purpose: FormPurpose;
  challengeId: string | null;
  name: string;
  createdAt: string;
}

export interface FormVersion {
  id: string;
  formDefinitionId: string;
  version: number;
  schema: FormSchema;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface FormResponseEntry {
  id: string;
  formVersionId: string;
  userId: string;
  responseData: Record<string, unknown>;
  submittedAt: string;
}

/**
 * Verified against backend/docs/openapi.json's authenticated
 * `GET /organizations/:id/challenges/:id` (superset) and public
 * `GET /public/organizations/:slug/challenges/:slug` (subset) schemas.
 * Tracks/prizes/sponsors are NOT embedded — each is its own sub-resource
 * collection, fetched separately (see Track/Prize/Sponsor above). There is
 * no numeric prize total, tag list, location, or participant/submission
 * count on this object; derive those from their own endpoints where a page
 * actually needs them rather than assuming they ride along here.
 */
export interface Challenge {
  id: string;
  /** Present on authenticated org-scoped responses only. */
  organizationId?: string;
  /** Present on the public projection only. */
  organizationSlug?: string;
  organizationName?: string;
  organization?: Organization;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  /** Client-side-only display taxonomy — the backend has no "type" field. Never gate logic on it. */
  type?: ChallengeType;
  status: ChallengeStatus;
  /** Present on authenticated org-scoped responses only (not in the public projection, which is public by construction). */
  visibility?: "ORG_MEMBERS" | "PUBLIC" | "UNLISTED";
  participationPolicy: ChallengeParticipationPolicy;
  /** Resolve via useAssetUrl()/resolveAssetUrl(), not a direct URL. */
  coverAssetId?: string | null;
  /** IANA time zone. */
  displayTimeZone: string;
  publishedAt: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  submissionOpenAt: string | null;
  /** The authoritative deadline. The backend never persists a "CLOSED"
   * status — use isEffectivelyClosed()/getDisplayStatus() from
   * src/lib/challengeStatus.ts to derive it from this field instead of
   * comparing `status` to a literal. */
  submissionDeadline: string | null;
  judgingStartAt: string | null;
  judgingEndAt: string | null;
  resultsPublishedAt: string | null;
  maxTeamSize: number;
  minTeamSize: number;
  soloParticipationAllowed: boolean;
  /** Present on authenticated org-scoped responses only. */
  screeningRequired?: boolean;
  submissionRequirements?: string | null;
  publicProjectPublicationEnabled?: boolean;
  blindJudgingEnabled?: boolean;
  createdAt: string;
}

/** Verified against `GET .../challenges/:id/participation/me` (nullable when not registered) and `GET /me/challenge-participations` (the cross-challenge list — a narrower projection, see MyParticipationSummary). */
export interface ParticipationRecord {
  id: string;
  challengeId: string;
  status: ParticipationStatus;
  termsVersionId: string | null;
  acceptedTermsAt: string | null;
  appliedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  withdrawnAt: string | null;
  createdAt: string;
}

/** `GET /me/challenge-participations` — the cross-challenge list projection (distinct fields from the single-challenge ParticipationRecord above). */
export interface MyParticipationSummary {
  id: string;
  organizationId: string;
  organizationSlug: string;
  challengeId: string;
  challengeTitle: string;
  status: ParticipationStatus;
  appliedAt: string;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  challengeId: string;
  trackId?: string | null;
  name: string;
  isSolo: boolean;
  members: TeamMember[];
  createdAt: string;
}

/** `GET /me/team-invitations` — the cross-team list projection the participant portal actually has access to. */
export interface TeamInvitation {
  id: string;
  organizationId: string;
  organizationSlug: string;
  challengeId: string;
  teamId: string;
  teamName: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
  expiresAt: string | null;
  createdAt: string;
}

/** `GET /organizations/:orgId/challenges/:challengeId/teams/:teamId/invitations` — the team-scoped projection (captain/organizer view), distinct from the cross-team `TeamInvitation` above. */
export interface TeamMemberInvitation {
  id: string;
  teamId: string;
  invitedUserId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
}

export interface MatchmakingPost {
  id: string;
  challengeId: string;
  posterUserId: string;
  posterTeamId: string | null;
  skillsOffered: string[];
  rolesSought: string[];
  message: string;
  availability: string | null;
  contactPreference: string | null;
  isOpen: boolean;
  createdAt: string;
}

/** A submission's editable content lives entirely in its current `draftVersion` (or a specific historical version) — not on the Submission object itself. */
export interface SubmissionVersion {
  id: string;
  submissionId: string;
  versionNumber: number;
  isFinal: boolean;
  title: string;
  tagline: string | null;
  problemStatement: string | null;
  solutionDescription: string | null;
  impactBeneficiaries: string | null;
  technologyTags: string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  pitchVideoUrl: string | null;
  presentationUrl: string | null;
  supportingLinks: { label: string; url: string }[];
  publicationConsent: boolean;
  termsVersionId: string | null;
  createdAt: string;
}

export interface Submission {
  id: string;
  challengeId: string;
  teamId: string;
  trackId: string | null;
  status: SubmissionStatus;
  /** The current editable/finalized content — null only in the always-null theoretical case before any version exists (in practice every submission is created with one). */
  draftVersion: SubmissionVersion | null;
  screenshots: string[];
  disqualificationReason: string | null;
  createdAt: string;
}

export interface RubricCriterion {
  key: string;
  label: string;
  description?: string;
  minScore: number;
  maxScore: number;
  weight: number;
}

export interface RubricVersion {
  id: string;
  rubricId: string;
  version: number;
  criteria: RubricCriterion[];
  tieBreakPolicy: string | null;
  judgeCommentRules: string | null;
  isActive: boolean;
  activatedAt: string | null;
  createdAt: string;
}

/** A rubric is just a named container — its actual scoring criteria live entirely on its (possibly several) versions. */
export interface Rubric {
  id: string;
  challengeId: string;
  name: string;
  createdAt: string;
}

/** A challenge-scoped judge/mentor assignment — `role` here is the person's staff role (JUDGE/MENTOR), see StaffAssignment. */
export interface StaffAssignment {
  id: string;
  challengeId: string;
  userId: string;
  role: "JUDGE" | "MENTOR";
  status: "ACTIVE" | "REMOVED";
  createdAt: string;
}

export interface StaffInvitation {
  id: string;
  challengeId: string;
  role: "JUDGE" | "MENTOR";
  email: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
}

/** Pairs one staff assignment (a judge) with one submission to score. */
export interface JudgeAssignment {
  id: string;
  challengeId: string;
  organizationId: string;
  staffAssignmentId: string;
  submissionId: string;
  status: "ASSIGNED" | "CONFLICT_DECLARED" | "RECUSED" | "REASSIGNED";
  createdAt: string;
}

export interface JudgingProgress {
  totalAssignments: number;
  draftCount: number;
  submittedCount: number;
  lockedCount: number;
  conflictCount: number;
  recusedCount: number;
}

export interface ScorecardCriterionScore {
  criterionKey: string;
  score: number;
  comment?: string | null;
}

export type ScorecardStatus = "DRAFT" | "SUBMITTED" | "LOCKED";

export interface Scorecard {
  id: string;
  judgeAssignmentId: string;
  rubricVersionId: string;
  status: ScorecardStatus;
  criterionScores: ScorecardCriterionScore[];
  totalScore: number | null;
  maxPossibleScore: number | null;
  submittedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
}


export interface Result {
  id: string;
  snapshotId: string;
  challengeId: string;
  submissionId: string;
  submissionVersionId: string;
  trackId: string | null;
  selectionType: string;
  rankLabel: string | null;
  rank: number | null;
  aggregateScore: number | null;
  tieBreakDecision: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  challengeId: string | null;
  title: string;
  body: string;
  audience: "ALL_MEMBERS" | "CHALLENGE_PARTICIPANTS" | "PUBLIC";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  publishAt: string | null;
  expiresAt: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  deliverInApp: boolean;
  deliverEmail: boolean;
  deliverIntegration: boolean;
  createdAt: string;
}

export interface FAQ {
  id: string;
  challengeId: string | null;
  question: string;
  answer: string;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
}

export type NotificationCategory =
  | "ORGANIZATION_INVITE"
  | "ORGANIZATION_APPLICATION_DECISION"
  | "PARTICIPATION_DECISION"
  | "TEAM_INVITATION"
  | "TEAM_MEMBERSHIP_CHANGE"
  | "SUBMISSION_FINALIZED"
  | "DEADLINE_CHANGED"
  | "DEADLINE_REMINDER"
  | "ANNOUNCEMENT"
  | "JUDGING_ASSIGNMENT"
  | "JUDGING_REMINDER"
  | "RESULTS_PUBLISHED"
  | "FEEDBACK_RELEASED"
  | "SUPPORT_TICKET_UPDATE"
  | "MATCHMAKING_INTEREST"
  | "PORTFOLIO_UPDATE";

export interface Notification {
  id: string;
  organizationId: string | null;
  category: NotificationCategory;
  title: string;
  body: string;
  linkUrl: string | null;
  /** Read status is derived from this being non-null, not a separate boolean field. */
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  userId: string;
  emailDigest: boolean;
  challengeUpdates: boolean;
  teamInvites: boolean;
  judgingAssignments: boolean;
  marketingEmails: boolean;
}

export interface AnalyticsMetric {
  date: string;
  participants: number;
  submissions: number;
  teams: number;
  views: number;
  conversionRate?: number;
}

export type ExportJobStatus = "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "EXPIRED";

export type ExportType = 
  | "PARTICIPANTS"
  | "TEAMS"
  | "SUBMISSIONS"
  | "SCORECARDS"
  | "PORTFOLIO"
  | "AUDIT_LOGS"
  | "SNAPSHOT";

export interface ExportRequest {
  id: string;
  organizationId: string;
  challengeId?: string;
  challengeTitle?: string;
  requestedByUserId: string;
  requestedByName?: string;
  exportType: ExportType;
  format: "CSV" | "JSON" | "XLSX" | "PDF";
  status: ExportJobStatus;
  progressPercent?: number;
  selectedFields?: string[];
  dateRange?: { start?: string; end?: string };
  recordCount?: number;
  fileSizeBytes?: number;
  downloadUrl?: string;
  errorMessage?: string;
  expiresAt?: string;
  createdAt: string;
  completedAt?: string;
}

export interface IntegrationConfig {
  id: string;
  organizationId: string;
  provider: "SLACK" | "DISCORD" | "GITHUB" | "GITLAB" | "WEBHOOK";
  enabled: boolean;
  config: Record<string, any>;
  lastSyncedAt?: string;
}

export type InnovationStage =
  | "DISCOVERY"
  | "VALIDATION"
  | "PROTOTYPE"
  | "PILOT"
  | "INCUBATION"
  | "SCALE"
  | "PAUSED"
  | "CLOSED";

export interface Milestone {
  id: string;
  portfolioItemId: string;
  title: string;
  description?: string;
  category?: string;
  owner?: string;
  targetDate: string;
  completedDate?: string;
  status: "PLANNED" | "IN_PROGRESS" | "ACHIEVED" | "BLOCKED";
  completionPercentage?: number;
  evidenceUrl?: string;
  evidenceNotes?: string;
  notes?: string;
}

export interface PortfolioEvidence {
  id: string;
  portfolioItemId: string;
  title: string;
  type: "LINK" | "DOCUMENT" | "IMAGE" | "NOTE" | "METRIC_REPORT" | string;
  url?: string;
  description?: string;
  milestoneId?: string;
  authorName?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  isPublic?: boolean;
  uploadedAt?: string;
  createdAt: string;
}

export interface PortfolioStageHistory {
  id: string;
  portfolioItemId: string;
  fromStage?: InnovationStage;
  toStage: InnovationStage;
  decision: string;
  decisionMaker: string;
  decisionMakerRole?: string;
  evidence?: string;
  notes?: string;
  nextReviewDate?: string;
  milestoneRequirementMet?: boolean;
  timestamp: string;
  transitionedAt?: string;
}

export interface PortfolioOutcomeMetric {
  id: string;
  portfolioItemId: string;
  category?: "USERS_REACHED" | "PILOTS_LAUNCHED" | "REVENUE_VALUE" | "COST_REDUCTION" | "PARTNERSHIPS" | "JOBS_CREATED" | "DEPLOYMENTS" | "OTHER" | string;
  metricName?: string;
  label?: string;
  value?: number;
  currentValue?: number;
  unit: string;
  period?: string;
  targetValue?: number;
  notes?: string;
  recordedAt?: string;
}

export type MetricLog = PortfolioOutcomeMetric;

export interface PortfolioRisk {
  id: string;
  category?: "TECHNICAL" | "REGULATORY" | "MARKET" | "EXECUTION" | "FINANCIAL" | string;
  description?: string;
  risk?: string;
  impact?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  likelihood?: "LOW" | "MEDIUM" | "HIGH" | string;
  mitigation: string;
}

/**
 * `GET /public/organizations/:slug/innovations` — a narrower public
 * projection of an organization's innovation portfolio, distinct from the
 * authenticated `InnovationPortfolioItem` below (no financials, mentors,
 * risks, or milestones — those are internal-only fields).
 */
export interface PublicInnovation {
  id: string;
  organizationSlug: string;
  organizationName: string;
  title: string;
  opportunityStatement: string | null;
  thesis: string | null;
  expectedImpact: string | null;
  beneficiaries: string | null;
  strategicThemes: string[];
  stage: InnovationStage;
  createdAt: string;
}

/**
 * `GET /public/organizations/:slug/projects` — public showcase of
 * challenge submissions an organization has opted to publish (gated by
 * `OrgSettings.publicProjectGalleryEnabled` and each challenge's
 * `publicProjectPublicationEnabled`). Distinct from `Submission`, which is
 * the authenticated, full-detail resource.
 */
export interface PublicProject {
  id: string;
  organizationSlug: string;
  organizationName: string;
  challengeSlug: string;
  challengeTitle: string;
  teamName: string | null;
  title: string;
  tagline: string | null;
  solutionDescription: string | null;
  impactBeneficiaries: string | null;
  technologyTags: string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  pitchVideoUrl: string | null;
  presentationUrl: string | null;
  createdAt: string;
}

export interface InnovationPortfolioItem {
  id: string;
  organizationId: string;
  sourceChallengeId: string | null;
  sourceSubmissionId: string | null;
  title: string;
  opportunityStatement: string | null;
  thesis: string | null;
  ownerUserId: string | null;
  ownerTeamName: string | null;
  strategicThemes: string[];
  expectedImpact: string | null;
  riskLevel: string | null;
  beneficiaries: string | null;
  stage: InnovationStage;
  resourceNotes: string | null;
  nextReviewDate: string | null;
  publicVisible: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Each of these is its own sub-resource collection — fetched separately, not embedded on InnovationPortfolioItem. */
export interface InnovationMilestone {
  id: string;
  innovationId: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InnovationMetric {
  id: string;
  innovationId: string;
  name: string;
  metricType: string;
  unit: string | null;
  targetValue: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InnovationMetricMeasurement {
  id: string;
  metricId: string;
  value: string;
  measuredAt: string;
  note: string | null;
  recordedByUserId: string;
  createdAt: string;
}

export interface InnovationEvidence {
  id: string;
  innovationId: string;
  type: string;
  title: string;
  url: string | null;
  mediaAssetId: string | null;
  note: string | null;
  addedByUserId: string;
  createdAt: string;
}

export interface InnovationStageHistoryEntry {
  id: string;
  innovationId: string;
  previousStage: InnovationStage | null;
  newStage: InnovationStage;
  decision: string | null;
  decisionMakerUserId: string;
  evidenceRefs: string[];
  notes: string | null;
  nextReviewDate: string | null;
  createdAt: string;
}

export interface SupportInternalNote {
  id: string;
  authorId: string;
  authorName: string;
  note: string;
  createdAt: string;
}

export interface SupportTicketMessage {
  id: string;
  sender?: "USER" | "AGENT" | "ADMIN" | "SYSTEM";
  senderRole?: "USER" | "AGENT" | "ADMIN" | "SYSTEM";
  senderId?: string;
  senderName: string;
  senderAvatarUrl?: string;
  message: string;
  isInternal?: boolean;
  createdAt: string;
  attachments?: { name: string; url: string }[];
}

export interface SupportTicket {
  id: string;
  userId: string;
  challengeId?: string | null;
  organizationId?: string | null;
  subject: string;
  description: string;
  category: "BUG" | "ACCESS_OR_ACCOUNT" | "ORGANIZATION_ISSUE" | "CHALLENGE_ISSUE" | "ABUSE_OR_SAFETY" | "FEATURE_REQUEST" | "OTHER";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "OPEN" | "TRIAGED" | "IN_PROGRESS" | "WAITING_USER" | "RESOLVED" | "CLOSED";
  assignedToUserId?: string | null;
  resolutionSummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketComment {
  id: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
}

export type ModerationTargetType = "ORGANIZATION" | "CHALLENGE";
export type ModerationReportStatus = "OPEN" | "UNDER_REVIEW" | "DISMISSED" | "ACTION_TAKEN";
export type ModerationCategory = "SPAM" | "ABUSE" | "INAPPROPRIATE_CONTENT" | "INTELLECTUAL_PROPERTY" | "SAFETY_CONCERN" | "OTHER";

/** A platform-level content report against an organization or challenge (`/platform/reports/*`). */
export interface ModerationReport {
  id: string;
  reporterUserId: string;
  targetType: ModerationTargetType;
  targetId: string;
  targetOrganizationId: string | null;
  category: ModerationCategory;
  description: string;
  status: ModerationReportStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  resolutionReason: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  organizationId: string | null;
  actorType: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  summary: string;
  changes: Record<string, any> | null;
  reason: string | null;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** The narrow projection returned by the platform-wide organization list/detail endpoints — distinct from (and smaller than) the full `Organization` an org's own admins see. */
export interface PlatformOrganization {
  id: string;
  slug: string;
  name: string;
  organizationType: string;
  status: OrgStatus;
  visibility: OrgVisibility;
  createdAt: string;
}

// Workspace & Context Definitions
export type WorkspaceType = "participant" | "org_admin" | "judge" | "platform_admin";

export interface UserContext {
  user: User;
  globalRole: GlobalRole;
  activeOrgId?: string;
  orgRole?: OrgRole;
  challengeRoles?: Record<string, ChallengeRole>; // challengeId -> role
}
