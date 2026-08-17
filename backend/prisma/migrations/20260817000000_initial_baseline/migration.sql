-- REVIEWED PRE-DEPLOYMENT BASELINE.
-- Generated from the fully remediated schema before any shared deployment.
-- Runtime/application roles must be provisioned by scripts/bootstrap-db.ts.

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: ip_migrator
--

ALTER SCHEMA public OWNER TO ip_migrator;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: ip_migrator
--

COMMENT ON SCHEMA public IS 'standard public schema';

-- The dedicated definer for public projection views must be eligible to own
-- objects in this schema before pg_dump's ALTER VIEW OWNER statements run.
-- Runtime access to the role is revoked again in the grants section below.
GRANT USAGE, CREATE ON SCHEMA public TO ip_public_views;

-- pg_trgm is a trusted extension and is part of the application schema: the
-- baseline must recreate it after Prisma resets a disposable shadow schema.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: AccountDeletionStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."AccountDeletionStatus" AS ENUM (
    'PENDING',
    'CANCELLED',
    'COMPLETED'
);


ALTER TYPE public."AccountDeletionStatus" OWNER TO ip_migrator;

--
-- Name: AnnouncementAudience; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."AnnouncementAudience" AS ENUM (
    'ALL_MEMBERS',
    'CHALLENGE_PARTICIPANTS',
    'PUBLIC'
);


ALTER TYPE public."AnnouncementAudience" OWNER TO ip_migrator;

--
-- Name: AnnouncementPriority; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."AnnouncementPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);


ALTER TYPE public."AnnouncementPriority" OWNER TO ip_migrator;

--
-- Name: AuditActorType; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."AuditActorType" AS ENUM (
    'USER',
    'SYSTEM',
    'PLATFORM_ADMIN'
);


ALTER TYPE public."AuditActorType" OWNER TO ip_migrator;

--
-- Name: ChallengeParticipationPolicy; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ChallengeParticipationPolicy" AS ENUM (
    'ORG_MEMBERS_ONLY',
    'APPROVED_CHALLENGE_PARTICIPANTS',
    'OPEN_AUTHENTICATED'
);


ALTER TYPE public."ChallengeParticipationPolicy" OWNER TO ip_migrator;

--
-- Name: ChallengeStaffRoleDb; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ChallengeStaffRoleDb" AS ENUM (
    'JUDGE',
    'MENTOR'
);


ALTER TYPE public."ChallengeStaffRoleDb" OWNER TO ip_migrator;

--
-- Name: ChallengeStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ChallengeStatus" AS ENUM (
    'DRAFT',
    'SCHEDULED',
    'OPEN',
    'CLOSED',
    'JUDGING',
    'RESULTS_READY',
    'RESULTS_PUBLISHED',
    'ARCHIVED',
    'CANCELLED'
);


ALTER TYPE public."ChallengeStatus" OWNER TO ip_migrator;

--
-- Name: ChallengeVisibility; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ChallengeVisibility" AS ENUM (
    'ORG_MEMBERS',
    'PUBLIC',
    'UNLISTED'
);


ALTER TYPE public."ChallengeVisibility" OWNER TO ip_migrator;

--
-- Name: ContentReportCategory; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ContentReportCategory" AS ENUM (
    'SPAM',
    'ABUSE',
    'INAPPROPRIATE_CONTENT',
    'INTELLECTUAL_PROPERTY',
    'SAFETY_CONCERN',
    'OTHER'
);


ALTER TYPE public."ContentReportCategory" OWNER TO ip_migrator;

--
-- Name: ContentReportStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ContentReportStatus" AS ENUM (
    'OPEN',
    'UNDER_REVIEW',
    'DISMISSED',
    'ACTION_TAKEN'
);


ALTER TYPE public."ContentReportStatus" OWNER TO ip_migrator;

--
-- Name: ContentReportTargetType; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ContentReportTargetType" AS ENUM (
    'ORGANIZATION',
    'CHALLENGE'
);


ALTER TYPE public."ContentReportTargetType" OWNER TO ip_migrator;

--
-- Name: EmailDeliveryAttemptOutcome; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."EmailDeliveryAttemptOutcome" AS ENUM (
    'STARTED',
    'SENT',
    'SUPPRESSED',
    'RETRYABLE_FAILURE',
    'PERMANENT_FAILURE'
);


ALTER TYPE public."EmailDeliveryAttemptOutcome" OWNER TO ip_migrator;

--
-- Name: EmailDeliveryStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."EmailDeliveryStatus" AS ENUM (
    'PENDING',
    'SENDING',
    'SENT',
    'SUPPRESSED',
    'FAILED',
    'BOUNCED',
    'COMPLAINED',
    'CANCELLED'
);


ALTER TYPE public."EmailDeliveryStatus" OWNER TO ip_migrator;

--
-- Name: ExportStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ExportStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


ALTER TYPE public."ExportStatus" OWNER TO ip_migrator;

--
-- Name: ExportType; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ExportType" AS ENUM (
    'ORGANIZATION_MEMBERS',
    'ORGANIZATION_SUBMISSIONS',
    'ORGANIZATION_PARTICIPATION',
    'CHALLENGE_RESULTS'
);


ALTER TYPE public."ExportType" OWNER TO ip_migrator;

--
-- Name: FileAssetPurpose; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."FileAssetPurpose" AS ENUM (
    'SUBMISSION_PRESENTATION',
    'SUPPORT_ATTACHMENT',
    'PORTFOLIO_EVIDENCE'
);


ALTER TYPE public."FileAssetPurpose" OWNER TO ip_migrator;

--
-- Name: FileAssetStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."FileAssetStatus" AS ENUM (
    'ACTIVE',
    'PENDING_DELETION',
    'DELETED'
);


ALTER TYPE public."FileAssetStatus" OWNER TO ip_migrator;

--
-- Name: FormPurpose; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."FormPurpose" AS ENUM (
    'ORGANIZATION_JOIN_REQUEST',
    'CHALLENGE_PARTICIPATION',
    'MENTOR_JUDGE_APPLICATION',
    'POST_EVENT_SURVEY',
    'PORTFOLIO_STAGE_GATE'
);


ALTER TYPE public."FormPurpose" OWNER TO ip_migrator;

--
-- Name: InnovationEvidenceType; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."InnovationEvidenceType" AS ENUM (
    'LINK',
    'MEDIA_ASSET',
    'NOTE'
);


ALTER TYPE public."InnovationEvidenceType" OWNER TO ip_migrator;

--
-- Name: InnovationMetricType; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."InnovationMetricType" AS ENUM (
    'NUMBER',
    'PERCENTAGE',
    'CURRENCY'
);


ALTER TYPE public."InnovationMetricType" OWNER TO ip_migrator;

--
-- Name: InnovationMilestoneStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."InnovationMilestoneStatus" AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'AT_RISK',
    'CANCELLED'
);


ALTER TYPE public."InnovationMilestoneStatus" OWNER TO ip_migrator;

--
-- Name: InnovationRiskLevel; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."InnovationRiskLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH'
);


ALTER TYPE public."InnovationRiskLevel" OWNER TO ip_migrator;

--
-- Name: InnovationStage; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."InnovationStage" AS ENUM (
    'DISCOVERY',
    'VALIDATION',
    'PROTOTYPE',
    'PILOT',
    'INCUBATION',
    'SCALE',
    'PAUSED',
    'CLOSED'
);


ALTER TYPE public."InnovationStage" OWNER TO ip_migrator;

--
-- Name: IntegrationDeliveryAttemptOutcome; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."IntegrationDeliveryAttemptOutcome" AS ENUM (
    'STARTED',
    'SUCCEEDED',
    'RETRYABLE_FAILURE',
    'PERMANENT_FAILURE'
);


ALTER TYPE public."IntegrationDeliveryAttemptOutcome" OWNER TO ip_migrator;

--
-- Name: IntegrationDeliveryStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."IntegrationDeliveryStatus" AS ENUM (
    'PENDING',
    'SENDING',
    'SUCCEEDED',
    'FAILED'
);


ALTER TYPE public."IntegrationDeliveryStatus" OWNER TO ip_migrator;

--
-- Name: IntegrationProvider; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."IntegrationProvider" AS ENUM (
    'SLACK',
    'DISCORD'
);


ALTER TYPE public."IntegrationProvider" OWNER TO ip_migrator;

--
-- Name: IntegrationStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."IntegrationStatus" AS ENUM (
    'ACTIVE',
    'DISABLED',
    'DELETED'
);


ALTER TYPE public."IntegrationStatus" OWNER TO ip_migrator;

--
-- Name: InvitationStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."InvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'REVOKED',
    'EXPIRED'
);


ALTER TYPE public."InvitationStatus" OWNER TO ip_migrator;

--
-- Name: JoinRequestStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."JoinRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN'
);


ALTER TYPE public."JoinRequestStatus" OWNER TO ip_migrator;

--
-- Name: JudgeAssignmentStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."JudgeAssignmentStatus" AS ENUM (
    'ASSIGNED',
    'CONFLICT_DECLARED',
    'RECUSED',
    'REASSIGNED'
);


ALTER TYPE public."JudgeAssignmentStatus" OWNER TO ip_migrator;

--
-- Name: MediaAssetDeliveryType; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."MediaAssetDeliveryType" AS ENUM (
    'UPLOAD',
    'AUTHENTICATED'
);


ALTER TYPE public."MediaAssetDeliveryType" OWNER TO ip_migrator;

--
-- Name: MediaAssetPurpose; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."MediaAssetPurpose" AS ENUM (
    'USER_AVATAR',
    'ORGANIZATION_LOGO',
    'CHALLENGE_COVER',
    'SPONSOR_LOGO',
    'SUBMISSION_SCREENSHOT',
    'SUPPORT_TICKET_SCREENSHOT',
    'PORTFOLIO_EVIDENCE'
);


ALTER TYPE public."MediaAssetPurpose" OWNER TO ip_migrator;

--
-- Name: MediaAssetStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."MediaAssetStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'PENDING_DELETION',
    'DELETED'
);


ALTER TYPE public."MediaAssetStatus" OWNER TO ip_migrator;

--
-- Name: MembershipStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."MembershipStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."MembershipStatus" OWNER TO ip_migrator;

--
-- Name: NotificationCategory; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."NotificationCategory" AS ENUM (
    'ORGANIZATION_INVITE',
    'ORGANIZATION_APPLICATION_DECISION',
    'PARTICIPATION_DECISION',
    'TEAM_INVITATION',
    'TEAM_MEMBERSHIP_CHANGE',
    'SUBMISSION_FINALIZED',
    'DEADLINE_CHANGED',
    'DEADLINE_REMINDER',
    'ANNOUNCEMENT',
    'JUDGING_ASSIGNMENT',
    'JUDGING_REMINDER',
    'RESULTS_PUBLISHED',
    'FEEDBACK_RELEASED',
    'SUPPORT_TICKET_UPDATE',
    'MATCHMAKING_INTEREST',
    'PORTFOLIO_UPDATE'
);


ALTER TYPE public."NotificationCategory" OWNER TO ip_migrator;

--
-- Name: OrganizationApplicationStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."OrganizationApplicationStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN'
);


ALTER TYPE public."OrganizationApplicationStatus" OWNER TO ip_migrator;

--
-- Name: OrganizationJoinPolicy; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."OrganizationJoinPolicy" AS ENUM (
    'INVITE_ONLY',
    'CODE_OR_INVITE',
    'REQUEST_TO_JOIN',
    'OPEN'
);


ALTER TYPE public."OrganizationJoinPolicy" OWNER TO ip_migrator;

--
-- Name: OrganizationRole; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."OrganizationRole" AS ENUM (
    'ORG_OWNER',
    'ORG_ADMIN',
    'CHALLENGE_MANAGER',
    'MEMBER'
);


ALTER TYPE public."OrganizationRole" OWNER TO ip_migrator;

--
-- Name: OrganizationStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."OrganizationStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);


ALTER TYPE public."OrganizationStatus" OWNER TO ip_migrator;

--
-- Name: OrganizationVisibility; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."OrganizationVisibility" AS ENUM (
    'PRIVATE',
    'PUBLIC'
);


ALTER TYPE public."OrganizationVisibility" OWNER TO ip_migrator;

--
-- Name: OutboxState; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."OutboxState" AS ENUM (
    'PENDING',
    'ENQUEUED',
    'PROCESSED',
    'FAILED'
);


ALTER TYPE public."OutboxState" OWNER TO ip_migrator;

--
-- Name: ParticipationStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ParticipationStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
    'DISQUALIFIED'
);


ALTER TYPE public."ParticipationStatus" OWNER TO ip_migrator;

--
-- Name: PlatformRole; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."PlatformRole" AS ENUM (
    'PLATFORM_SUPERADMIN',
    'PLATFORM_SUPPORT_AGENT'
);


ALTER TYPE public."PlatformRole" OWNER TO ip_migrator;

--
-- Name: ProfileVisibility; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ProfileVisibility" AS ENUM (
    'PUBLIC',
    'ORGANIZATION_MEMBERS',
    'PRIVATE'
);


ALTER TYPE public."ProfileVisibility" OWNER TO ip_migrator;

--
-- Name: ReminderScheduleKind; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ReminderScheduleKind" AS ENUM (
    'REGISTRATION_DEADLINE',
    'SUBMISSION_DEADLINE',
    'JUDGING_DEADLINE',
    'PORTFOLIO_REVIEW'
);


ALTER TYPE public."ReminderScheduleKind" OWNER TO ip_migrator;

--
-- Name: ReminderScheduleStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ReminderScheduleStatus" AS ENUM (
    'SCHEDULED',
    'SENT',
    'CANCELLED'
);


ALTER TYPE public."ReminderScheduleStatus" OWNER TO ip_migrator;

--
-- Name: ResultSelectionType; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ResultSelectionType" AS ENUM (
    'WINNER',
    'FINALIST',
    'RANKED',
    'HONORABLE_MENTION',
    'DISQUALIFIED'
);


ALTER TYPE public."ResultSelectionType" OWNER TO ip_migrator;

--
-- Name: ResultSnapshotStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ResultSnapshotStatus" AS ENUM (
    'FINALIZED',
    'PUBLISHED',
    'RETRACTED'
);


ALTER TYPE public."ResultSnapshotStatus" OWNER TO ip_migrator;

--
-- Name: ScorecardStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."ScorecardStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'LOCKED'
);


ALTER TYPE public."ScorecardStatus" OWNER TO ip_migrator;

--
-- Name: StaffAssignmentStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."StaffAssignmentStatus" AS ENUM (
    'ACTIVE',
    'REMOVED'
);


ALTER TYPE public."StaffAssignmentStatus" OWNER TO ip_migrator;

--
-- Name: StaffInvitationStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."StaffInvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'REVOKED',
    'EXPIRED'
);


ALTER TYPE public."StaffInvitationStatus" OWNER TO ip_migrator;

--
-- Name: StoredObjectStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."StoredObjectStatus" AS ENUM (
    'PENDING_UPLOAD',
    'QUARANTINED',
    'CLEAN',
    'INFECTED',
    'FAILED',
    'PENDING_DELETION',
    'DELETED'
);


ALTER TYPE public."StoredObjectStatus" OWNER TO ip_migrator;

--
-- Name: SubmissionAssetKind; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."SubmissionAssetKind" AS ENUM (
    'SCREENSHOT',
    'PRESENTATION_FILE'
);


ALTER TYPE public."SubmissionAssetKind" OWNER TO ip_migrator;

--
-- Name: SubmissionStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."SubmissionStatus" AS ENUM (
    'DRAFT',
    'FINALIZED',
    'DISQUALIFIED'
);


ALTER TYPE public."SubmissionStatus" OWNER TO ip_migrator;

--
-- Name: SupportTicketCategory; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."SupportTicketCategory" AS ENUM (
    'BUG',
    'ACCESS_OR_ACCOUNT',
    'ORGANIZATION_ISSUE',
    'CHALLENGE_ISSUE',
    'ABUSE_OR_SAFETY',
    'FEATURE_REQUEST',
    'OTHER'
);


ALTER TYPE public."SupportTicketCategory" OWNER TO ip_migrator;

--
-- Name: SupportTicketPriority; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."SupportTicketPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);


ALTER TYPE public."SupportTicketPriority" OWNER TO ip_migrator;

--
-- Name: SupportTicketStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."SupportTicketStatus" AS ENUM (
    'OPEN',
    'TRIAGED',
    'IN_PROGRESS',
    'WAITING_USER',
    'RESOLVED',
    'CLOSED'
);


ALTER TYPE public."SupportTicketStatus" OWNER TO ip_migrator;

--
-- Name: SuppressionReason; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."SuppressionReason" AS ENUM (
    'BOUNCE',
    'COMPLAINT',
    'MANUAL'
);


ALTER TYPE public."SuppressionReason" OWNER TO ip_migrator;

--
-- Name: TeamInvitationStatus; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."TeamInvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'REVOKED',
    'EXPIRED'
);


ALTER TYPE public."TeamInvitationStatus" OWNER TO ip_migrator;

--
-- Name: TeamMemberRole; Type: TYPE; Schema: public; Owner: ip_migrator
--

CREATE TYPE public."TeamMemberRole" AS ENUM (
    'CAPTAIN',
    'MEMBER'
);


ALTER TYPE public."TeamMemberRole" OWNER TO ip_migrator;

--
-- Name: app_current_actor_id(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_current_actor_id() RETURNS uuid
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
  select nullif(current_setting('app.actor_user_id', true), '')::uuid
$$;


ALTER FUNCTION public.app_current_actor_id() OWNER TO ip_migrator;

--
-- Name: app_current_organization_id(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_current_organization_id() RETURNS uuid
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
  select nullif(current_setting('app.organization_id', true), '')::uuid
$$;


ALTER FUNCTION public.app_current_organization_id() OWNER TO ip_migrator;

--
-- Name: FUNCTION app_current_organization_id(); Type: COMMENT; Schema: public; Owner: ip_migrator
--

COMMENT ON FUNCTION public.app_current_organization_id() IS 'Transaction-local tenant identifier used by RLS policies. NULL when unset, which denies access.';


--
-- Name: app_find_my_judge_assignment(uuid, uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_find_my_judge_assignment(p_assignment_id uuid, p_user_id uuid) RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, staff_assignment_id uuid, submission_id uuid, assignment_status text, conflict_declared_at timestamp with time zone, recused_at timestamp with time zone, created_at timestamp with time zone, staff_user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT ja.id, ja.organization_id, ja.challenge_id, ja.staff_assignment_id,
         ja.submission_id, ja.status::text, ja.conflict_declared_at,
         ja.recused_at, ja.created_at, sa.user_id
  FROM public.judge_assignment ja
  JOIN public.challenge_staff_assignment sa
    ON sa.id = ja.staff_assignment_id AND sa.organization_id = ja.organization_id
       AND sa.challenge_id = ja.challenge_id
  WHERE ja.id = p_assignment_id AND sa.user_id = p_user_id AND sa.status = 'ACTIVE'
  LIMIT 1
$$;


ALTER FUNCTION public.app_find_my_judge_assignment(p_assignment_id uuid, p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_find_my_scorecard(uuid, uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_find_my_scorecard(p_assignment_id uuid, p_user_id uuid) RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, judge_assignment_id uuid, rubric_version_id uuid, scorecard_status text, total_score integer, max_possible_score integer, submitted_at timestamp with time zone, locked_at timestamp with time zone, reopened_at timestamp with time zone, reopen_reason character varying, created_at timestamp with time zone, staff_user_id uuid, criterion_scores jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT sc.id, sc.organization_id, sc.challenge_id, sc.judge_assignment_id,
         sc.rubric_version_id, sc.status::text, sc.total_score,
         sc.max_possible_score, sc.submitted_at, sc.locked_at, sc.reopened_at,
         sc.reopen_reason, sc.created_at, sa.user_id,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'criterionKey', rc.key,
             'score', cs.score,
             'comment', cs.comment
           ) ORDER BY rc.display_order)
           FROM public.criterion_score cs
           JOIN public.rubric_criterion rc ON rc.id = cs.criterion_id
           WHERE cs.scorecard_id = sc.id
         ), '[]'::jsonb)
  FROM public.scorecard sc
  JOIN public.judge_assignment ja
    ON ja.id = sc.judge_assignment_id AND ja.organization_id = sc.organization_id
       AND ja.challenge_id = sc.challenge_id
  JOIN public.challenge_staff_assignment sa
    ON sa.id = ja.staff_assignment_id AND sa.organization_id = ja.organization_id
       AND sa.challenge_id = ja.challenge_id
  WHERE ja.id = p_assignment_id AND sa.user_id = p_user_id AND sa.status = 'ACTIVE'
  LIMIT 1
$$;


ALTER FUNCTION public.app_find_my_scorecard(p_assignment_id uuid, p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_list_active_memberships(uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_list_active_memberships(p_user_id uuid) RETURNS TABLE(organization_id uuid, organization_slug character varying, organization_name character varying, membership_role text, joined_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT m.organization_id, o.slug, o.name, m.role::text, m.joined_at
  FROM public.organization_membership m
  JOIN public.organization o ON o.id = m.organization_id
  WHERE m.user_id = p_user_id AND m.status = 'ACTIVE'
  ORDER BY m.joined_at DESC
$$;


ALTER FUNCTION public.app_list_active_memberships(p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_list_my_challenge_participations(uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_list_my_challenge_participations(p_user_id uuid) RETURNS TABLE(id uuid, organization_id uuid, organization_slug character varying, challenge_id uuid, challenge_title character varying, participation_status text, applied_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT cp.id, cp.organization_id, o.slug, cp.challenge_id, c.title,
         cp.status::text, cp.applied_at
  FROM public.challenge_participation cp
  JOIN public.challenge c
    ON c.id = cp.challenge_id AND c.organization_id = cp.organization_id
  JOIN public.organization o ON o.id = cp.organization_id
  WHERE cp.user_id = p_user_id
  ORDER BY cp.applied_at DESC
$$;


ALTER FUNCTION public.app_list_my_challenge_participations(p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_list_my_join_requests(uuid, timestamp with time zone, uuid, integer); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_list_my_join_requests(p_user_id uuid, p_cursor_at timestamp with time zone, p_cursor_id uuid, p_limit integer) RETURNS TABLE(id uuid, organization_id uuid, user_id uuid, request_status text, message character varying, reviewed_by_user_id uuid, reviewed_at timestamp with time zone, decision_reason character varying, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT r.id, r.organization_id, r.user_id, r.status::text, r.message,
         r.reviewed_by_user_id, r.reviewed_at, r.decision_reason, r.created_at
  FROM public.organization_join_request r
  WHERE r.user_id = p_user_id
    AND (p_cursor_at IS NULL OR r.created_at < p_cursor_at
         OR (r.created_at = p_cursor_at AND r.id < p_cursor_id))
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 101)
$$;


ALTER FUNCTION public.app_list_my_join_requests(p_user_id uuid, p_cursor_at timestamp with time zone, p_cursor_id uuid, p_limit integer) OWNER TO ip_migrator;

--
-- Name: app_list_my_judge_assignments(uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_list_my_judge_assignments(p_user_id uuid) RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, staff_assignment_id uuid, submission_id uuid, assignment_status text, conflict_declared_at timestamp with time zone, recused_at timestamp with time zone, created_at timestamp with time zone, staff_user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT ja.id, ja.organization_id, ja.challenge_id, ja.staff_assignment_id,
         ja.submission_id, ja.status::text, ja.conflict_declared_at,
         ja.recused_at, ja.created_at, sa.user_id
  FROM public.judge_assignment ja
  JOIN public.challenge_staff_assignment sa
    ON sa.id = ja.staff_assignment_id AND sa.organization_id = ja.organization_id
       AND sa.challenge_id = ja.challenge_id
  WHERE sa.user_id = p_user_id AND sa.status = 'ACTIVE'
  ORDER BY ja.created_at DESC
$$;


ALTER FUNCTION public.app_list_my_judge_assignments(p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_list_my_staff_invitations(text); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_list_my_staff_invitations(p_email text) RETURNS TABLE(id uuid, organization_id uuid, organization_slug character varying, challenge_id uuid, challenge_title character varying, staff_role text, invitation_status text, expires_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT si.id, si.organization_id, o.slug, si.challenge_id, c.title,
         si.role::text, si.status::text, si.expires_at, si.created_at
  FROM public.challenge_staff_invitation si
  JOIN public.challenge c
    ON c.id = si.challenge_id AND c.organization_id = si.organization_id
  JOIN public.organization o ON o.id = si.organization_id
  WHERE lower(si.email) = lower(p_email)
  ORDER BY si.created_at DESC
$$;


ALTER FUNCTION public.app_list_my_staff_invitations(p_email text) OWNER TO ip_migrator;

--
-- Name: app_list_my_team_invitations(uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_list_my_team_invitations(p_user_id uuid) RETURNS TABLE(id uuid, organization_id uuid, organization_slug character varying, challenge_id uuid, team_id uuid, team_name character varying, invitation_status text, expires_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT ti.id, ti.organization_id, o.slug, ti.challenge_id, ti.team_id, t.name,
         ti.status::text, ti.expires_at, ti.created_at
  FROM public.team_invitation ti
  JOIN public.challenge_team t
    ON t.id = ti.team_id AND t.organization_id = ti.organization_id
       AND t.challenge_id = ti.challenge_id
  JOIN public.organization o ON o.id = ti.organization_id
  WHERE ti.invited_user_id = p_user_id
  ORDER BY ti.created_at DESC
$$;


ALTER FUNCTION public.app_list_my_team_invitations(p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_organization_slug_taken(text); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_organization_slug_taken(p_slug text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization o WHERE lower(o.slug) = lower(p_slug))
$$;


ALTER FUNCTION public.app_organization_slug_taken(p_slug text) OWNER TO ip_migrator;

--
-- Name: app_platform_access(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_platform_access() RETURNS boolean
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
  select coalesce(nullif(current_setting('app.platform_access', true), ''), 'off') = 'on'
$$;


ALTER FUNCTION public.app_platform_access() OWNER TO ip_migrator;

--
-- Name: FUNCTION app_platform_access(); Type: COMMENT; Schema: public; Owner: ip_migrator
--

COMMENT ON FUNCTION public.app_platform_access() IS 'True only inside an explicitly authorized, audited platform-administration transaction.';


--
-- Name: app_resolve_challenge_context(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_resolve_challenge_context(p_challenge_id uuid, p_organization_id uuid, p_user_id uuid) RETURNS TABLE(challenge_id uuid, organization_id uuid, staff_role text, participation_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT c.id, c.organization_id,
         (SELECT sa.role::text
            FROM public.challenge_staff_assignment sa
           WHERE sa.challenge_id = c.id AND sa.organization_id = c.organization_id
             AND sa.user_id = p_user_id AND sa.status = 'ACTIVE'
           ORDER BY sa.created_at DESC LIMIT 1),
         (SELECT cp.status::text
            FROM public.challenge_participation cp
           WHERE cp.challenge_id = c.id AND cp.organization_id = c.organization_id
             AND cp.user_id = p_user_id
           LIMIT 1)
  FROM public.challenge c
  WHERE c.id = p_challenge_id AND c.organization_id = p_organization_id
  LIMIT 1
$$;


ALTER FUNCTION public.app_resolve_challenge_context(p_challenge_id uuid, p_organization_id uuid, p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_resolve_file_context(uuid, uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_resolve_file_context(p_file_id uuid, p_user_id uuid) RETURNS TABLE(organization_id uuid, challenge_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT f.organization_id, f.challenge_id
  FROM public.file_asset f
  WHERE f.id = p_file_id
    AND f.status <> 'DELETED'
    AND (
      f.owner_user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.organization_membership m
        WHERE m.organization_id = f.organization_id
          AND m.user_id = p_user_id AND m.status = 'ACTIVE'
      )
      OR (f.challenge_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.challenge_staff_assignment sa
        WHERE sa.organization_id = f.organization_id
          AND sa.challenge_id = f.challenge_id
          AND sa.user_id = p_user_id AND sa.status = 'ACTIVE'
      ))
      OR (f.challenge_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.challenge_participation cp
        WHERE cp.organization_id = f.organization_id
          AND cp.challenge_id = f.challenge_id
          AND cp.user_id = p_user_id AND cp.status = 'APPROVED'
      ))
      OR EXISTS (
        SELECT 1 FROM public.platform_role_assignment pra
        WHERE pra.user_id = p_user_id AND pra.revoked_at IS NULL
      )
    )
  LIMIT 1
$$;


ALTER FUNCTION public.app_resolve_file_context(p_file_id uuid, p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_resolve_organization_context(uuid, uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_resolve_organization_context(p_organization_id uuid, p_user_id uuid) RETURNS TABLE(organization_id uuid, organization_status text, membership_role text, membership_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT o.id, o.status::text, m.role::text, m.status::text
  FROM public.organization o
  LEFT JOIN public.organization_membership m
    ON m.organization_id = o.id AND m.user_id = p_user_id
  WHERE o.id = p_organization_id
  LIMIT 1
$$;


ALTER FUNCTION public.app_resolve_organization_context(p_organization_id uuid, p_user_id uuid) OWNER TO ip_migrator;

--
-- Name: app_secret_lookup_access(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_secret_lookup_access() RETURNS boolean
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
  select coalesce(nullif(current_setting('app.secret_lookup', true), ''), 'off') = 'on'
$$;


ALTER FUNCTION public.app_secret_lookup_access() OWNER TO ip_migrator;

--
-- Name: FUNCTION app_secret_lookup_access(); Type: COMMENT; Schema: public; Owner: ip_migrator
--

COMMENT ON FUNCTION public.app_secret_lookup_access() IS 'True only inside a transaction explicitly opened to resolve one row by an unguessable secret token (see withSecretLookup). The secret is the authorization; this is not a tenant or platform bypass.';


--
-- Name: app_user_has_organization_membership(uuid, uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_user_has_organization_membership(p_user_id uuid, p_organization_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_membership m
    WHERE m.user_id = p_user_id AND m.organization_id = p_organization_id
  )
$$;


ALTER FUNCTION public.app_user_has_organization_membership(p_user_id uuid, p_organization_id uuid) OWNER TO ip_migrator;

--
-- Name: app_user_shares_organization(uuid, uuid); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.app_user_shares_organization(p_viewer_id uuid, p_target_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_membership viewer
    JOIN public.organization_membership target
      ON target.organization_id = viewer.organization_id
    WHERE viewer.user_id = p_viewer_id AND viewer.status = 'ACTIVE'
      AND target.user_id = p_target_id AND target.status = 'ACTIVE'
  )
$$;


ALTER FUNCTION public.app_user_shares_organization(p_viewer_id uuid, p_target_id uuid) OWNER TO ip_migrator;

--
-- Name: create_default_organization_limit(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.create_default_organization_limit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.organization_limit (organization_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END
$$;


ALTER FUNCTION public.create_default_organization_limit() OWNER TO ip_migrator;

--
-- Name: enforce_criterion_score_range(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.enforce_criterion_score_range() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  minimum_score integer;
  maximum_score integer;
BEGIN
  SELECT min_score, max_score INTO minimum_score, maximum_score
  FROM rubric_criterion WHERE id = NEW.criterion_id;
  IF NEW.score < minimum_score OR NEW.score > maximum_score THEN
    RAISE EXCEPTION 'criterion score is outside its configured range' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM scorecard WHERE id = NEW.scorecard_id AND status = 'LOCKED') THEN
    RAISE EXCEPTION 'locked scorecard scores are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enforce_criterion_score_range() OWNER TO ip_migrator;

--
-- Name: enforce_file_asset_object_scope(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.enforce_file_asset_object_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE object_row public.stored_object%ROWTYPE;
BEGIN
  SELECT * INTO object_row FROM public.stored_object
  WHERE id = NEW.stored_object_id AND organization_id = NEW.organization_id;
  IF NOT FOUND OR object_row.challenge_id IS DISTINCT FROM NEW.challenge_id
     OR object_row.owner_user_id IS DISTINCT FROM NEW.owner_user_id
     OR object_row.purpose IS DISTINCT FROM NEW.purpose
     OR object_row.resource_type IS DISTINCT FROM NEW.resource_type
     OR object_row.resource_id IS DISTINCT FROM NEW.resource_id
     OR object_row.display_name IS DISTINCT FROM NEW.display_name THEN
    RAISE EXCEPTION 'file asset scope does not match stored object authorization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION public.enforce_file_asset_object_scope() OWNER TO ip_migrator;

--
-- Name: enforce_form_scope_chain(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.enforce_form_scope_chain() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE parent_challenge uuid;
BEGIN
  IF TG_TABLE_NAME = 'form_version' THEN
    SELECT challenge_id INTO parent_challenge FROM form_definition WHERE id = NEW.form_definition_id;
  ELSE
    SELECT challenge_id INTO parent_challenge FROM form_version WHERE id = NEW.form_version_id;
  END IF;
  IF NEW.challenge_id IS DISTINCT FROM parent_challenge THEN
    RAISE EXCEPTION 'form challenge scope does not match its parent' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enforce_form_scope_chain() OWNER TO ip_migrator;

--
-- Name: enforce_join_request_form_chain(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.enforce_join_request_form_chain() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE response_version uuid;
BEGIN
  IF NEW.form_response_id IS NOT NULL THEN
    SELECT form_version_id INTO response_version FROM form_response WHERE id = NEW.form_response_id;
    IF NEW.form_version_id IS NULL OR response_version <> NEW.form_version_id THEN
      RAISE EXCEPTION 'join request response does not belong to its form version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enforce_join_request_form_chain() OWNER TO ip_migrator;

--
-- Name: enforce_submission_requirement_immutability(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.enforce_submission_requirement_immutability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.organization_id <> NEW.organization_id
     OR OLD.challenge_id <> NEW.challenge_id
     OR OLD.version <> NEW.version
     OR OLD.guidance IS DISTINCT FROM NEW.guidance
     OR OLD.require_title <> NEW.require_title
     OR OLD.require_tagline <> NEW.require_tagline
     OR OLD.require_problem_statement <> NEW.require_problem_statement
     OR OLD.require_solution_description <> NEW.require_solution_description
     OR OLD.require_impact_beneficiaries <> NEW.require_impact_beneficiaries
     OR OLD.require_technology_tags <> NEW.require_technology_tags
     OR OLD.require_repository_url <> NEW.require_repository_url
     OR OLD.require_demo_url <> NEW.require_demo_url
     OR OLD.require_pitch_video_url <> NEW.require_pitch_video_url
     OR OLD.require_presentation_asset <> NEW.require_presentation_asset
     OR OLD.require_supporting_links <> NEW.require_supporting_links
     OR OLD.require_publication_consent <> NEW.require_publication_consent
     OR OLD.min_screenshots <> NEW.min_screenshots
     OR OLD.max_screenshots <> NEW.max_screenshots
     OR OLD.created_by_user_id <> NEW.created_by_user_id THEN
    RAISE EXCEPTION 'submission requirement versions are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.locked_at IS NOT NULL AND NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
    RAISE EXCEPTION 'locked submission requirements cannot be unlocked' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enforce_submission_requirement_immutability() OWNER TO ip_migrator;

--
-- Name: prevent_final_submission_version_update(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.prevent_final_submission_version_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if old.is_final then
    raise exception 'submission_version % is final and cannot be modified', old.id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.prevent_final_submission_version_update() OWNER TO ip_migrator;

--
-- Name: prevent_locked_criterion_score_delete(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.prevent_locked_criterion_score_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM scorecard WHERE id = OLD.scorecard_id AND status = 'LOCKED') THEN
    RAISE EXCEPTION 'locked scorecard scores are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.prevent_locked_criterion_score_delete() OWNER TO ip_migrator;

--
-- Name: prevent_locked_scorecard_total_change(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.prevent_locked_scorecard_total_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status = 'LOCKED' AND NEW.status = 'LOCKED'
     AND (NEW.total_score IS DISTINCT FROM OLD.total_score
          OR NEW.max_possible_score IS DISTINCT FROM OLD.max_possible_score) THEN
    RAISE EXCEPTION 'locked scorecard totals are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_locked_scorecard_total_change() OWNER TO ip_migrator;

--
-- Name: prevent_result_decision_mutation(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.prevent_result_decision_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'finalized result decisions are immutable' USING ERRCODE = '23514';
END;
$$;


ALTER FUNCTION public.prevent_result_decision_mutation() OWNER TO ip_migrator;

--
-- Name: prevent_rubric_criterion_mutation_after_judging(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.prevent_rubric_criterion_mutation_after_judging() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_version uuid := COALESCE(NEW.rubric_version_id, OLD.rubric_version_id);
BEGIN
  IF EXISTS (
    SELECT 1
    FROM rubric_version rv
    JOIN rubric r ON r.id = rv.rubric_id
    JOIN challenge c ON c.id = r.challenge_id
    WHERE rv.id = target_version
      AND (
        c.status IN ('JUDGING', 'RESULTS_READY', 'RESULTS_PUBLISHED', 'ARCHIVED')
        OR (c.judging_start_at IS NOT NULL AND c.judging_start_at <= clock_timestamp())
        OR EXISTS (
          SELECT 1 FROM scorecard sc
          WHERE sc.rubric_version_id = rv.id AND sc.status <> 'DRAFT'
        )
      )
  ) THEN
    RAISE EXCEPTION 'rubric criteria are immutable after judging begins' USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.prevent_rubric_criterion_mutation_after_judging() OWNER TO ip_migrator;

--
-- Name: prevent_stored_object_scope_mutation(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.prevent_stored_object_scope_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.challenge_id IS DISTINCT FROM NEW.challenge_id
     OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.resource_type IS DISTINCT FROM NEW.resource_type
     OR OLD.resource_id IS DISTINCT FROM NEW.resource_id
     OR OLD.display_name IS DISTINCT FROM NEW.display_name
     OR OLD.object_key IS DISTINCT FROM NEW.object_key
     OR OLD.expected_content_type IS DISTINCT FROM NEW.expected_content_type
     OR OLD.expected_bytes IS DISTINCT FROM NEW.expected_bytes THEN
    RAISE EXCEPTION 'stored object authorization scope is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION public.prevent_stored_object_scope_mutation() OWNER TO ip_migrator;

--
-- Name: prevent_submitted_form_response_mutation(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.prevent_submitted_form_response_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.is_draft = false THEN
    RAISE EXCEPTION 'submitted form responses are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.organization_id <> NEW.organization_id
     OR OLD.form_version_id <> NEW.form_version_id
     OR OLD.challenge_id IS DISTINCT FROM NEW.challenge_id
     OR OLD.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'form response scope is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.is_draft = false AND NEW.is_draft = true THEN
    RAISE EXCEPTION 'submitted form responses cannot become drafts' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_submitted_form_response_mutation() OWNER TO ip_migrator;

--
-- Name: verify_rubric_total_weight(); Type: FUNCTION; Schema: public; Owner: ip_migrator
--

CREATE FUNCTION public.verify_rubric_total_weight() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_version uuid := COALESCE(NEW.rubric_version_id, OLD.rubric_version_id);
  expected integer;
  actual integer;
BEGIN
  SELECT total_weight INTO expected FROM rubric_version WHERE id = target_version;
  IF expected IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(sum(weight), 0)::integer INTO actual
  FROM rubric_criterion WHERE rubric_version_id = target_version;
  IF actual <> expected THEN
    RAISE EXCEPTION 'rubric criterion weights do not match rubric total weight' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.verify_rubric_total_weight() OWNER TO ip_migrator;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.account (
    id uuid NOT NULL,
    account_id character varying(255) NOT NULL,
    provider_id character varying(64) NOT NULL,
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp(6) with time zone,
    refresh_token_expires_at timestamp(6) with time zone,
    scope character varying(500),
    password text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.account OWNER TO ip_migrator;

--
-- Name: account_deletion_request; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.account_deletion_request (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    status public."AccountDeletionStatus" DEFAULT 'PENDING'::public."AccountDeletionStatus" NOT NULL,
    reason character varying(1000),
    requested_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    eligible_at timestamp(6) with time zone NOT NULL,
    cancelled_at timestamp(6) with time zone,
    completed_at timestamp(6) with time zone,
    legal_hold_at timestamp(6) with time zone,
    legal_hold_reason character varying(1000),
    legal_hold_by_user_id uuid,
    execution_attempts integer DEFAULT 0 NOT NULL,
    last_execution_error character varying(1000),
    CONSTRAINT account_deletion_completion_chk CHECK ((((status = 'COMPLETED'::public."AccountDeletionStatus") AND (completed_at IS NOT NULL)) OR ((status <> 'COMPLETED'::public."AccountDeletionStatus") AND (completed_at IS NULL)))),
    CONSTRAINT account_deletion_execution_attempts_chk CHECK ((execution_attempts >= 0)),
    CONSTRAINT account_deletion_legal_hold_chk CHECK ((((legal_hold_at IS NULL) AND (legal_hold_reason IS NULL) AND (legal_hold_by_user_id IS NULL)) OR ((legal_hold_at IS NOT NULL) AND (legal_hold_reason IS NOT NULL))))
);


ALTER TABLE public.account_deletion_request OWNER TO ip_migrator;

--
-- Name: analytics_daily_rollup; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.analytics_daily_rollup (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid,
    scope_key character varying(255) NOT NULL,
    rollup_date date NOT NULL,
    members integer DEFAULT 0 NOT NULL,
    registrations integer DEFAULT 0 NOT NULL,
    approved_participants integer DEFAULT 0 NOT NULL,
    active_teams integer DEFAULT 0 NOT NULL,
    submissions_started integer DEFAULT 0 NOT NULL,
    final_submissions integer DEFAULT 0 NOT NULL,
    assignments_total integer DEFAULT 0 NOT NULL,
    scorecards_submitted integer DEFAULT 0 NOT NULL,
    finalist_count integer DEFAULT 0 NOT NULL,
    winner_count integer DEFAULT 0 NOT NULL,
    total_innovations integer DEFAULT 0 NOT NULL,
    promoted_innovations integer DEFAULT 0 NOT NULL,
    active_milestones integer DEFAULT 0 NOT NULL,
    overdue_milestones integer DEFAULT 0 NOT NULL,
    average_scoring_turnaround_hours numeric(12,4),
    calculated_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analytics_rollup_nonnegative_ck CHECK (((members >= 0) AND (registrations >= 0) AND (approved_participants >= 0) AND (active_teams >= 0) AND (submissions_started >= 0) AND (final_submissions >= 0) AND (assignments_total >= 0) AND (scorecards_submitted >= 0) AND (finalist_count >= 0) AND (winner_count >= 0) AND (total_innovations >= 0) AND (promoted_innovations >= 0) AND (active_milestones >= 0) AND (overdue_milestones >= 0)))
);

ALTER TABLE ONLY public.analytics_daily_rollup FORCE ROW LEVEL SECURITY;


ALTER TABLE public.analytics_daily_rollup OWNER TO ip_migrator;

--
-- Name: announcement; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.announcement (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    audience public."AnnouncementAudience" DEFAULT 'ALL_MEMBERS'::public."AnnouncementAudience" NOT NULL,
    priority public."AnnouncementPriority" DEFAULT 'NORMAL'::public."AnnouncementPriority" NOT NULL,
    publish_at timestamp(6) with time zone,
    expires_at timestamp(6) with time zone,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp(6) with time zone,
    deliver_in_app boolean DEFAULT true NOT NULL,
    deliver_email boolean DEFAULT false NOT NULL,
    deliver_integration boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.announcement FORCE ROW LEVEL SECURITY;


ALTER TABLE public.announcement OWNER TO ip_migrator;

--
-- Name: audit_event; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.audit_event (
    id uuid NOT NULL,
    organization_id uuid,
    actor_type public."AuditActorType" NOT NULL,
    actor_user_id uuid,
    action character varying(120) NOT NULL,
    resource_type character varying(80) NOT NULL,
    resource_id uuid,
    summary character varying(500) NOT NULL,
    changes jsonb,
    reason character varying(1000),
    request_id character varying(64),
    ip_address inet,
    user_agent character varying(500),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.audit_event FORCE ROW LEVEL SECURITY;


ALTER TABLE public.audit_event OWNER TO ip_migrator;

--
-- Name: TABLE audit_event; Type: COMMENT; Schema: public; Owner: ip_migrator
--

COMMENT ON TABLE public.audit_event IS 'Append-only audit trail. ip_app holds SELECT and INSERT only; UPDATE/DELETE are revoked.';


--
-- Name: challenge; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    slug character varying(64) NOT NULL,
    summary character varying(500),
    description text,
    cover_asset_id uuid,
    visibility public."ChallengeVisibility" DEFAULT 'ORG_MEMBERS'::public."ChallengeVisibility" NOT NULL,
    status public."ChallengeStatus" DEFAULT 'DRAFT'::public."ChallengeStatus" NOT NULL,
    published_at timestamp(6) with time zone,
    registration_open_at timestamp(6) with time zone,
    registration_close_at timestamp(6) with time zone,
    submission_open_at timestamp(6) with time zone,
    submission_deadline timestamp(6) with time zone,
    judging_start_at timestamp(6) with time zone,
    judging_end_at timestamp(6) with time zone,
    results_published_at timestamp(6) with time zone,
    display_time_zone character varying(64) DEFAULT 'UTC'::character varying NOT NULL,
    min_team_size integer DEFAULT 1 NOT NULL,
    max_team_size integer DEFAULT 1 NOT NULL,
    solo_participation_allowed boolean DEFAULT true NOT NULL,
    screening_required boolean DEFAULT false NOT NULL,
    participation_policy public."ChallengeParticipationPolicy" DEFAULT 'ORG_MEMBERS_ONLY'::public."ChallengeParticipationPolicy" NOT NULL,
    submission_requirements text,
    public_project_publication_enabled boolean DEFAULT false NOT NULL,
    blind_judging_enabled boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    updated_by_user_id uuid,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    feedback_released_at timestamp(6) with time zone,
    judging_finalized_at timestamp(6) with time zone,
    results_finalized_at timestamp(6) with time zone,
    results_retracted_at timestamp(6) with time zone,
    moderation_hidden_at timestamp(6) with time zone,
    moderation_hidden_reason character varying(2000),
    CONSTRAINT challenge_judging_window_chk CHECK (((judging_start_at IS NULL) OR (judging_end_at IS NULL) OR (judging_start_at <= judging_end_at))),
    CONSTRAINT challenge_published_consistency_chk CHECK (((status = 'DRAFT'::public."ChallengeStatus") OR (published_at IS NOT NULL) OR (status = 'CANCELLED'::public."ChallengeStatus"))),
    CONSTRAINT challenge_registration_window_chk CHECK (((registration_open_at IS NULL) OR (registration_close_at IS NULL) OR (registration_open_at <= registration_close_at))),
    CONSTRAINT challenge_submission_window_chk CHECK (((submission_open_at IS NULL) OR (submission_deadline IS NULL) OR (submission_open_at <= submission_deadline))),
    CONSTRAINT challenge_team_size_positive_chk CHECK (((min_team_size >= 1) AND (max_team_size >= min_team_size)))
);

ALTER TABLE ONLY public.challenge FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge OWNER TO ip_migrator;

--
-- Name: challenge_participation; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_participation (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status public."ParticipationStatus" DEFAULT 'PENDING'::public."ParticipationStatus" NOT NULL,
    terms_version_id uuid,
    accepted_terms_at timestamp(6) with time zone,
    form_response_id uuid,
    applied_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    decided_by_user_id uuid,
    decided_at timestamp(6) with time zone,
    decision_reason character varying(2000),
    internal_notes character varying(4000),
    withdrawn_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.challenge_participation FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_participation OWNER TO ip_migrator;

--
-- Name: challenge_prize; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_prize (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    title character varying(120) NOT NULL,
    description character varying(2000),
    value_label character varying(120),
    track_id uuid,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.challenge_prize FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_prize OWNER TO ip_migrator;

--
-- Name: challenge_schedule_change; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_schedule_change (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    field character varying(60) NOT NULL,
    previous_value timestamp(6) with time zone,
    new_value timestamp(6) with time zone,
    reason character varying(1000) NOT NULL,
    actor_user_id uuid NOT NULL,
    request_id character varying(64),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.challenge_schedule_change FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_schedule_change OWNER TO ip_migrator;

--
-- Name: challenge_sponsor; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_sponsor (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    website_url character varying(2048),
    logo_asset_id uuid,
    tier character varying(60),
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.challenge_sponsor FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_sponsor OWNER TO ip_migrator;

--
-- Name: challenge_staff_assignment; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_staff_assignment (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public."ChallengeStaffRoleDb" NOT NULL,
    status public."StaffAssignmentStatus" DEFAULT 'ACTIVE'::public."StaffAssignmentStatus" NOT NULL,
    invitation_id uuid,
    removed_by_user_id uuid,
    removed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.challenge_staff_assignment FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_staff_assignment OWNER TO ip_migrator;

--
-- Name: challenge_staff_invitation; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_staff_invitation (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    role public."ChallengeStaffRoleDb" NOT NULL,
    email character varying(320),
    token_hash character varying(128) NOT NULL,
    status public."StaffInvitationStatus" DEFAULT 'PENDING'::public."StaffInvitationStatus" NOT NULL,
    invited_by_user_id uuid NOT NULL,
    accepted_by_user_id uuid,
    expires_at timestamp(6) with time zone NOT NULL,
    responded_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.challenge_staff_invitation FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_staff_invitation OWNER TO ip_migrator;

--
-- Name: challenge_submission_requirement_version; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_submission_requirement_version (
    id uuid NOT NULL,
    organization_id uuid CONSTRAINT challenge_submission_requirement_versi_organization_id_not_null NOT NULL,
    challenge_id uuid NOT NULL,
    version integer NOT NULL,
    guidance text,
    require_title boolean DEFAULT true NOT NULL,
    require_tagline boolean DEFAULT false CONSTRAINT challenge_submission_requirement_versi_require_tagline_not_null NOT NULL,
    require_problem_statement boolean DEFAULT true CONSTRAINT challenge_submission_require_require_problem_statement_not_null NOT NULL,
    require_solution_description boolean DEFAULT true CONSTRAINT challenge_submission_requir_require_solution_descripti_not_null NOT NULL,
    require_impact_beneficiaries boolean DEFAULT false CONSTRAINT challenge_submission_requir_require_impact_beneficiari_not_null NOT NULL,
    require_technology_tags boolean DEFAULT false CONSTRAINT challenge_submission_requireme_require_technology_tags_not_null NOT NULL,
    require_repository_url boolean DEFAULT false CONSTRAINT challenge_submission_requiremen_require_repository_url_not_null NOT NULL,
    require_demo_url boolean DEFAULT false CONSTRAINT challenge_submission_requirement_vers_require_demo_url_not_null NOT NULL,
    require_pitch_video_url boolean DEFAULT false CONSTRAINT challenge_submission_requireme_require_pitch_video_url_not_null NOT NULL,
    require_presentation_asset boolean DEFAULT false CONSTRAINT challenge_submission_requir_require_presentation_asset_not_null NOT NULL,
    require_supporting_links boolean DEFAULT false CONSTRAINT challenge_submission_requirem_require_supporting_links_not_null NOT NULL,
    require_publication_consent boolean DEFAULT false CONSTRAINT challenge_submission_requir_require_publication_consen_not_null NOT NULL,
    min_screenshots integer DEFAULT 0 CONSTRAINT challenge_submission_requirement_versi_min_screenshots_not_null NOT NULL,
    max_screenshots integer DEFAULT 4 CONSTRAINT challenge_submission_requirement_versi_max_screenshots_not_null NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    locked_at timestamp(6) with time zone,
    created_by_user_id uuid CONSTRAINT challenge_submission_requirement_ve_created_by_user_id_not_null NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT submission_requirement_screenshot_range_chk CHECK ((((min_screenshots >= 0) AND (min_screenshots <= 4)) AND ((max_screenshots >= 0) AND (max_screenshots <= 4)) AND (min_screenshots <= max_screenshots))),
    CONSTRAINT submission_requirement_version_chk CHECK ((version > 0))
);

ALTER TABLE ONLY public.challenge_submission_requirement_version FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_submission_requirement_version OWNER TO ip_migrator;

--
-- Name: challenge_team; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_team (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    track_id uuid,
    name character varying(120) NOT NULL,
    is_solo boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.challenge_team FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_team OWNER TO ip_migrator;

--
-- Name: challenge_team_member; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_team_member (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public."TeamMemberRole" DEFAULT 'MEMBER'::public."TeamMemberRole" NOT NULL,
    joined_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.challenge_team_member FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_team_member OWNER TO ip_migrator;

--
-- Name: challenge_terms_version; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_terms_version (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    version integer NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    activated_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.challenge_terms_version FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_terms_version OWNER TO ip_migrator;

--
-- Name: challenge_track; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.challenge_track (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    description character varying(2000),
    archived_at timestamp(6) with time zone,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.challenge_track FORCE ROW LEVEL SECURITY;


ALTER TABLE public.challenge_track OWNER TO ip_migrator;

--
-- Name: consent_record; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.consent_record (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    terms_version_id uuid NOT NULL,
    context character varying(60) NOT NULL,
    accepted_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.consent_record FORCE ROW LEVEL SECURITY;


ALTER TABLE public.consent_record OWNER TO ip_migrator;

--
-- Name: content_report; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.content_report (
    id uuid NOT NULL,
    reporter_user_id uuid NOT NULL,
    target_type public."ContentReportTargetType" NOT NULL,
    target_id uuid NOT NULL,
    target_organization_id uuid,
    category public."ContentReportCategory" NOT NULL,
    description character varying(2000) NOT NULL,
    status public."ContentReportStatus" DEFAULT 'OPEN'::public."ContentReportStatus" NOT NULL,
    reviewed_by_user_id uuid,
    reviewed_at timestamp(6) with time zone,
    resolution_reason character varying(2000),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.content_report OWNER TO ip_migrator;

--
-- Name: criterion_score; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.criterion_score (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    scorecard_id uuid NOT NULL,
    rubric_version_id uuid NOT NULL,
    criterion_id uuid NOT NULL,
    score integer NOT NULL,
    comment character varying(2000),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.criterion_score FORCE ROW LEVEL SECURITY;


ALTER TABLE public.criterion_score OWNER TO ip_migrator;

--
-- Name: data_export; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.data_export (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    requested_by_user_id uuid NOT NULL,
    export_type public."ExportType" NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public."ExportStatus" DEFAULT 'PENDING'::public."ExportStatus" NOT NULL,
    storage_key character varying(500),
    file_size_bytes integer,
    row_count integer,
    failure_reason character varying(1000),
    expires_at timestamp(6) with time zone,
    completed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.data_export FORCE ROW LEVEL SECURITY;


ALTER TABLE public.data_export OWNER TO ip_migrator;

--
-- Name: email_delivery; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.email_delivery (
    id uuid NOT NULL,
    organization_id uuid,
    recipient_user_id uuid,
    recipient_email character varying(320) NOT NULL,
    category character varying(80) NOT NULL,
    subject character varying(500) NOT NULL,
    body_ciphertext text NOT NULL,
    body_key_version integer NOT NULL,
    disable_tracking boolean DEFAULT false NOT NULL,
    source_type character varying(80) NOT NULL,
    source_key character varying(255) NOT NULL,
    content_hash character(64) NOT NULL,
    status public."EmailDeliveryStatus" DEFAULT 'PENDING'::public."EmailDeliveryStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    provider_message_id character varying(255),
    last_error character varying(1000),
    next_attempt_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    lease_expires_at timestamp(6) with time zone,
    last_provider_event_at timestamp(6) with time zone,
    sent_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT email_delivery_attempts_chk CHECK ((attempts >= 0)),
    CONSTRAINT email_delivery_state_chk CHECK ((((status = 'SENT'::public."EmailDeliveryStatus") AND (sent_at IS NOT NULL) AND (provider_message_id IS NOT NULL)) OR ((status = 'SUPPRESSED'::public."EmailDeliveryStatus") AND (sent_at IS NULL)) OR (status <> ALL (ARRAY['SENT'::public."EmailDeliveryStatus", 'SUPPRESSED'::public."EmailDeliveryStatus"]))))
);

ALTER TABLE ONLY public.email_delivery FORCE ROW LEVEL SECURITY;


ALTER TABLE public.email_delivery OWNER TO ip_migrator;

--
-- Name: TABLE email_delivery; Type: COMMENT; Schema: public; Owner: ip_migrator
--

COMMENT ON TABLE public.email_delivery IS 'Durable encrypted per-recipient email obligations; source_key is the local idempotency authority.';


--
-- Name: email_delivery_attempt; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.email_delivery_attempt (
    id uuid NOT NULL,
    email_delivery_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    outcome public."EmailDeliveryAttemptOutcome" DEFAULT 'STARTED'::public."EmailDeliveryAttemptOutcome" NOT NULL,
    provider_message_id character varying(255),
    error character varying(1000),
    started_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    finished_at timestamp(6) with time zone,
    CONSTRAINT email_delivery_attempt_completion_chk CHECK ((((outcome = 'STARTED'::public."EmailDeliveryAttemptOutcome") AND (finished_at IS NULL)) OR ((outcome <> 'STARTED'::public."EmailDeliveryAttemptOutcome") AND (finished_at IS NOT NULL)))),
    CONSTRAINT email_delivery_attempt_number_chk CHECK ((attempt_number > 0))
);

ALTER TABLE ONLY public.email_delivery_attempt FORCE ROW LEVEL SECURITY;


ALTER TABLE public.email_delivery_attempt OWNER TO ip_migrator;

--
-- Name: TABLE email_delivery_attempt; Type: COMMENT; Schema: public; Owner: ip_migrator
--

COMMENT ON TABLE public.email_delivery_attempt IS 'Provider-attempt evidence retained for delivery reconciliation and incident review.';


--
-- Name: email_suppression; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.email_suppression (
    id uuid NOT NULL,
    email character varying(320) NOT NULL,
    reason public."SuppressionReason" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.email_suppression OWNER TO ip_migrator;

--
-- Name: faq; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.faq (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid,
    question character varying(500) NOT NULL,
    answer text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.faq FORCE ROW LEVEL SECURITY;


ALTER TABLE public.faq OWNER TO ip_migrator;

--
-- Name: file_asset; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.file_asset (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid,
    stored_object_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    purpose public."FileAssetPurpose" NOT NULL,
    resource_type character varying(80) NOT NULL,
    resource_id uuid NOT NULL,
    display_name character varying(255) NOT NULL,
    status public."FileAssetStatus" DEFAULT 'ACTIVE'::public."FileAssetStatus" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT file_asset_challenge_purpose_chk CHECK ((((purpose = 'SUBMISSION_PRESENTATION'::public."FileAssetPurpose") AND (challenge_id IS NOT NULL) AND ((resource_type)::text = 'submission_version'::text)) OR ((purpose = 'SUPPORT_ATTACHMENT'::public."FileAssetPurpose") AND ((resource_type)::text = 'support_ticket'::text)) OR ((purpose = 'PORTFOLIO_EVIDENCE'::public."FileAssetPurpose") AND ((resource_type)::text = 'innovation'::text)))),
    CONSTRAINT file_asset_state_chk CHECK (((status = 'ACTIVE'::public."FileAssetStatus") OR (status = ANY (ARRAY['PENDING_DELETION'::public."FileAssetStatus", 'DELETED'::public."FileAssetStatus"]))))
);

ALTER TABLE ONLY public.file_asset FORCE ROW LEVEL SECURITY;


ALTER TABLE public.file_asset OWNER TO ip_migrator;

--
-- Name: form_definition; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.form_definition (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    purpose public."FormPurpose" NOT NULL,
    challenge_id uuid,
    name character varying(200) NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.form_definition FORCE ROW LEVEL SECURITY;


ALTER TABLE public.form_definition OWNER TO ip_migrator;

--
-- Name: form_response; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.form_response (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    form_version_id uuid NOT NULL,
    user_id uuid NOT NULL,
    response_data jsonb NOT NULL,
    submitted_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    challenge_id uuid,
    is_draft boolean DEFAULT false NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.form_response FORCE ROW LEVEL SECURITY;


ALTER TABLE public.form_response OWNER TO ip_migrator;

--
-- Name: form_version; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.form_version (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    form_definition_id uuid NOT NULL,
    version integer NOT NULL,
    schema jsonb NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp(6) with time zone,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    challenge_id uuid
);

ALTER TABLE ONLY public.form_version FORCE ROW LEVEL SECURITY;


ALTER TABLE public.form_version OWNER TO ip_migrator;

--
-- Name: idempotency_record; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.idempotency_record (
    id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    operation character varying(120) NOT NULL,
    idempotency_key character varying(255) NOT NULL,
    request_hash character(64) NOT NULL,
    response_status integer,
    response_body jsonb,
    organization_id uuid,
    request_id character varying(64),
    completed_at timestamp(6) with time zone,
    expires_at timestamp(6) with time zone NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.idempotency_record FORCE ROW LEVEL SECURITY;


ALTER TABLE public.idempotency_record OWNER TO ip_migrator;

--
-- Name: innovation; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.innovation (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    source_challenge_id uuid,
    source_submission_id uuid,
    title character varying(200) NOT NULL,
    opportunity_statement text,
    thesis text,
    owner_user_id uuid,
    owner_team_name character varying(200),
    strategic_themes text[],
    expected_impact text,
    risk_level public."InnovationRiskLevel",
    beneficiaries character varying(2000),
    stage public."InnovationStage" DEFAULT 'DISCOVERY'::public."InnovationStage" NOT NULL,
    resource_notes text,
    next_review_date date,
    public_visible boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.innovation FORCE ROW LEVEL SECURITY;


ALTER TABLE public.innovation OWNER TO ip_migrator;

--
-- Name: innovation_evidence; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.innovation_evidence (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    innovation_id uuid NOT NULL,
    type public."InnovationEvidenceType" NOT NULL,
    title character varying(200) NOT NULL,
    url character varying(2048),
    media_asset_id uuid,
    note character varying(2000),
    added_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.innovation_evidence FORCE ROW LEVEL SECURITY;


ALTER TABLE public.innovation_evidence OWNER TO ip_migrator;

--
-- Name: innovation_metric; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.innovation_metric (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    innovation_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    metric_type public."InnovationMetricType" NOT NULL,
    unit character varying(40),
    target_value numeric(18,4),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.innovation_metric FORCE ROW LEVEL SECURITY;


ALTER TABLE public.innovation_metric OWNER TO ip_migrator;

--
-- Name: innovation_metric_measurement; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.innovation_metric_measurement (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    metric_id uuid NOT NULL,
    value numeric(18,4) NOT NULL,
    measured_at timestamp(6) with time zone NOT NULL,
    note character varying(1000),
    recorded_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.innovation_metric_measurement FORCE ROW LEVEL SECURITY;


ALTER TABLE public.innovation_metric_measurement OWNER TO ip_migrator;

--
-- Name: innovation_milestone; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.innovation_milestone (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    innovation_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description character varying(2000),
    status public."InnovationMilestoneStatus" DEFAULT 'PLANNED'::public."InnovationMilestoneStatus" NOT NULL,
    due_date date,
    completed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.innovation_milestone FORCE ROW LEVEL SECURITY;


ALTER TABLE public.innovation_milestone OWNER TO ip_migrator;

--
-- Name: innovation_stage_history; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.innovation_stage_history (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    innovation_id uuid NOT NULL,
    previous_stage public."InnovationStage",
    new_stage public."InnovationStage" NOT NULL,
    decision character varying(2000) NOT NULL,
    decision_maker_user_id uuid NOT NULL,
    evidence_refs text[],
    notes character varying(2000),
    next_review_date date,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.innovation_stage_history FORCE ROW LEVEL SECURITY;


ALTER TABLE public.innovation_stage_history OWNER TO ip_migrator;

--
-- Name: integration; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.integration (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    provider public."IntegrationProvider" NOT NULL,
    webhook_url_ciphertext text NOT NULL,
    status public."IntegrationStatus" DEFAULT 'ACTIVE'::public."IntegrationStatus" NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.integration FORCE ROW LEVEL SECURITY;


ALTER TABLE public.integration OWNER TO ip_migrator;

--
-- Name: integration_delivery; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.integration_delivery (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    event_type character varying(120) NOT NULL,
    succeeded boolean,
    response_status integer,
    error_message character varying(1000),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_key character varying(255) NOT NULL,
    message character varying(4000) NOT NULL,
    status public."IntegrationDeliveryStatus" DEFAULT 'PENDING'::public."IntegrationDeliveryStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp(6) with time zone,
    completed_at timestamp(6) with time zone,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT integration_delivery_attempts_chk CHECK ((attempts >= 0)),
    CONSTRAINT integration_delivery_state_chk CHECK ((((status = 'PENDING'::public."IntegrationDeliveryStatus") AND (succeeded IS NULL) AND (completed_at IS NULL)) OR ((status = 'SENDING'::public."IntegrationDeliveryStatus") AND (succeeded IS NULL) AND (completed_at IS NULL)) OR ((status = 'SUCCEEDED'::public."IntegrationDeliveryStatus") AND (succeeded = true) AND (completed_at IS NOT NULL)) OR ((status = 'FAILED'::public."IntegrationDeliveryStatus") AND (succeeded = false) AND (completed_at IS NOT NULL))))
);

ALTER TABLE ONLY public.integration_delivery FORCE ROW LEVEL SECURITY;


ALTER TABLE public.integration_delivery OWNER TO ip_migrator;

--
-- Name: integration_delivery_attempt; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.integration_delivery_attempt (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    integration_delivery_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    outcome public."IntegrationDeliveryAttemptOutcome" DEFAULT 'STARTED'::public."IntegrationDeliveryAttemptOutcome" NOT NULL,
    response_status integer,
    error_message character varying(1000),
    started_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    finished_at timestamp(6) with time zone,
    CONSTRAINT integration_attempt_completion_chk CHECK ((((outcome = 'STARTED'::public."IntegrationDeliveryAttemptOutcome") AND (finished_at IS NULL)) OR ((outcome <> 'STARTED'::public."IntegrationDeliveryAttemptOutcome") AND (finished_at IS NOT NULL)))),
    CONSTRAINT integration_attempt_number_chk CHECK ((attempt_number > 0))
);

ALTER TABLE ONLY public.integration_delivery_attempt FORCE ROW LEVEL SECURITY;


ALTER TABLE public.integration_delivery_attempt OWNER TO ip_migrator;

--
-- Name: judge_assignment; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.judge_assignment (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    staff_assignment_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    status public."JudgeAssignmentStatus" DEFAULT 'ASSIGNED'::public."JudgeAssignmentStatus" NOT NULL,
    conflict_declared_at timestamp(6) with time zone,
    recused_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.judge_assignment FORCE ROW LEVEL SECURITY;


ALTER TABLE public.judge_assignment OWNER TO ip_migrator;

--
-- Name: matchmaking_interest; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.matchmaking_interest (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    post_id uuid NOT NULL,
    interested_user_id uuid NOT NULL,
    message character varying(1000),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.matchmaking_interest FORCE ROW LEVEL SECURITY;


ALTER TABLE public.matchmaking_interest OWNER TO ip_migrator;

--
-- Name: matchmaking_post; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.matchmaking_post (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    poster_user_id uuid NOT NULL,
    poster_team_id uuid,
    skills_offered text[],
    roles_sought text[],
    message character varying(2000) NOT NULL,
    availability character varying(500),
    contact_preference character varying(500),
    is_open boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.matchmaking_post FORCE ROW LEVEL SECURITY;


ALTER TABLE public.matchmaking_post OWNER TO ip_migrator;

--
-- Name: media_asset; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.media_asset (
    id uuid NOT NULL,
    purpose public."MediaAssetPurpose" NOT NULL,
    status public."MediaAssetStatus" DEFAULT 'PENDING'::public."MediaAssetStatus" NOT NULL,
    delivery_type public."MediaAssetDeliveryType" DEFAULT 'UPLOAD'::public."MediaAssetDeliveryType" NOT NULL,
    organization_id uuid,
    owner_user_id uuid NOT NULL,
    resource_type character varying(80) NOT NULL,
    resource_id uuid NOT NULL,
    cloudinary_public_id character varying(300) NOT NULL,
    format character varying(20),
    bytes integer,
    width integer,
    height integer,
    expires_at timestamp(6) with time zone NOT NULL,
    confirmed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    challenge_id uuid,
    deletion_requested_at timestamp(6) with time zone,
    deleted_at timestamp(6) with time zone,
    CONSTRAINT media_asset_confirmed_metadata_chk CHECK ((((status <> 'CONFIRMED'::public."MediaAssetStatus") OR (confirmed_at IS NOT NULL)) AND ((confirmed_at IS NULL) OR ((format IS NOT NULL) AND (bytes IS NOT NULL) AND (width IS NOT NULL) AND (height IS NOT NULL))))),
    CONSTRAINT media_asset_scope_chk CHECK (
      ((purpose = 'USER_AVATAR'::public."MediaAssetPurpose")
        AND organization_id IS NULL AND challenge_id IS NULL
        AND resource_type = 'user' AND resource_id = owner_user_id)
      OR ((purpose = 'ORGANIZATION_LOGO'::public."MediaAssetPurpose")
        AND organization_id IS NOT NULL AND challenge_id IS NULL
        AND resource_type = 'organization' AND resource_id = organization_id)
      OR ((purpose = 'CHALLENGE_COVER'::public."MediaAssetPurpose")
        AND organization_id IS NOT NULL AND challenge_id IS NOT NULL
        AND resource_type = 'challenge' AND resource_id = challenge_id)
      OR ((purpose = 'SPONSOR_LOGO'::public."MediaAssetPurpose")
        AND organization_id IS NOT NULL AND challenge_id IS NOT NULL
        AND resource_type = 'challenge_sponsor')
      OR ((purpose = 'SUBMISSION_SCREENSHOT'::public."MediaAssetPurpose")
        AND organization_id IS NOT NULL AND challenge_id IS NOT NULL
        AND resource_type = 'submission')
      OR ((purpose = 'SUPPORT_TICKET_SCREENSHOT'::public."MediaAssetPurpose")
        AND challenge_id IS NULL
        AND resource_type = 'support_ticket')
      OR ((purpose = 'PORTFOLIO_EVIDENCE'::public."MediaAssetPurpose")
        AND organization_id IS NOT NULL AND challenge_id IS NULL
        AND resource_type = 'innovation')
    )
);

ALTER TABLE ONLY public.media_asset FORCE ROW LEVEL SECURITY;


ALTER TABLE public.media_asset OWNER TO ip_migrator;

--
-- Name: notification; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.notification (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    category public."NotificationCategory" NOT NULL,
    title character varying(200) NOT NULL,
    body character varying(2000) NOT NULL,
    link_url character varying(2048),
    read_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_key character varying(255)
);

ALTER TABLE ONLY public.notification FORCE ROW LEVEL SECURITY;


ALTER TABLE public.notification OWNER TO ip_migrator;

--
-- Name: notification_preference; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.notification_preference (
    user_id uuid NOT NULL,
    disabled_categories public."NotificationCategory"[],
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.notification_preference FORCE ROW LEVEL SECURITY;


ALTER TABLE public.notification_preference OWNER TO ip_migrator;

--
-- Name: organization; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization (
    id uuid NOT NULL,
    slug character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    description character varying(4000),
    organization_type character varying(60) NOT NULL,
    website_url character varying(2048),
    social_links jsonb,
    country character varying(80),
    region character varying(120),
    logo_asset_id uuid,
    status public."OrganizationStatus" DEFAULT 'ACTIVE'::public."OrganizationStatus" NOT NULL,
    visibility public."OrganizationVisibility" DEFAULT 'PRIVATE'::public."OrganizationVisibility" NOT NULL,
    suspended_at timestamp(6) with time zone,
    suspended_reason character varying(2000),
    archived_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT organization_archived_consistency_chk CHECK (((status <> 'ARCHIVED'::public."OrganizationStatus") OR (archived_at IS NOT NULL))),
    CONSTRAINT organization_suspended_consistency_chk CHECK (((status <> 'SUSPENDED'::public."OrganizationStatus") OR (suspended_at IS NOT NULL)))
);

ALTER TABLE ONLY public.organization FORCE ROW LEVEL SECURITY;


ALTER TABLE public.organization OWNER TO ip_migrator;

--
-- Name: organization_application; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization_application (
    id uuid NOT NULL,
    requester_user_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    requested_slug character varying(64) NOT NULL,
    organization_type character varying(60) NOT NULL,
    description character varying(4000) NOT NULL,
    website_url character varying(2048),
    social_links jsonb,
    country character varying(80),
    region character varying(120),
    affiliated_institution character varying(200),
    requester_relationship character varying(200) NOT NULL,
    requested_visibility public."OrganizationVisibility" DEFAULT 'PRIVATE'::public."OrganizationVisibility" NOT NULL,
    accepted_terms_version character varying(40) NOT NULL,
    accepted_terms_at timestamp(6) with time zone NOT NULL,
    verification_evidence jsonb,
    status public."OrganizationApplicationStatus" DEFAULT 'PENDING_REVIEW'::public."OrganizationApplicationStatus" NOT NULL,
    submitted_at timestamp(6) with time zone,
    reviewed_by_user_id uuid,
    reviewed_at timestamp(6) with time zone,
    decision_reason character varying(2000),
    internal_notes character varying(4000),
    created_organization_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT org_application_approved_creates_org_chk CHECK (((status <> 'APPROVED'::public."OrganizationApplicationStatus") OR (created_organization_id IS NOT NULL))),
    CONSTRAINT org_application_decision_consistency_chk CHECK (((status <> ALL (ARRAY['APPROVED'::public."OrganizationApplicationStatus", 'REJECTED'::public."OrganizationApplicationStatus"])) OR ((reviewed_at IS NOT NULL) AND (reviewed_by_user_id IS NOT NULL))))
);


ALTER TABLE public.organization_application OWNER TO ip_migrator;

--
-- Name: TABLE organization_application; Type: COMMENT; Schema: public; Owner: ip_migrator
--

COMMENT ON TABLE public.organization_application IS 'Pre-tenant: exists before its organization. Access is enforced by the application layer (applicant or platform staff), not RLS.';


--
-- Name: organization_invitation; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization_invitation (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    token_hash character(64) NOT NULL,
    email character varying(254),
    role public."OrganizationRole" DEFAULT 'MEMBER'::public."OrganizationRole" NOT NULL,
    status public."InvitationStatus" DEFAULT 'PENDING'::public."InvitationStatus" NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    created_by_user_id uuid NOT NULL,
    accepted_by_user_id uuid,
    accepted_at timestamp(6) with time zone,
    revoked_at timestamp(6) with time zone,
    revoked_by_user_id uuid,
    resend_count integer DEFAULT 0 NOT NULL,
    last_sent_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT invitation_accepted_consistency_chk CHECK (((status <> 'ACCEPTED'::public."InvitationStatus") OR ((accepted_at IS NOT NULL) AND (accepted_by_user_id IS NOT NULL)))),
    CONSTRAINT invitation_expiry_after_creation_chk CHECK ((expires_at > created_at)),
    CONSTRAINT invitation_revoked_consistency_chk CHECK (((status <> 'REVOKED'::public."InvitationStatus") OR (revoked_at IS NOT NULL)))
);

ALTER TABLE ONLY public.organization_invitation FORCE ROW LEVEL SECURITY;


ALTER TABLE public.organization_invitation OWNER TO ip_migrator;

--
-- Name: organization_join_code; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization_join_code (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code_hash character(64) NOT NULL,
    label character varying(120),
    role public."OrganizationRole" DEFAULT 'MEMBER'::public."OrganizationRole" NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    max_uses integer,
    use_count integer DEFAULT 0 NOT NULL,
    allowed_email_domains text[],
    revoked_at timestamp(6) with time zone,
    revoked_by_user_id uuid,
    created_by_user_id uuid NOT NULL,
    last_used_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT join_code_expiry_after_creation_chk CHECK ((expires_at > created_at)),
    CONSTRAINT join_code_max_uses_positive_chk CHECK (((max_uses IS NULL) OR (max_uses > 0))),
    CONSTRAINT join_code_use_count_non_negative_chk CHECK ((use_count >= 0)),
    CONSTRAINT join_code_use_count_within_limit_chk CHECK (((max_uses IS NULL) OR (use_count <= max_uses)))
);

ALTER TABLE ONLY public.organization_join_code FORCE ROW LEVEL SECURITY;


ALTER TABLE public.organization_join_code OWNER TO ip_migrator;

--
-- Name: organization_join_request; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization_join_request (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status public."JoinRequestStatus" DEFAULT 'PENDING'::public."JoinRequestStatus" NOT NULL,
    message character varying(2000),
    form_version_id uuid,
    form_response_id uuid,
    reviewed_by_user_id uuid,
    reviewed_at timestamp(6) with time zone,
    decision_reason character varying(2000),
    internal_notes character varying(4000),
    withdrawn_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT join_request_decision_consistency_chk CHECK (((status <> ALL (ARRAY['APPROVED'::public."JoinRequestStatus", 'REJECTED'::public."JoinRequestStatus"])) OR ((reviewed_at IS NOT NULL) AND (reviewed_by_user_id IS NOT NULL))))
);

ALTER TABLE ONLY public.organization_join_request FORCE ROW LEVEL SECURITY;


ALTER TABLE public.organization_join_request OWNER TO ip_migrator;

--
-- Name: organization_limit; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization_limit (
    organization_id uuid NOT NULL,
    max_stored_bytes bigint DEFAULT 1073741824 NOT NULL,
    max_file_count integer DEFAULT 1000 NOT NULL,
    reserved_bytes bigint DEFAULT 0 NOT NULL,
    stored_bytes bigint DEFAULT 0 NOT NULL,
    active_file_count integer DEFAULT 0 NOT NULL,
    max_concurrent_exports integer DEFAULT 3 NOT NULL,
    queue_weight integer DEFAULT 1 NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_limit_bounds_chk CHECK (((max_stored_bytes > 0) AND (max_file_count > 0) AND (reserved_bytes >= 0) AND (stored_bytes >= 0) AND (active_file_count >= 0) AND ((stored_bytes + reserved_bytes) <= max_stored_bytes) AND (active_file_count <= max_file_count) AND (max_concurrent_exports > 0) AND ((queue_weight >= 1) AND (queue_weight <= 100))))
);

ALTER TABLE ONLY public.organization_limit FORCE ROW LEVEL SECURITY;


ALTER TABLE public.organization_limit OWNER TO ip_migrator;

--
-- Name: organization_membership; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization_membership (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public."OrganizationRole" DEFAULT 'MEMBER'::public."OrganizationRole" NOT NULL,
    status public."MembershipStatus" DEFAULT 'ACTIVE'::public."MembershipStatus" NOT NULL,
    source character varying(40) DEFAULT 'INVITATION'::character varying NOT NULL,
    joined_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    removed_at timestamp(6) with time zone,
    removed_by_user_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT membership_removed_consistency_chk CHECK (((status <> 'INACTIVE'::public."MembershipStatus") OR (removed_at IS NOT NULL)))
);

ALTER TABLE ONLY public.organization_membership FORCE ROW LEVEL SECURITY;


ALTER TABLE public.organization_membership OWNER TO ip_migrator;

--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.organization_settings (
    organization_id uuid NOT NULL,
    join_policy public."OrganizationJoinPolicy" DEFAULT 'INVITE_ONLY'::public."OrganizationJoinPolicy" NOT NULL,
    allowed_email_domains text[],
    member_directory_visible_to_members boolean DEFAULT true CONSTRAINT organization_settings_member_directory_visible_to_memb_not_null NOT NULL,
    public_project_gallery_enabled boolean DEFAULT false NOT NULL,
    public_metrics_enabled boolean DEFAULT false NOT NULL,
    public_contact_email character varying(254),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT organization_join_policy_open_not_activatable_chk CHECK ((join_policy <> 'OPEN'::public."OrganizationJoinPolicy"))
);

ALTER TABLE ONLY public.organization_settings FORCE ROW LEVEL SECURITY;


ALTER TABLE public.organization_settings OWNER TO ip_migrator;

--
-- Name: outbox_event; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.outbox_event (
    id uuid NOT NULL,
    organization_id uuid,
    event_type character varying(120) NOT NULL,
    queue_name character varying(60) NOT NULL,
    aggregate_type character varying(80) NOT NULL,
    aggregate_id uuid,
    payload jsonb NOT NULL,
    state public."OutboxState" DEFAULT 'PENDING'::public."OutboxState" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    enqueued_at timestamp(6) with time zone,
    processed_at timestamp(6) with time zone,
    last_error character varying(1000),
    request_id character varying(64),
    trace_parent character varying(200),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    dedupe_key character varying(255),
    actor_user_id uuid DEFAULT public.app_current_actor_id()
);

ALTER TABLE ONLY public.outbox_event FORCE ROW LEVEL SECURITY;


ALTER TABLE public.outbox_event OWNER TO ip_migrator;

--
-- Name: platform_role_assignment; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.platform_role_assignment (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public."PlatformRole" NOT NULL,
    granted_by uuid,
    reason character varying(1000),
    granted_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_at timestamp(6) with time zone,
    revoked_by uuid
);


ALTER TABLE public.platform_role_assignment OWNER TO ip_migrator;

--
-- Name: public_announcement_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_announcement_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT a.id,
    a.organization_id,
    o.slug AS organization_slug,
    c.id AS challenge_id,
    c.slug AS challenge_slug,
    a.title,
    a.body,
    a.priority,
    a.published_at,
    a.created_at
   FROM ((public.announcement a
     JOIN public.challenge c ON ((c.id = a.challenge_id)))
     JOIN public.organization o ON ((o.id = a.organization_id)))
  WHERE ((a.is_published = true) AND (c.visibility = 'PUBLIC'::public."ChallengeVisibility") AND (c.published_at IS NOT NULL) AND (c.moderation_hidden_at IS NULL) AND (o.status = 'ACTIVE'::public."OrganizationStatus"));


ALTER VIEW public.public_announcement_view OWNER TO ip_public_views;

--
-- Name: VIEW public_announcement_view; Type: COMMENT; Schema: public; Owner: ip_public_views
--

COMMENT ON VIEW public.public_announcement_view IS 'Public-safe, published-only challenge announcement projection. Organization-wide (challenge_id null) announcements are never included. See docs/adr/0013-public-projection-views.md.';


--
-- Name: public_challenge_track_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_challenge_track_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT t.id,
    t.organization_id,
    o.slug AS organization_slug,
    c.id AS challenge_id,
    c.slug AS challenge_slug,
    t.name,
    t.description,
    t.archived_at,
    t.display_order,
    t.created_at
   FROM ((public.challenge_track t
     JOIN public.challenge c ON ((c.id = t.challenge_id)))
     JOIN public.organization o ON ((o.id = t.organization_id)))
  WHERE ((c.visibility = 'PUBLIC'::public."ChallengeVisibility") AND (c.published_at IS NOT NULL) AND (c.moderation_hidden_at IS NULL) AND (o.status = 'ACTIVE'::public."OrganizationStatus"));


ALTER VIEW public.public_challenge_track_view OWNER TO ip_public_views;

--
-- Name: VIEW public_challenge_track_view; Type: COMMENT; Schema: public; Owner: ip_public_views
--

COMMENT ON VIEW public.public_challenge_track_view IS 'Public-safe challenge track projection, scoped to challenges eligible under public_challenge_view. See docs/adr/0013-public-projection-views.md.';


--
-- Name: public_challenge_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_challenge_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT c.id,
    c.organization_id,
    o.slug AS organization_slug,
    o.name AS organization_name,
    c.slug,
    c.title,
    c.summary,
    c.description,
    c.cover_asset_id,
    c.status,
    c.published_at,
    c.registration_open_at,
    c.registration_close_at,
    c.submission_open_at,
    c.submission_deadline,
    c.judging_start_at,
    c.judging_end_at,
    c.results_published_at,
    c.display_time_zone,
    c.min_team_size,
    c.max_team_size,
    c.solo_participation_allowed,
    c.participation_policy,
    c.created_at
   FROM (public.challenge c
     JOIN public.organization o ON ((o.id = c.organization_id)))
  WHERE ((c.visibility = 'PUBLIC'::public."ChallengeVisibility") AND (c.published_at IS NOT NULL) AND (c.moderation_hidden_at IS NULL) AND (o.status = 'ACTIVE'::public."OrganizationStatus"));


ALTER VIEW public.public_challenge_view OWNER TO ip_public_views;

--
-- Name: VIEW public_challenge_view; Type: COMMENT; Schema: public; Owner: ip_public_views
--

COMMENT ON VIEW public.public_challenge_view IS 'Public-safe challenge projection. Excludes unpublished/non-public/moderation-hidden challenges and those belonging to a non-active organization. See docs/adr/0013-public-projection-views.md.';


--
-- Name: public_faq_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_faq_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT f.id,
    f.organization_id,
    o.slug AS organization_slug,
    c.id AS challenge_id,
    c.slug AS challenge_slug,
    f.question,
    f.answer,
    f.display_order,
    f.created_at
   FROM ((public.faq f
     JOIN public.challenge c ON ((c.id = f.challenge_id)))
     JOIN public.organization o ON ((o.id = f.organization_id)))
  WHERE ((f.is_published = true) AND (c.visibility = 'PUBLIC'::public."ChallengeVisibility") AND (c.published_at IS NOT NULL) AND (c.moderation_hidden_at IS NULL) AND (o.status = 'ACTIVE'::public."OrganizationStatus"));


ALTER VIEW public.public_faq_view OWNER TO ip_public_views;

--
-- Name: VIEW public_faq_view; Type: COMMENT; Schema: public; Owner: ip_public_views
--

COMMENT ON VIEW public.public_faq_view IS 'Public-safe, published-only challenge FAQ projection. Organization-wide (challenge_id null) entries are never included. See docs/adr/0013-public-projection-views.md.';


--
-- Name: public_innovation_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_innovation_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT i.id,
    i.organization_id,
    o.slug AS organization_slug,
    o.name AS organization_name,
    i.title,
    i.opportunity_statement,
    i.thesis,
    i.expected_impact,
    i.beneficiaries,
    i.strategic_themes,
    i.stage,
    i.created_at
   FROM (public.innovation i
     JOIN public.organization o ON ((o.id = i.organization_id)))
  WHERE ((i.public_visible = true) AND (o.status = 'ACTIVE'::public."OrganizationStatus"));


ALTER VIEW public.public_innovation_view OWNER TO ip_public_views;

--
-- Name: VIEW public_innovation_view; Type: COMMENT; Schema: public; Owner: ip_public_views
--

COMMENT ON VIEW public.public_innovation_view IS 'Public-safe innovation projection. Only organizer-approved (public_visible=true) items in an ACTIVE organization. See docs/adr/0013-public-projection-views.md.';


--
-- Name: public_organization_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_organization_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT id,
    slug,
    name,
    description,
    organization_type,
    website_url,
    country,
    region,
    logo_asset_id,
    created_at
   FROM public.organization o
  WHERE ((status = 'ACTIVE'::public."OrganizationStatus") AND (visibility = 'PUBLIC'::public."OrganizationVisibility"));


ALTER VIEW public.public_organization_view OWNER TO ip_public_views;

--
-- Name: VIEW public_organization_view; Type: COMMENT; Schema: public; Owner: ip_public_views
--

COMMENT ON VIEW public.public_organization_view IS 'Public-safe organization projection. Excludes suspended/archived/private organizations and every non-public column. See docs/adr/0013-public-projection-views.md.';


--
-- Name: submission; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.submission (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    team_id uuid NOT NULL,
    track_id uuid,
    status public."SubmissionStatus" DEFAULT 'DRAFT'::public."SubmissionStatus" NOT NULL,
    draft_version_id uuid,
    final_version_id uuid,
    disqualified_at timestamp(6) with time zone,
    disqualified_by_user_id uuid,
    disqualification_reason character varying(1000),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    finalized_at timestamp(6) with time zone
);

ALTER TABLE ONLY public.submission FORCE ROW LEVEL SECURITY;


ALTER TABLE public.submission OWNER TO ip_migrator;

--
-- Name: submission_technology; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.submission_technology (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    submission_version_id uuid NOT NULL,
    technology_tag_id uuid NOT NULL,
    display_label_snapshot character varying(80) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.submission_technology FORCE ROW LEVEL SECURITY;


ALTER TABLE public.submission_technology OWNER TO ip_migrator;

--
-- Name: submission_version; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.submission_version (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    version_number integer NOT NULL,
    is_final boolean DEFAULT false NOT NULL,
    title character varying(200),
    tagline character varying(300),
    problem_statement text,
    solution_description text,
    impact_beneficiaries text,
    repository_url character varying(2048),
    demo_url character varying(2048),
    pitch_video_url character varying(2048),
    presentation_url character varying(2048),
    supporting_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    publication_consent boolean DEFAULT false NOT NULL,
    terms_version_id uuid,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    challenge_id uuid NOT NULL
);

ALTER TABLE ONLY public.submission_version FORCE ROW LEVEL SECURITY;


ALTER TABLE public.submission_version OWNER TO ip_migrator;

--
-- Name: public_project_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_project_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT s.id,
    s.organization_id,
    o.slug AS organization_slug,
    o.name AS organization_name,
    c.id AS challenge_id,
    c.slug AS challenge_slug,
    c.title AS challenge_title,
    t.name AS team_name,
    v.title,
    v.tagline,
    v.solution_description,
    v.impact_beneficiaries,
    COALESCE(technologies.names, ('{}'::text[])::character varying[]) AS technology_tags,
    v.repository_url,
    v.demo_url,
    v.pitch_video_url,
    v.presentation_url,
    v.created_at
   FROM (((((public.submission s
     JOIN public.submission_version v ON (((v.id = s.final_version_id) AND (v.organization_id = s.organization_id))))
     JOIN public.challenge c ON ((c.id = s.challenge_id)))
     JOIN public.challenge_team t ON (((t.id = s.team_id) AND (t.organization_id = s.organization_id))))
     JOIN public.organization o ON ((o.id = s.organization_id)))
     LEFT JOIN LATERAL ( SELECT array_agg(st.display_label_snapshot ORDER BY st.created_at, st.id) AS names
           FROM public.submission_technology st
          WHERE (st.submission_version_id = v.id)) technologies ON (true))
  WHERE ((v.publication_consent = true) AND (s.disqualified_at IS NULL) AND (c.visibility = 'PUBLIC'::public."ChallengeVisibility") AND (c.published_at IS NOT NULL) AND (c.moderation_hidden_at IS NULL) AND (o.status = 'ACTIVE'::public."OrganizationStatus"));


ALTER VIEW public.public_project_view OWNER TO ip_public_views;

--
-- Name: result_snapshot; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.result_snapshot (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    "publicationVersion" integer NOT NULL,
    status public."ResultSnapshotStatus" DEFAULT 'FINALIZED'::public."ResultSnapshotStatus" NOT NULL,
    finalized_by_user_id uuid NOT NULL,
    finalized_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    published_at timestamp(6) with time zone,
    retracted_at timestamp(6) with time zone,
    retraction_reason character varying(2000),
    CONSTRAINT result_snapshot_state_chk CHECK ((((status = 'FINALIZED'::public."ResultSnapshotStatus") AND (published_at IS NULL) AND (retracted_at IS NULL)) OR ((status = 'PUBLISHED'::public."ResultSnapshotStatus") AND (published_at IS NOT NULL) AND (retracted_at IS NULL)) OR ((status = 'RETRACTED'::public."ResultSnapshotStatus") AND (published_at IS NOT NULL) AND (retracted_at IS NOT NULL) AND (retraction_reason IS NOT NULL))))
);

ALTER TABLE ONLY public.result_snapshot FORCE ROW LEVEL SECURITY;


ALTER TABLE public.result_snapshot OWNER TO ip_migrator;

--
-- Name: submission_result; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.submission_result (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    track_id uuid,
    rank_label character varying(120),
    rank integer,
    aggregate_score integer,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    snapshot_id uuid NOT NULL,
    submission_version_id uuid NOT NULL,
    selection_type public."ResultSelectionType" DEFAULT 'RANKED'::public."ResultSelectionType" NOT NULL,
    tie_break_decision character varying(2000),
    CONSTRAINT submission_result_rank_chk CHECK (((rank IS NULL) OR (rank > 0))),
    CONSTRAINT submission_result_tiebreak_chk CHECK (((tie_break_decision IS NULL) OR (length(btrim((tie_break_decision)::text)) > 0)))
);

ALTER TABLE ONLY public.submission_result FORCE ROW LEVEL SECURITY;


ALTER TABLE public.submission_result OWNER TO ip_migrator;

--
-- Name: public_submission_result_view; Type: VIEW; Schema: public; Owner: ip_public_views
--

CREATE VIEW public.public_submission_result_view WITH (security_barrier='true', security_invoker='false') AS
 SELECT r.id,
    r.organization_id,
    o.slug AS organization_slug,
    c.id AS challenge_id,
    c.slug AS challenge_slug,
    r.submission_id,
    r.track_id,
    r.rank_label,
    r.rank,
    r.aggregate_score,
    r.created_at
   FROM (((public.submission_result r
     JOIN public.result_snapshot rs ON (((rs.id = r.snapshot_id) AND (rs.organization_id = r.organization_id))))
     JOIN public.challenge c ON (((c.id = r.challenge_id) AND (c.organization_id = r.organization_id))))
     JOIN public.organization o ON ((o.id = r.organization_id)))
  WHERE ((rs.status = 'PUBLISHED'::public."ResultSnapshotStatus") AND (c.results_published_at IS NOT NULL) AND (c.visibility = 'PUBLIC'::public."ChallengeVisibility") AND (c.published_at IS NOT NULL) AND (c.moderation_hidden_at IS NULL) AND (o.status = 'ACTIVE'::public."OrganizationStatus"));


ALTER VIEW public.public_submission_result_view OWNER TO ip_public_views;

--
-- Name: reminder_schedule; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.reminder_schedule (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid,
    innovation_id uuid,
    kind public."ReminderScheduleKind" NOT NULL,
    deterministic_key character varying(255) NOT NULL,
    scheduled_for timestamp(6) with time zone NOT NULL,
    target_at timestamp(6) with time zone NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    last_dispatched_revision integer,
    status public."ReminderScheduleStatus" DEFAULT 'SCHEDULED'::public."ReminderScheduleStatus" NOT NULL,
    sent_at timestamp(6) with time zone,
    cancelled_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT reminder_schedule_dispatch_revision_ck CHECK (((last_dispatched_revision IS NULL) OR (last_dispatched_revision <= revision))),
    CONSTRAINT reminder_schedule_resource_ck CHECK ((((kind = 'PORTFOLIO_REVIEW'::public."ReminderScheduleKind") AND (innovation_id IS NOT NULL) AND (challenge_id IS NULL)) OR ((kind <> 'PORTFOLIO_REVIEW'::public."ReminderScheduleKind") AND (challenge_id IS NOT NULL) AND (innovation_id IS NULL)))),
    CONSTRAINT reminder_schedule_revision_ck CHECK ((revision > 0)),
    CONSTRAINT reminder_schedule_status_ck CHECK ((((status = 'SCHEDULED'::public."ReminderScheduleStatus") AND (sent_at IS NULL) AND (cancelled_at IS NULL)) OR ((status = 'SENT'::public."ReminderScheduleStatus") AND (sent_at IS NOT NULL) AND (cancelled_at IS NULL)) OR ((status = 'CANCELLED'::public."ReminderScheduleStatus") AND (cancelled_at IS NOT NULL))))
);

ALTER TABLE ONLY public.reminder_schedule FORCE ROW LEVEL SECURITY;


ALTER TABLE public.reminder_schedule OWNER TO ip_migrator;

--
-- Name: rubric; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.rubric (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.rubric FORCE ROW LEVEL SECURITY;


ALTER TABLE public.rubric OWNER TO ip_migrator;

--
-- Name: rubric_criterion; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.rubric_criterion (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    rubric_version_id uuid NOT NULL,
    key character varying(60) NOT NULL,
    label character varying(200) NOT NULL,
    description character varying(1000),
    min_score integer NOT NULL,
    max_score integer NOT NULL,
    weight integer NOT NULL,
    scoring_anchors jsonb,
    display_order integer NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT rubric_criterion_order_chk CHECK ((display_order >= 0)),
    CONSTRAINT rubric_criterion_range_chk CHECK ((min_score < max_score)),
    CONSTRAINT rubric_criterion_weight_chk CHECK (((weight > 0) AND (weight <= 10000)))
);

ALTER TABLE ONLY public.rubric_criterion FORCE ROW LEVEL SECURITY;


ALTER TABLE public.rubric_criterion OWNER TO ip_migrator;

--
-- Name: rubric_version; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.rubric_version (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    rubric_id uuid NOT NULL,
    version integer NOT NULL,
    tie_break_policy character varying(1000),
    judge_comment_rules character varying(1000),
    is_active boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    activated_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    total_weight integer NOT NULL,
    challenge_id uuid NOT NULL,
    CONSTRAINT rubric_version_total_weight_chk CHECK (((total_weight > 0) AND (total_weight <= 300000)))
);

ALTER TABLE ONLY public.rubric_version FORCE ROW LEVEL SECURITY;


ALTER TABLE public.rubric_version OWNER TO ip_migrator;

--
-- Name: scorecard; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.scorecard (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    judge_assignment_id uuid NOT NULL,
    rubric_version_id uuid NOT NULL,
    status public."ScorecardStatus" DEFAULT 'DRAFT'::public."ScorecardStatus" NOT NULL,
    total_score integer,
    max_possible_score integer,
    submitted_at timestamp(6) with time zone,
    locked_at timestamp(6) with time zone,
    reopened_at timestamp(6) with time zone,
    reopen_reason character varying(1000),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE ONLY public.scorecard FORCE ROW LEVEL SECURITY;


ALTER TABLE public.scorecard OWNER TO ip_migrator;

--
-- Name: session; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.session (
    id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    ip_address character varying(64),
    user_agent character varying(500),
    user_id uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    mfa_verified_at timestamp(6) with time zone,
    authentication_method character varying(32)
);


ALTER TABLE public.session OWNER TO ip_migrator;

--
-- Name: skill; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.skill (
    id uuid NOT NULL,
    name character varying(80) NOT NULL,
    slug character varying(80) NOT NULL,
    category character varying(60),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.skill OWNER TO ip_migrator;

--
-- Name: stored_object; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.stored_object (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid,
    owner_user_id uuid NOT NULL,
    object_key character varying(700) NOT NULL,
    expected_content_type character varying(120) NOT NULL,
    expected_bytes integer NOT NULL,
    actual_content_type character varying(120),
    actual_bytes integer,
    etag character varying(200),
    status public."StoredObjectStatus" DEFAULT 'PENDING_UPLOAD'::public."StoredObjectStatus" NOT NULL,
    scan_detail character varying(500),
    upload_expires_at timestamp(6) with time zone NOT NULL,
    uploaded_at timestamp(6) with time zone,
    scan_started_at timestamp(6) with time zone,
    scanned_at timestamp(6) with time zone,
    deletion_requested_at timestamp(6) with time zone,
    deleted_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    purpose public."FileAssetPurpose" NOT NULL,
    resource_type character varying(80) NOT NULL,
    resource_id uuid NOT NULL,
    display_name character varying(255) NOT NULL,
    CONSTRAINT stored_object_actual_bytes_chk CHECK (((actual_bytes IS NULL) OR (actual_bytes > 0))),
    CONSTRAINT stored_object_expected_bytes_chk CHECK ((expected_bytes > 0)),
    CONSTRAINT stored_object_state_chk CHECK ((((status = 'PENDING_UPLOAD'::public."StoredObjectStatus") AND (uploaded_at IS NULL) AND (scanned_at IS NULL)) OR ((status = 'QUARANTINED'::public."StoredObjectStatus") AND (uploaded_at IS NOT NULL) AND (actual_bytes IS NOT NULL) AND (actual_content_type IS NOT NULL) AND (scanned_at IS NULL)) OR ((status = ANY (ARRAY['CLEAN'::public."StoredObjectStatus", 'INFECTED'::public."StoredObjectStatus", 'FAILED'::public."StoredObjectStatus"])) AND (uploaded_at IS NOT NULL) AND (scanned_at IS NOT NULL)) OR ((status = 'PENDING_DELETION'::public."StoredObjectStatus") AND (deletion_requested_at IS NOT NULL)) OR ((status = 'DELETED'::public."StoredObjectStatus") AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.stored_object FORCE ROW LEVEL SECURITY;


ALTER TABLE public.stored_object OWNER TO ip_migrator;

--
-- Name: submission_asset; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.submission_asset (
    id uuid CONSTRAINT submission_screenshot_id_not_null NOT NULL,
    organization_id uuid CONSTRAINT submission_screenshot_organization_id_not_null NOT NULL,
    submission_version_id uuid CONSTRAINT submission_screenshot_submission_version_id_not_null NOT NULL,
    slot integer,
    media_asset_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT submission_screenshot_created_at_not_null NOT NULL,
    challenge_id uuid NOT NULL,
    kind public."SubmissionAssetKind" NOT NULL,
    file_asset_id uuid,
    display_name character varying(255),
    CONSTRAINT submission_asset_shape_chk CHECK ((((kind = 'SCREENSHOT'::public."SubmissionAssetKind") AND ((slot >= 1) AND (slot <= 4)) AND (media_asset_id IS NOT NULL) AND (file_asset_id IS NULL)) OR ((kind = 'PRESENTATION_FILE'::public."SubmissionAssetKind") AND (slot IS NULL) AND (media_asset_id IS NULL) AND (file_asset_id IS NOT NULL))))
);

ALTER TABLE ONLY public.submission_asset FORCE ROW LEVEL SECURITY;


ALTER TABLE public.submission_asset OWNER TO ip_migrator;

--
-- Name: support_ticket; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.support_ticket (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    challenge_id uuid,
    category public."SupportTicketCategory" NOT NULL,
    subject character varying(200) NOT NULL,
    description text NOT NULL,
    priority public."SupportTicketPriority" DEFAULT 'NORMAL'::public."SupportTicketPriority" NOT NULL,
    status public."SupportTicketStatus" DEFAULT 'OPEN'::public."SupportTicketStatus" NOT NULL,
    assigned_to_user_id uuid,
    resolution_summary character varying(2000),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.support_ticket OWNER TO ip_migrator;

--
-- Name: support_ticket_comment; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.support_ticket_comment (
    id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    body character varying(4000) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.support_ticket_comment OWNER TO ip_migrator;

--
-- Name: support_ticket_internal_note; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.support_ticket_internal_note (
    id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    body character varying(4000) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.support_ticket_internal_note OWNER TO ip_migrator;

--
-- Name: team_invitation; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.team_invitation (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    team_id uuid NOT NULL,
    invited_user_id uuid NOT NULL,
    token_hash character varying(128) NOT NULL,
    status public."TeamInvitationStatus" DEFAULT 'PENDING'::public."TeamInvitationStatus" NOT NULL,
    invited_by_user_id uuid NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    responded_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.team_invitation FORCE ROW LEVEL SECURITY;


ALTER TABLE public.team_invitation OWNER TO ip_migrator;

--
-- Name: technology_tag; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.technology_tag (
    id uuid NOT NULL,
    name character varying(80) NOT NULL,
    slug character varying(80) NOT NULL,
    category character varying(60),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.technology_tag OWNER TO ip_migrator;

--
-- Name: two_factor; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.two_factor (
    id uuid NOT NULL,
    secret text NOT NULL,
    backup_codes text NOT NULL,
    user_id uuid NOT NULL,
    verified boolean DEFAULT true NOT NULL,
    failed_verification_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp(6) with time zone,
    CONSTRAINT two_factor_failed_verification_count_nonnegative CHECK ((failed_verification_count >= 0))
);


ALTER TABLE public.two_factor OWNER TO ip_migrator;

--
-- Name: user; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public."user" (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    email character varying(254) NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image character varying(2048),
    two_factor_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public."user" OWNER TO ip_migrator;

--
-- Name: user_profile; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.user_profile (
    user_id uuid NOT NULL,
    display_name character varying(120),
    bio character varying(2000),
    location character varying(120),
    avatar_asset_id uuid,
    github_url character varying(2048),
    linkedin_url character varying(2048),
    portfolio_url character varying(2048),
    discord_handle character varying(64),
    visibility public."ProfileVisibility" DEFAULT 'ORGANIZATION_MEMBERS'::public."ProfileVisibility" NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.user_profile OWNER TO ip_migrator;

--
-- Name: user_skill; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.user_skill (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    skill_id uuid,
    custom_name character varying(80),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_skill_exactly_one_source_chk CHECK ((num_nonnulls(skill_id, custom_name) = 1))
);


ALTER TABLE public.user_skill OWNER TO ip_migrator;

--
-- Name: verification; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.verification (
    id uuid NOT NULL,
    identifier character varying(255) NOT NULL,
    value character varying(255) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.verification OWNER TO ip_migrator;

--
-- Name: webhook_event; Type: TABLE; Schema: public; Owner: ip_migrator
--

CREATE TABLE public.webhook_event (
    id uuid NOT NULL,
    provider character varying(40) NOT NULL,
    provider_event_id character varying(255) NOT NULL,
    event_type character varying(120) NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at timestamp(6) with time zone,
    processing_error character varying(1000)
);


ALTER TABLE public.webhook_event OWNER TO ip_migrator;

--
-- Name: account_deletion_request account_deletion_request_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.account_deletion_request
    ADD CONSTRAINT account_deletion_request_pkey PRIMARY KEY (id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: analytics_daily_rollup analytics_daily_rollup_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.analytics_daily_rollup
    ADD CONSTRAINT analytics_daily_rollup_pkey PRIMARY KEY (id);


--
-- Name: analytics_daily_rollup analytics_rollup_scope_key_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.analytics_daily_rollup
    ADD CONSTRAINT analytics_rollup_scope_key_uq UNIQUE (scope_key);


--
-- Name: announcement announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.announcement
    ADD CONSTRAINT announcement_pkey PRIMARY KEY (id);


--
-- Name: audit_event audit_event_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.audit_event
    ADD CONSTRAINT audit_event_pkey PRIMARY KEY (id);


--
-- Name: challenge_participation challenge_participation_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_participation
    ADD CONSTRAINT challenge_participation_pkey PRIMARY KEY (id);


--
-- Name: challenge challenge_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge
    ADD CONSTRAINT challenge_pkey PRIMARY KEY (id);


--
-- Name: challenge_prize challenge_prize_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_prize
    ADD CONSTRAINT challenge_prize_pkey PRIMARY KEY (id);


--
-- Name: challenge_schedule_change challenge_schedule_change_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_schedule_change
    ADD CONSTRAINT challenge_schedule_change_pkey PRIMARY KEY (id);


--
-- Name: challenge_sponsor challenge_sponsor_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_sponsor
    ADD CONSTRAINT challenge_sponsor_pkey PRIMARY KEY (id);


--
-- Name: challenge_staff_assignment challenge_staff_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_staff_assignment
    ADD CONSTRAINT challenge_staff_assignment_pkey PRIMARY KEY (id);


--
-- Name: challenge_staff_invitation challenge_staff_invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_staff_invitation
    ADD CONSTRAINT challenge_staff_invitation_pkey PRIMARY KEY (id);


--
-- Name: challenge_submission_requirement_version challenge_submission_requirement_version_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_submission_requirement_version
    ADD CONSTRAINT challenge_submission_requirement_version_pkey PRIMARY KEY (id);


--
-- Name: challenge_team_member challenge_team_member_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_team_member
    ADD CONSTRAINT challenge_team_member_pkey PRIMARY KEY (id);


--
-- Name: challenge_team challenge_team_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_team
    ADD CONSTRAINT challenge_team_pkey PRIMARY KEY (id);


--
-- Name: challenge_terms_version challenge_terms_version_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_terms_version
    ADD CONSTRAINT challenge_terms_version_pkey PRIMARY KEY (id);


--
-- Name: challenge_track challenge_track_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_track
    ADD CONSTRAINT challenge_track_pkey PRIMARY KEY (id);


--
-- Name: consent_record consent_record_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.consent_record
    ADD CONSTRAINT consent_record_pkey PRIMARY KEY (id);


--
-- Name: content_report content_report_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.content_report
    ADD CONSTRAINT content_report_pkey PRIMARY KEY (id);


--
-- Name: criterion_score criterion_score_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.criterion_score
    ADD CONSTRAINT criterion_score_pkey PRIMARY KEY (id);


--
-- Name: data_export data_export_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.data_export
    ADD CONSTRAINT data_export_pkey PRIMARY KEY (id);


--
-- Name: email_delivery_attempt email_delivery_attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.email_delivery_attempt
    ADD CONSTRAINT email_delivery_attempt_pkey PRIMARY KEY (id);


--
-- Name: email_delivery email_delivery_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.email_delivery
    ADD CONSTRAINT email_delivery_pkey PRIMARY KEY (id);


--
-- Name: email_suppression email_suppression_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.email_suppression
    ADD CONSTRAINT email_suppression_pkey PRIMARY KEY (id);


--
-- Name: faq faq_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.faq
    ADD CONSTRAINT faq_pkey PRIMARY KEY (id);


--
-- Name: file_asset file_asset_id_org_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_id_org_uq UNIQUE (id, organization_id);


--
-- Name: file_asset file_asset_object_org_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_object_org_uq UNIQUE (stored_object_id, organization_id);


--
-- Name: file_asset file_asset_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_pkey PRIMARY KEY (id);


--
-- Name: file_asset file_asset_scope_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_scope_uq UNIQUE (id, organization_id, challenge_id);


--
-- Name: file_asset file_asset_stored_object_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_stored_object_uq UNIQUE (stored_object_id);


--
-- Name: form_definition form_definition_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.form_definition
    ADD CONSTRAINT form_definition_pkey PRIMARY KEY (id);


--
-- Name: form_response form_response_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.form_response
    ADD CONSTRAINT form_response_pkey PRIMARY KEY (id);


--
-- Name: form_version form_version_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.form_version
    ADD CONSTRAINT form_version_pkey PRIMARY KEY (id);


--
-- Name: idempotency_record idempotency_record_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.idempotency_record
    ADD CONSTRAINT idempotency_record_pkey PRIMARY KEY (id);


--
-- Name: innovation_evidence innovation_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_evidence
    ADD CONSTRAINT innovation_evidence_pkey PRIMARY KEY (id);


--
-- Name: innovation_metric_measurement innovation_metric_measurement_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_metric_measurement
    ADD CONSTRAINT innovation_metric_measurement_pkey PRIMARY KEY (id);


--
-- Name: innovation_metric innovation_metric_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_metric
    ADD CONSTRAINT innovation_metric_pkey PRIMARY KEY (id);


--
-- Name: innovation_milestone innovation_milestone_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_milestone
    ADD CONSTRAINT innovation_milestone_pkey PRIMARY KEY (id);


--
-- Name: innovation innovation_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation
    ADD CONSTRAINT innovation_pkey PRIMARY KEY (id);


--
-- Name: innovation_stage_history innovation_stage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_stage_history
    ADD CONSTRAINT innovation_stage_history_pkey PRIMARY KEY (id);


--
-- Name: integration_delivery_attempt integration_delivery_attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.integration_delivery_attempt
    ADD CONSTRAINT integration_delivery_attempt_pkey PRIMARY KEY (id);


--
-- Name: integration_delivery integration_delivery_id_org_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.integration_delivery
    ADD CONSTRAINT integration_delivery_id_org_uq UNIQUE (id, organization_id);


--
-- Name: integration_delivery integration_delivery_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.integration_delivery
    ADD CONSTRAINT integration_delivery_pkey PRIMARY KEY (id);


--
-- Name: integration integration_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.integration
    ADD CONSTRAINT integration_pkey PRIMARY KEY (id);


--
-- Name: judge_assignment judge_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.judge_assignment
    ADD CONSTRAINT judge_assignment_pkey PRIMARY KEY (id);


--
-- Name: matchmaking_interest matchmaking_interest_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.matchmaking_interest
    ADD CONSTRAINT matchmaking_interest_pkey PRIMARY KEY (id);


--
-- Name: matchmaking_post matchmaking_post_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.matchmaking_post
    ADD CONSTRAINT matchmaking_post_pkey PRIMARY KEY (id);


--
-- Name: media_asset media_asset_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.media_asset
    ADD CONSTRAINT media_asset_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: notification_preference notification_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.notification_preference
    ADD CONSTRAINT notification_preference_pkey PRIMARY KEY (user_id);


--
-- Name: organization_application organization_application_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_application
    ADD CONSTRAINT organization_application_pkey PRIMARY KEY (id);


--
-- Name: organization_invitation organization_invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_invitation
    ADD CONSTRAINT organization_invitation_pkey PRIMARY KEY (id);


--
-- Name: organization_join_code organization_join_code_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_code
    ADD CONSTRAINT organization_join_code_pkey PRIMARY KEY (id);


--
-- Name: organization_join_request organization_join_request_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_request
    ADD CONSTRAINT organization_join_request_pkey PRIMARY KEY (id);


--
-- Name: organization_limit organization_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_limit
    ADD CONSTRAINT organization_limit_pkey PRIMARY KEY (organization_id);


--
-- Name: organization_membership organization_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_membership
    ADD CONSTRAINT organization_membership_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: outbox_event outbox_event_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.outbox_event
    ADD CONSTRAINT outbox_event_pkey PRIMARY KEY (id);


--
-- Name: platform_role_assignment platform_role_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.platform_role_assignment
    ADD CONSTRAINT platform_role_assignment_pkey PRIMARY KEY (id);


--
-- Name: reminder_schedule reminder_schedule_key_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.reminder_schedule
    ADD CONSTRAINT reminder_schedule_key_uq UNIQUE (deterministic_key);


--
-- Name: reminder_schedule reminder_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.reminder_schedule
    ADD CONSTRAINT reminder_schedule_pkey PRIMARY KEY (id);


--
-- Name: result_snapshot result_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.result_snapshot
    ADD CONSTRAINT result_snapshot_pkey PRIMARY KEY (id);


--
-- Name: rubric_criterion rubric_criterion_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.rubric_criterion
    ADD CONSTRAINT rubric_criterion_pkey PRIMARY KEY (id);


--
-- Name: rubric rubric_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.rubric
    ADD CONSTRAINT rubric_pkey PRIMARY KEY (id);


--
-- Name: rubric_version rubric_version_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.rubric_version
    ADD CONSTRAINT rubric_version_pkey PRIMARY KEY (id);


--
-- Name: scorecard scorecard_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.scorecard
    ADD CONSTRAINT scorecard_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: skill skill_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.skill
    ADD CONSTRAINT skill_pkey PRIMARY KEY (id);


--
-- Name: stored_object stored_object_id_org_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.stored_object
    ADD CONSTRAINT stored_object_id_org_uq UNIQUE (id, organization_id);


--
-- Name: stored_object stored_object_key_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.stored_object
    ADD CONSTRAINT stored_object_key_uq UNIQUE (object_key);


--
-- Name: stored_object stored_object_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.stored_object
    ADD CONSTRAINT stored_object_pkey PRIMARY KEY (id);


--
-- Name: stored_object stored_object_scope_uq; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.stored_object
    ADD CONSTRAINT stored_object_scope_uq UNIQUE (id, organization_id, challenge_id);


--
-- Name: submission submission_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission
    ADD CONSTRAINT submission_pkey PRIMARY KEY (id);


--
-- Name: submission_result submission_result_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_result
    ADD CONSTRAINT submission_result_pkey PRIMARY KEY (id);


--
-- Name: submission_asset submission_asset_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_asset
    ADD CONSTRAINT submission_asset_pkey PRIMARY KEY (id);


--
-- Name: submission_technology submission_technology_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_technology
    ADD CONSTRAINT submission_technology_pkey PRIMARY KEY (id);


--
-- Name: submission_version submission_version_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_version
    ADD CONSTRAINT submission_version_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_comment support_ticket_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.support_ticket_comment
    ADD CONSTRAINT support_ticket_comment_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_internal_note support_ticket_internal_note_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.support_ticket_internal_note
    ADD CONSTRAINT support_ticket_internal_note_pkey PRIMARY KEY (id);


--
-- Name: support_ticket support_ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.support_ticket
    ADD CONSTRAINT support_ticket_pkey PRIMARY KEY (id);


--
-- Name: team_invitation team_invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.team_invitation
    ADD CONSTRAINT team_invitation_pkey PRIMARY KEY (id);


--
-- Name: technology_tag technology_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.technology_tag
    ADD CONSTRAINT technology_tag_pkey PRIMARY KEY (id);


--
-- Name: two_factor two_factor_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.two_factor
    ADD CONSTRAINT two_factor_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (user_id);


--
-- Name: user_skill user_skill_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.user_skill
    ADD CONSTRAINT user_skill_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: webhook_event webhook_event_pkey; Type: CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.webhook_event
    ADD CONSTRAINT webhook_event_pkey PRIMARY KEY (id);


--
-- Name: account_deletion_executable_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX account_deletion_executable_idx ON public.account_deletion_request USING btree (eligible_at, id) WHERE ((status = 'PENDING'::public."AccountDeletionStatus") AND (legal_hold_at IS NULL));


--
-- Name: account_deletion_one_pending_per_user_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX account_deletion_one_pending_per_user_uq ON public.account_deletion_request USING btree (user_id) WHERE (status = 'PENDING'::public."AccountDeletionStatus");


--
-- Name: account_deletion_one_pending_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX account_deletion_one_pending_uq ON public.account_deletion_request USING btree (user_id) WHERE (status = 'PENDING'::public."AccountDeletionStatus");


--
-- Name: account_deletion_status_eligible_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX account_deletion_status_eligible_idx ON public.account_deletion_request USING btree (status, eligible_at);


--
-- Name: account_deletion_user_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX account_deletion_user_status_idx ON public.account_deletion_request USING btree (user_id, status);


--
-- Name: account_provider_account_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX account_provider_account_uq ON public.account USING btree (provider_id, account_id);


--
-- Name: account_user_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX account_user_idx ON public.account USING btree (user_id);


--
-- Name: analytics_rollup_challenge_date_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX analytics_rollup_challenge_date_idx ON public.analytics_daily_rollup USING btree (organization_id, challenge_id, rollup_date DESC);


--
-- Name: analytics_rollup_org_date_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX analytics_rollup_org_date_idx ON public.analytics_daily_rollup USING btree (organization_id, rollup_date DESC);


--
-- Name: announcement_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX announcement_id_org_uq ON public.announcement USING btree (id, organization_id);


--
-- Name: announcement_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX announcement_org_challenge_idx ON public.announcement USING btree (organization_id, challenge_id, is_published);


--
-- Name: audit_event_action_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX audit_event_action_created_idx ON public.audit_event USING btree (action, created_at DESC);


--
-- Name: audit_event_actor_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX audit_event_actor_created_idx ON public.audit_event USING btree (actor_user_id, created_at DESC);


--
-- Name: audit_event_org_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX audit_event_org_created_idx ON public.audit_event USING btree (organization_id, created_at DESC);


--
-- Name: audit_event_resource_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX audit_event_resource_idx ON public.audit_event USING btree (resource_type, resource_id, created_at DESC);


--
-- Name: challenge_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX challenge_id_org_uq ON public.challenge USING btree (id, organization_id);


--
-- Name: challenge_org_deadline_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX challenge_org_deadline_idx ON public.challenge USING btree (organization_id, submission_deadline);


--
-- Name: challenge_org_slug_lower_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX challenge_org_slug_lower_uq ON public.challenge USING btree (organization_id, lower((slug)::text));


--
-- Name: challenge_org_slug_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX challenge_org_slug_uq ON public.challenge USING btree (organization_id, slug);


--
-- Name: challenge_org_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX challenge_org_status_idx ON public.challenge USING btree (organization_id, status);


--
-- Name: challenge_staff_invitation_token_hash_key; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX challenge_staff_invitation_token_hash_key ON public.challenge_staff_invitation USING btree (token_hash);


--
-- Name: challenge_title_trgm_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX challenge_title_trgm_idx ON public.challenge USING gin (title public.gin_trgm_ops);


--
-- Name: consent_org_terms_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX consent_org_terms_idx ON public.consent_record USING btree (organization_id, terms_version_id);


--
-- Name: consent_user_terms_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX consent_user_terms_uq ON public.consent_record USING btree (user_id, terms_version_id);


--
-- Name: content_report_reporter_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX content_report_reporter_created_idx ON public.content_report USING btree (reporter_user_id, created_at DESC);


--
-- Name: content_report_status_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX content_report_status_created_idx ON public.content_report USING btree (status, created_at DESC);


--
-- Name: content_report_target_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX content_report_target_idx ON public.content_report USING btree (target_type, target_id);


--
-- Name: criterion_score_org_criterion_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX criterion_score_org_criterion_idx ON public.criterion_score USING btree (organization_id, rubric_version_id, criterion_id);


--
-- Name: criterion_score_scorecard_criterion_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX criterion_score_scorecard_criterion_uq ON public.criterion_score USING btree (scorecard_id, criterion_id);


--
-- Name: data_export_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX data_export_id_org_uq ON public.data_export USING btree (id, organization_id);


--
-- Name: data_export_org_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX data_export_org_status_idx ON public.data_export USING btree (organization_id, status, created_at DESC);


--
-- Name: email_delivery_attempt_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX email_delivery_attempt_created_idx ON public.email_delivery_attempt USING btree (email_delivery_id, started_at DESC);


--
-- Name: email_delivery_attempt_number_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX email_delivery_attempt_number_uq ON public.email_delivery_attempt USING btree (email_delivery_id, attempt_number);


--
-- Name: email_delivery_org_status_next_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX email_delivery_org_status_next_idx ON public.email_delivery USING btree (organization_id, status, next_attempt_at);


--
-- Name: email_delivery_provider_message_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX email_delivery_provider_message_uq ON public.email_delivery USING btree (provider_message_id) WHERE (provider_message_id IS NOT NULL);


--
-- Name: email_delivery_source_key_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX email_delivery_source_key_uq ON public.email_delivery USING btree (source_key);


--
-- Name: email_delivery_status_next_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX email_delivery_status_next_idx ON public.email_delivery USING btree (status, next_attempt_at);


--
-- Name: email_delivery_user_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX email_delivery_user_created_idx ON public.email_delivery USING btree (recipient_user_id, created_at DESC);


--
-- Name: email_suppression_email_key; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX email_suppression_email_key ON public.email_suppression USING btree (email);


--
-- Name: faq_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX faq_id_org_uq ON public.faq USING btree (id, organization_id);


--
-- Name: faq_org_challenge_order_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX faq_org_challenge_order_idx ON public.faq USING btree (organization_id, challenge_id, display_order);


--
-- Name: file_asset_resource_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX file_asset_resource_idx ON public.file_asset USING btree (organization_id, challenge_id, resource_type, resource_id);


--
-- Name: file_asset_submission_presentation_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX file_asset_submission_presentation_uq ON public.file_asset USING btree (organization_id, resource_type, resource_id) WHERE ((purpose = 'SUBMISSION_PRESENTATION'::public."FileAssetPurpose") AND (status <> 'DELETED'::public."FileAssetStatus"));


--
-- Name: form_definition_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_definition_id_org_uq ON public.form_definition USING btree (id, organization_id);


--
-- Name: form_definition_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX form_definition_org_challenge_idx ON public.form_definition USING btree (organization_id, challenge_id);


--
-- Name: form_definition_org_purpose_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX form_definition_org_purpose_idx ON public.form_definition USING btree (organization_id, purpose);


--
-- Name: form_definition_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_definition_scope_uq ON public.form_definition USING btree (id, organization_id, challenge_id);


--
-- Name: form_response_draft_lookup_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX form_response_draft_lookup_idx ON public.form_response USING btree (organization_id, challenge_id, user_id, is_draft);


--
-- Name: form_response_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_response_id_org_uq ON public.form_response USING btree (id, organization_id);


--
-- Name: form_response_one_draft_per_version_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_response_one_draft_per_version_uq ON public.form_response USING btree (form_version_id, user_id) WHERE is_draft;


--
-- Name: form_response_org_user_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX form_response_org_user_idx ON public.form_response USING btree (organization_id, user_id);


--
-- Name: form_response_org_version_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX form_response_org_version_idx ON public.form_response USING btree (organization_id, form_version_id);


--
-- Name: form_response_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_response_scope_uq ON public.form_response USING btree (id, organization_id, challenge_id);


--
-- Name: form_version_definition_version_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_version_definition_version_uq ON public.form_version USING btree (form_definition_id, version);


--
-- Name: form_version_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_version_id_org_uq ON public.form_version USING btree (id, organization_id);


--
-- Name: form_version_published_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX form_version_published_idx ON public.form_version USING btree (organization_id, form_definition_id, is_published);


--
-- Name: form_version_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX form_version_scope_uq ON public.form_version USING btree (id, organization_id, challenge_id);


--
-- Name: idempotency_record_actor_op_key_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX idempotency_record_actor_op_key_uq ON public.idempotency_record USING btree (actor_user_id, operation, idempotency_key);


--
-- Name: idempotency_record_expires_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX idempotency_record_expires_idx ON public.idempotency_record USING btree (expires_at);


--
-- Name: innovation_evidence_org_innovation_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX innovation_evidence_org_innovation_idx ON public.innovation_evidence USING btree (organization_id, innovation_id);


--
-- Name: innovation_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX innovation_id_org_uq ON public.innovation USING btree (id, organization_id);


--
-- Name: innovation_metric_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX innovation_metric_id_org_uq ON public.innovation_metric USING btree (id, organization_id);


--
-- Name: innovation_metric_measurement_org_metric_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX innovation_metric_measurement_org_metric_idx ON public.innovation_metric_measurement USING btree (organization_id, metric_id, measured_at DESC);


--
-- Name: innovation_metric_org_innovation_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX innovation_metric_org_innovation_idx ON public.innovation_metric USING btree (organization_id, innovation_id);


--
-- Name: innovation_milestone_org_innovation_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX innovation_milestone_org_innovation_idx ON public.innovation_milestone USING btree (organization_id, innovation_id);


--
-- Name: innovation_org_next_review_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX innovation_org_next_review_idx ON public.innovation USING btree (organization_id, next_review_date);


--
-- Name: innovation_org_stage_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX innovation_org_stage_idx ON public.innovation USING btree (organization_id, stage);


--
-- Name: innovation_source_submission_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX innovation_source_submission_uq ON public.innovation USING btree (source_submission_id);


--
-- Name: innovation_stage_history_org_innovation_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX innovation_stage_history_org_innovation_idx ON public.innovation_stage_history USING btree (organization_id, innovation_id, created_at DESC);


--
-- Name: integration_attempt_number_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX integration_attempt_number_uq ON public.integration_delivery_attempt USING btree (integration_delivery_id, attempt_number);


--
-- Name: integration_attempt_org_delivery_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX integration_attempt_org_delivery_idx ON public.integration_delivery_attempt USING btree (organization_id, integration_delivery_id);


--
-- Name: integration_delivery_org_integration_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX integration_delivery_org_integration_idx ON public.integration_delivery USING btree (organization_id, integration_id, created_at DESC);


--
-- Name: integration_delivery_org_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX integration_delivery_org_status_idx ON public.integration_delivery USING btree (organization_id, status, created_at);


--
-- Name: integration_delivery_source_key_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX integration_delivery_source_key_uq ON public.integration_delivery USING btree (source_key);


--
-- Name: integration_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX integration_id_org_uq ON public.integration USING btree (id, organization_id);


--
-- Name: integration_org_provider_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX integration_org_provider_uq ON public.integration USING btree (organization_id, provider);


--
-- Name: invitation_email_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX invitation_email_status_idx ON public.organization_invitation USING btree (email, status);


--
-- Name: invitation_expires_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX invitation_expires_idx ON public.organization_invitation USING btree (expires_at);


--
-- Name: invitation_org_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX invitation_org_status_idx ON public.organization_invitation USING btree (organization_id, status, created_at DESC);


--
-- Name: invitation_token_hash_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX invitation_token_hash_uq ON public.organization_invitation USING btree (token_hash);


--
-- Name: join_code_hash_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX join_code_hash_uq ON public.organization_join_code USING btree (code_hash);


--
-- Name: join_code_org_active_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX join_code_org_active_idx ON public.organization_join_code USING btree (organization_id, revoked_at, expires_at);


--
-- Name: join_request_one_pending_per_user_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX join_request_one_pending_per_user_uq ON public.organization_join_request USING btree (organization_id, user_id) WHERE (status = 'PENDING'::public."JoinRequestStatus");


--
-- Name: join_request_org_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX join_request_org_status_idx ON public.organization_join_request USING btree (organization_id, status, created_at DESC);


--
-- Name: join_request_user_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX join_request_user_status_idx ON public.organization_join_request USING btree (user_id, status);


--
-- Name: judge_assignment_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX judge_assignment_id_org_uq ON public.judge_assignment USING btree (id, organization_id);


--
-- Name: judge_assignment_live_staff_submission_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX judge_assignment_live_staff_submission_uq ON public.judge_assignment USING btree (staff_assignment_id, submission_id) WHERE (status <> 'REASSIGNED'::public."JudgeAssignmentStatus");


--
-- Name: judge_assignment_org_challenge_submission_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX judge_assignment_org_challenge_submission_idx ON public.judge_assignment USING btree (organization_id, challenge_id, submission_id);


--
-- Name: judge_assignment_org_staff_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX judge_assignment_org_staff_status_idx ON public.judge_assignment USING btree (organization_id, staff_assignment_id, status);


--
-- Name: judge_assignment_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX judge_assignment_scope_uq ON public.judge_assignment USING btree (id, organization_id, challenge_id);


--
-- Name: matchmaking_interest_org_post_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX matchmaking_interest_org_post_idx ON public.matchmaking_interest USING btree (organization_id, post_id);


--
-- Name: matchmaking_interest_post_user_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX matchmaking_interest_post_user_uq ON public.matchmaking_interest USING btree (post_id, interested_user_id);


--
-- Name: matchmaking_post_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX matchmaking_post_id_org_uq ON public.matchmaking_post USING btree (id, organization_id);


--
-- Name: matchmaking_post_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX matchmaking_post_org_challenge_idx ON public.matchmaking_post USING btree (organization_id, challenge_id, is_open);


--
-- Name: matchmaking_post_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX matchmaking_post_scope_uq ON public.matchmaking_post USING btree (id, organization_id, challenge_id);


--
-- Name: media_asset_challenge_purpose_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX media_asset_challenge_purpose_idx ON public.media_asset USING btree (organization_id, challenge_id, purpose);


--
-- Name: media_asset_cloudinary_public_id_key; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX media_asset_cloudinary_public_id_key ON public.media_asset USING btree (cloudinary_public_id);


--
-- Name: media_asset_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX media_asset_id_org_uq ON public.media_asset USING btree (id, organization_id);


--
-- Name: media_asset_org_purpose_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX media_asset_org_purpose_idx ON public.media_asset USING btree (organization_id, purpose);


--
-- Name: media_asset_resource_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX media_asset_resource_idx ON public.media_asset USING btree (organization_id, challenge_id, resource_type, resource_id);


--
-- Name: media_asset_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX media_asset_scope_uq ON public.media_asset USING btree (id, organization_id, challenge_id);


--
-- Name: media_asset_status_expiry_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX media_asset_status_expiry_idx ON public.media_asset USING btree (status, expires_at);


--
-- Name: membership_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX membership_id_org_uq ON public.organization_membership USING btree (id, organization_id);


--
-- Name: membership_org_role_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX membership_org_role_status_idx ON public.organization_membership USING btree (organization_id, role, status);


--
-- Name: membership_org_user_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX membership_org_user_uq ON public.organization_membership USING btree (organization_id, user_id);


--
-- Name: membership_user_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX membership_user_status_idx ON public.organization_membership USING btree (user_id, status);


--
-- Name: notification_user_source_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX notification_user_source_uq ON public.notification USING btree (user_id, source_key);


--
-- Name: notification_user_unread_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX notification_user_unread_idx ON public.notification USING btree (user_id, read_at, created_at DESC);


--
-- Name: org_application_one_pending_per_requester_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX org_application_one_pending_per_requester_uq ON public.organization_application USING btree (requester_user_id) WHERE (status = 'PENDING_REVIEW'::public."OrganizationApplicationStatus");


--
-- Name: org_application_requester_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX org_application_requester_idx ON public.organization_application USING btree (requester_user_id, created_at DESC);


--
-- Name: org_application_slug_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX org_application_slug_idx ON public.organization_application USING btree (requested_slug);


--
-- Name: org_application_status_submitted_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX org_application_status_submitted_idx ON public.organization_application USING btree (status, submitted_at);


--
-- Name: organization_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX organization_created_idx ON public.organization USING btree (created_at DESC);


--
-- Name: organization_name_trgm_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX organization_name_trgm_idx ON public.organization USING gin (name public.gin_trgm_ops);


--
-- Name: organization_slug_lower_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX organization_slug_lower_uq ON public.organization USING btree (lower((slug)::text));


--
-- Name: organization_status_visibility_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX organization_status_visibility_idx ON public.organization USING btree (status, visibility);


--
-- Name: outbox_event_actor_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX outbox_event_actor_created_idx ON public.outbox_event USING btree (actor_user_id, created_at DESC);


--
-- Name: outbox_event_dedupe_key_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX outbox_event_dedupe_key_uq ON public.outbox_event USING btree (dedupe_key);


--
-- Name: outbox_event_org_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX outbox_event_org_created_idx ON public.outbox_event USING btree (organization_id, created_at DESC);


--
-- Name: outbox_event_state_available_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX outbox_event_state_available_idx ON public.outbox_event USING btree (state, available_at);


--
-- Name: outbox_event_state_enqueued_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX outbox_event_state_enqueued_idx ON public.outbox_event USING btree (state, enqueued_at);


--
-- Name: participation_challenge_user_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX participation_challenge_user_uq ON public.challenge_participation USING btree (challenge_id, user_id);


--
-- Name: participation_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX participation_id_org_uq ON public.challenge_participation USING btree (id, organization_id);


--
-- Name: participation_org_challenge_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX participation_org_challenge_status_idx ON public.challenge_participation USING btree (organization_id, challenge_id, status);


--
-- Name: participation_user_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX participation_user_status_idx ON public.challenge_participation USING btree (user_id, status);


--
-- Name: platform_role_one_active_per_user_role_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX platform_role_one_active_per_user_role_uq ON public.platform_role_assignment USING btree (user_id, role) WHERE (revoked_at IS NULL);


--
-- Name: platform_role_role_revoked_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX platform_role_role_revoked_idx ON public.platform_role_assignment USING btree (role, revoked_at);


--
-- Name: platform_role_user_role_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX platform_role_user_role_idx ON public.platform_role_assignment USING btree (user_id, role);


--
-- Name: prize_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX prize_org_challenge_idx ON public.challenge_prize USING btree (organization_id, challenge_id);


--
-- Name: reminder_schedule_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX reminder_schedule_challenge_idx ON public.reminder_schedule USING btree (organization_id, challenge_id, kind);


--
-- Name: reminder_schedule_due_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX reminder_schedule_due_idx ON public.reminder_schedule USING btree (status, scheduled_for);


--
-- Name: result_snapshot_challenge_version_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX result_snapshot_challenge_version_uq ON public.result_snapshot USING btree (challenge_id, "publicationVersion");


--
-- Name: result_snapshot_org_challenge_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX result_snapshot_org_challenge_status_idx ON public.result_snapshot USING btree (organization_id, challenge_id, status);


--
-- Name: result_snapshot_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX result_snapshot_scope_uq ON public.result_snapshot USING btree (id, organization_id, challenge_id);


--
-- Name: rubric_criterion_org_version_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX rubric_criterion_org_version_idx ON public.rubric_criterion USING btree (organization_id, rubric_version_id);


--
-- Name: rubric_criterion_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_criterion_scope_uq ON public.rubric_criterion USING btree (id, organization_id, rubric_version_id);


--
-- Name: rubric_criterion_version_key_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_criterion_version_key_uq ON public.rubric_criterion USING btree (rubric_version_id, key);


--
-- Name: rubric_criterion_version_order_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_criterion_version_order_uq ON public.rubric_criterion USING btree (rubric_version_id, display_order);


--
-- Name: rubric_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_id_org_uq ON public.rubric USING btree (id, organization_id);


--
-- Name: rubric_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX rubric_org_challenge_idx ON public.rubric USING btree (organization_id, challenge_id);


--
-- Name: rubric_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_scope_uq ON public.rubric USING btree (id, organization_id, challenge_id);


--
-- Name: rubric_version_active_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX rubric_version_active_idx ON public.rubric_version USING btree (organization_id, rubric_id, is_active);


--
-- Name: rubric_version_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_version_id_org_uq ON public.rubric_version USING btree (id, organization_id);


--
-- Name: rubric_version_rubric_number_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_version_rubric_number_uq ON public.rubric_version USING btree (rubric_id, version);


--
-- Name: rubric_version_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX rubric_version_scope_uq ON public.rubric_version USING btree (id, organization_id, challenge_id);


--
-- Name: schedule_change_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX schedule_change_challenge_idx ON public.challenge_schedule_change USING btree (organization_id, challenge_id, created_at DESC);


--
-- Name: scorecard_assignment_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX scorecard_assignment_org_uq ON public.scorecard USING btree (judge_assignment_id, organization_id);


--
-- Name: scorecard_assignment_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX scorecard_assignment_scope_uq ON public.scorecard USING btree (judge_assignment_id, organization_id, challenge_id);


--
-- Name: scorecard_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX scorecard_id_org_uq ON public.scorecard USING btree (id, organization_id);


--
-- Name: scorecard_org_challenge_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX scorecard_org_challenge_status_idx ON public.scorecard USING btree (organization_id, challenge_id, status);


--
-- Name: scorecard_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX scorecard_scope_uq ON public.scorecard USING btree (id, organization_id, rubric_version_id);


--
-- Name: session_expires_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX session_expires_idx ON public.session USING btree (expires_at);


--
-- Name: session_token_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX session_token_uq ON public.session USING btree (token);


--
-- Name: session_user_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX session_user_idx ON public.session USING btree (user_id);


--
-- Name: skill_active_name_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX skill_active_name_idx ON public.skill USING btree (active, name);


--
-- Name: skill_name_trgm_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX skill_name_trgm_idx ON public.skill USING gin (name public.gin_trgm_ops);


--
-- Name: skill_slug_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX skill_slug_uq ON public.skill USING btree (slug);


--
-- Name: sponsor_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX sponsor_org_challenge_idx ON public.challenge_sponsor USING btree (organization_id, challenge_id);


--
-- Name: staff_assignment_challenge_user_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX staff_assignment_challenge_user_uq ON public.challenge_staff_assignment USING btree (challenge_id, user_id);


--
-- Name: staff_assignment_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX staff_assignment_id_org_uq ON public.challenge_staff_assignment USING btree (id, organization_id);


--
-- Name: staff_assignment_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX staff_assignment_org_challenge_idx ON public.challenge_staff_assignment USING btree (organization_id, challenge_id, status);


--
-- Name: staff_assignment_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX staff_assignment_scope_uq ON public.challenge_staff_assignment USING btree (id, organization_id, challenge_id);


--
-- Name: staff_invitation_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX staff_invitation_id_org_uq ON public.challenge_staff_invitation USING btree (id, organization_id);


--
-- Name: staff_invitation_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX staff_invitation_org_challenge_idx ON public.challenge_staff_invitation USING btree (organization_id, challenge_id, status);


--
-- Name: stored_object_cleanup_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX stored_object_cleanup_idx ON public.stored_object USING btree (status, upload_expires_at);


--
-- Name: stored_object_org_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX stored_object_org_status_idx ON public.stored_object USING btree (organization_id, status, created_at);


--
-- Name: stored_object_resource_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX stored_object_resource_idx ON public.stored_object USING btree (organization_id, challenge_id, resource_type, resource_id);


--
-- Name: submission_asset_scope_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX submission_asset_scope_idx ON public.submission_asset USING btree (organization_id, challenge_id, submission_version_id);


--
-- Name: submission_asset_version_kind_slot_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_asset_version_kind_slot_uq ON public.submission_asset USING btree (submission_version_id, kind, slot);


--
-- Name: submission_challenge_team_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_challenge_team_uq ON public.submission USING btree (challenge_id, team_id);


--
-- Name: submission_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_id_org_uq ON public.submission USING btree (id, organization_id);


--
-- Name: submission_org_challenge_status_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX submission_org_challenge_status_idx ON public.submission USING btree (organization_id, challenge_id, status);


--
-- Name: submission_requirement_active_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX submission_requirement_active_idx ON public.challenge_submission_requirement_version USING btree (organization_id, challenge_id, is_active);


--
-- Name: submission_requirement_challenge_version_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_requirement_challenge_version_uq ON public.challenge_submission_requirement_version USING btree (challenge_id, version);


--
-- Name: submission_requirement_one_active_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_requirement_one_active_uq ON public.challenge_submission_requirement_version USING btree (challenge_id) WHERE is_active;


--
-- Name: submission_requirement_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_requirement_scope_uq ON public.challenge_submission_requirement_version USING btree (id, organization_id, challenge_id);


--
-- Name: submission_result_challenge_submission_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_result_challenge_submission_uq ON public.submission_result USING btree (challenge_id, submission_id);


--
-- Name: submission_result_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_result_id_org_uq ON public.submission_result USING btree (id, organization_id);


--
-- Name: submission_result_org_challenge_rank_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX submission_result_org_challenge_rank_idx ON public.submission_result USING btree (organization_id, challenge_id, rank);


--
-- Name: submission_result_snapshot_submission_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_result_snapshot_submission_uq ON public.submission_result USING btree (snapshot_id, submission_id);


--
-- Name: submission_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_scope_uq ON public.submission USING btree (id, organization_id, challenge_id);


--
-- Name: submission_technology_scope_tag_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX submission_technology_scope_tag_idx ON public.submission_technology USING btree (organization_id, challenge_id, technology_tag_id);


--
-- Name: submission_technology_version_tag_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_technology_version_tag_uq ON public.submission_technology USING btree (submission_version_id, technology_tag_id);


--
-- Name: submission_version_id_org_challenge_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_version_id_org_challenge_uq ON public.submission_version USING btree (id, organization_id, challenge_id);


--
-- Name: submission_version_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_version_id_org_uq ON public.submission_version USING btree (id, organization_id);


--
-- Name: submission_version_org_submission_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX submission_version_org_submission_idx ON public.submission_version USING btree (organization_id, submission_id);


--
-- Name: submission_version_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_version_scope_uq ON public.submission_version USING btree (id, organization_id, challenge_id, submission_id);


--
-- Name: submission_version_submission_number_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX submission_version_submission_number_uq ON public.submission_version USING btree (submission_id, version_number);


--
-- Name: support_comment_ticket_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX support_comment_ticket_idx ON public.support_ticket_comment USING btree (ticket_id, created_at);


--
-- Name: support_internal_note_ticket_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX support_internal_note_ticket_idx ON public.support_ticket_internal_note USING btree (ticket_id, created_at);


--
-- Name: support_ticket_status_priority_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX support_ticket_status_priority_idx ON public.support_ticket USING btree (status, priority, created_at DESC);


--
-- Name: support_ticket_user_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX support_ticket_user_created_idx ON public.support_ticket USING btree (user_id, created_at DESC);


--
-- Name: team_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX team_id_org_uq ON public.challenge_team USING btree (id, organization_id);


--
-- Name: team_invitation_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX team_invitation_id_org_uq ON public.team_invitation USING btree (id, organization_id);


--
-- Name: team_invitation_org_invitee_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX team_invitation_org_invitee_idx ON public.team_invitation USING btree (organization_id, invited_user_id, status);


--
-- Name: team_invitation_org_team_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX team_invitation_org_team_idx ON public.team_invitation USING btree (organization_id, team_id);


--
-- Name: team_invitation_token_hash_key; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX team_invitation_token_hash_key ON public.team_invitation USING btree (token_hash);


--
-- Name: team_member_challenge_user_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX team_member_challenge_user_uq ON public.challenge_team_member USING btree (challenge_id, user_id);


--
-- Name: team_member_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX team_member_id_org_uq ON public.challenge_team_member USING btree (id, organization_id);


--
-- Name: team_member_org_team_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX team_member_org_team_idx ON public.challenge_team_member USING btree (organization_id, team_id);


--
-- Name: team_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX team_org_challenge_idx ON public.challenge_team USING btree (organization_id, challenge_id);


--
-- Name: team_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX team_scope_uq ON public.challenge_team USING btree (id, organization_id, challenge_id);


--
-- Name: technology_tag_active_name_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX technology_tag_active_name_idx ON public.technology_tag USING btree (active, name);


--
-- Name: technology_tag_name_trgm_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX technology_tag_name_trgm_idx ON public.technology_tag USING gin (name public.gin_trgm_ops);


--
-- Name: technology_tag_slug_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX technology_tag_slug_uq ON public.technology_tag USING btree (slug);


--
-- Name: terms_version_active_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX terms_version_active_idx ON public.challenge_terms_version USING btree (organization_id, challenge_id, is_active);


--
-- Name: terms_version_challenge_version_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX terms_version_challenge_version_uq ON public.challenge_terms_version USING btree (challenge_id, version);


--
-- Name: terms_version_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX terms_version_id_org_uq ON public.challenge_terms_version USING btree (id, organization_id);


--
-- Name: terms_version_one_active_per_challenge_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX terms_version_one_active_per_challenge_uq ON public.challenge_terms_version USING btree (challenge_id) WHERE (is_active = true);


--
-- Name: terms_version_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX terms_version_scope_uq ON public.challenge_terms_version USING btree (id, organization_id, challenge_id);


--
-- Name: track_challenge_name_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX track_challenge_name_uq ON public.challenge_track USING btree (challenge_id, name);


--
-- Name: track_id_org_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX track_id_org_uq ON public.challenge_track USING btree (id, organization_id);


--
-- Name: track_org_challenge_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX track_org_challenge_idx ON public.challenge_track USING btree (organization_id, challenge_id);


--
-- Name: track_scope_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX track_scope_uq ON public.challenge_track USING btree (id, organization_id, challenge_id);


--
-- Name: two_factor_locked_until_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX two_factor_locked_until_idx ON public.two_factor USING btree (locked_until);


--
-- Name: two_factor_user_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX two_factor_user_idx ON public.two_factor USING btree (user_id);


--
-- Name: user_created_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX user_created_idx ON public."user" USING btree (created_at);


--
-- Name: user_deleted_at_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX user_deleted_at_idx ON public."user" USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: user_email_lower_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX user_email_lower_uq ON public."user" USING btree (lower((email)::text));


--
-- Name: user_email_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX user_email_uq ON public."user" USING btree (email);


--
-- Name: user_skill_custom_name_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX user_skill_custom_name_uq ON public.user_skill USING btree (user_id, lower((custom_name)::text)) WHERE (custom_name IS NOT NULL);


--
-- Name: user_skill_skill_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX user_skill_skill_idx ON public.user_skill USING btree (skill_id);


--
-- Name: user_skill_user_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX user_skill_user_idx ON public.user_skill USING btree (user_id);


--
-- Name: user_skill_user_skill_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX user_skill_user_skill_uq ON public.user_skill USING btree (user_id, skill_id);


--
-- Name: verification_expires_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX verification_expires_idx ON public.verification USING btree (expires_at);


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX verification_identifier_idx ON public.verification USING btree (identifier);


--
-- Name: webhook_event_processed_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX webhook_event_processed_idx ON public.webhook_event USING btree (processed_at);


--
-- Name: webhook_event_provider_event_uq; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE UNIQUE INDEX webhook_event_provider_event_uq ON public.webhook_event USING btree (provider, provider_event_id);


--
-- Name: webhook_event_provider_received_idx; Type: INDEX; Schema: public; Owner: ip_migrator
--

CREATE INDEX webhook_event_provider_received_idx ON public.webhook_event USING btree (provider, received_at DESC);


--
-- Name: criterion_score criterion_score_delete_lock; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER criterion_score_delete_lock BEFORE DELETE ON public.criterion_score FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_criterion_score_delete();


--
-- Name: criterion_score criterion_score_range_and_lock; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER criterion_score_range_and_lock BEFORE INSERT OR UPDATE ON public.criterion_score FOR EACH ROW EXECUTE FUNCTION public.enforce_criterion_score_range();


--
-- Name: file_asset file_asset_object_scope_guard; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER file_asset_object_scope_guard BEFORE INSERT OR UPDATE OF stored_object_id, organization_id, challenge_id ON public.file_asset FOR EACH ROW EXECUTE FUNCTION public.enforce_file_asset_object_scope();


--
-- Name: form_response form_response_immutability_guard; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER form_response_immutability_guard BEFORE UPDATE ON public.form_response FOR EACH ROW EXECUTE FUNCTION public.prevent_submitted_form_response_mutation();


--
-- Name: form_response form_response_scope_guard; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER form_response_scope_guard BEFORE INSERT OR UPDATE ON public.form_response FOR EACH ROW EXECUTE FUNCTION public.enforce_form_scope_chain();


--
-- Name: form_version form_version_scope_guard; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER form_version_scope_guard BEFORE INSERT OR UPDATE ON public.form_version FOR EACH ROW EXECUTE FUNCTION public.enforce_form_scope_chain();


--
-- Name: organization_join_request join_request_form_chain_guard; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER join_request_form_chain_guard BEFORE INSERT OR UPDATE ON public.organization_join_request FOR EACH ROW EXECUTE FUNCTION public.enforce_join_request_form_chain();


--
-- Name: organization organization_default_limit; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER organization_default_limit AFTER INSERT ON public.organization FOR EACH ROW EXECUTE FUNCTION public.create_default_organization_limit();


--
-- Name: rubric_criterion rubric_criterion_immutable_after_judging; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER rubric_criterion_immutable_after_judging BEFORE INSERT OR DELETE OR UPDATE ON public.rubric_criterion FOR EACH ROW EXECUTE FUNCTION public.prevent_rubric_criterion_mutation_after_judging();


--
-- Name: rubric_criterion rubric_total_weight_matches_criteria; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE CONSTRAINT TRIGGER rubric_total_weight_matches_criteria AFTER INSERT OR DELETE OR UPDATE ON public.rubric_criterion DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verify_rubric_total_weight();


--
-- Name: scorecard scorecard_locked_total_immutable; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER scorecard_locked_total_immutable BEFORE UPDATE ON public.scorecard FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_scorecard_total_change();


--
-- Name: stored_object stored_object_scope_immutable; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER stored_object_scope_immutable BEFORE UPDATE ON public.stored_object FOR EACH ROW EXECUTE FUNCTION public.prevent_stored_object_scope_mutation();


--
-- Name: challenge_submission_requirement_version submission_requirement_immutable_guard; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER submission_requirement_immutable_guard BEFORE UPDATE ON public.challenge_submission_requirement_version FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_requirement_immutability();


--
-- Name: submission_result submission_result_immutable_update; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER submission_result_immutable_update BEFORE DELETE OR UPDATE ON public.submission_result FOR EACH ROW EXECUTE FUNCTION public.prevent_result_decision_mutation();


--
-- Name: submission_version submission_version_immutable_once_final; Type: TRIGGER; Schema: public; Owner: ip_migrator
--

CREATE TRIGGER submission_version_immutable_once_final BEFORE UPDATE ON public.submission_version FOR EACH ROW EXECUTE FUNCTION public.prevent_final_submission_version_update();


--
-- Name: account_deletion_request account_deletion_request_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.account_deletion_request
    ADD CONSTRAINT account_deletion_request_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: account account_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: analytics_daily_rollup analytics_rollup_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.analytics_daily_rollup
    ADD CONSTRAINT analytics_rollup_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: analytics_daily_rollup analytics_rollup_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.analytics_daily_rollup
    ADD CONSTRAINT analytics_rollup_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: announcement announcement_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.announcement
    ADD CONSTRAINT announcement_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: consent_record consent_terms_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.consent_record
    ADD CONSTRAINT consent_terms_version_fk FOREIGN KEY (terms_version_id, organization_id) REFERENCES public.challenge_terms_version(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: criterion_score criterion_score_criterion_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.criterion_score
    ADD CONSTRAINT criterion_score_criterion_fk FOREIGN KEY (criterion_id, organization_id, rubric_version_id) REFERENCES public.rubric_criterion(id, organization_id, rubric_version_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: criterion_score criterion_score_scorecard_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.criterion_score
    ADD CONSTRAINT criterion_score_scorecard_fk FOREIGN KEY (scorecard_id, organization_id, rubric_version_id) REFERENCES public.scorecard(id, organization_id, rubric_version_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: email_delivery_attempt email_delivery_attempt_delivery_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.email_delivery_attempt
    ADD CONSTRAINT email_delivery_attempt_delivery_fk FOREIGN KEY (email_delivery_id) REFERENCES public.email_delivery(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: email_delivery email_delivery_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.email_delivery
    ADD CONSTRAINT email_delivery_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: email_delivery email_delivery_recipient_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.email_delivery
    ADD CONSTRAINT email_delivery_recipient_fk FOREIGN KEY (recipient_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: faq faq_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.faq
    ADD CONSTRAINT faq_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: file_asset file_asset_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: file_asset file_asset_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: file_asset file_asset_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_owner_fk FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: file_asset file_asset_stored_object_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.file_asset
    ADD CONSTRAINT file_asset_stored_object_fk FOREIGN KEY (stored_object_id, organization_id) REFERENCES public.stored_object(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: form_definition form_definition_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.form_definition
    ADD CONSTRAINT form_definition_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: form_response form_response_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.form_response
    ADD CONSTRAINT form_response_version_fk FOREIGN KEY (form_version_id, organization_id) REFERENCES public.form_version(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: form_version form_version_definition_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.form_version
    ADD CONSTRAINT form_version_definition_fk FOREIGN KEY (form_definition_id, organization_id) REFERENCES public.form_definition(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: innovation innovation_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation
    ADD CONSTRAINT innovation_challenge_fk FOREIGN KEY (source_challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: innovation_evidence innovation_evidence_innovation_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_evidence
    ADD CONSTRAINT innovation_evidence_innovation_fk FOREIGN KEY (innovation_id, organization_id) REFERENCES public.innovation(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: innovation_metric innovation_metric_innovation_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_metric
    ADD CONSTRAINT innovation_metric_innovation_fk FOREIGN KEY (innovation_id, organization_id) REFERENCES public.innovation(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: innovation_metric_measurement innovation_metric_measurement_metric_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_metric_measurement
    ADD CONSTRAINT innovation_metric_measurement_metric_fk FOREIGN KEY (metric_id, organization_id) REFERENCES public.innovation_metric(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: innovation_milestone innovation_milestone_innovation_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_milestone
    ADD CONSTRAINT innovation_milestone_innovation_fk FOREIGN KEY (innovation_id, organization_id) REFERENCES public.innovation(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: innovation_stage_history innovation_stage_history_innovation_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation_stage_history
    ADD CONSTRAINT innovation_stage_history_innovation_fk FOREIGN KEY (innovation_id, organization_id) REFERENCES public.innovation(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: innovation innovation_submission_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.innovation
    ADD CONSTRAINT innovation_submission_fk FOREIGN KEY (source_submission_id, organization_id) REFERENCES public.submission(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: integration_delivery_attempt integration_attempt_delivery_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.integration_delivery_attempt
    ADD CONSTRAINT integration_attempt_delivery_fk FOREIGN KEY (integration_delivery_id, organization_id) REFERENCES public.integration_delivery(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: integration_delivery integration_delivery_integration_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.integration_delivery
    ADD CONSTRAINT integration_delivery_integration_fk FOREIGN KEY (integration_id, organization_id) REFERENCES public.integration(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_join_request join_request_form_response_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_request
    ADD CONSTRAINT join_request_form_response_fk FOREIGN KEY (form_response_id, organization_id) REFERENCES public.form_response(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: organization_join_request join_request_form_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_request
    ADD CONSTRAINT join_request_form_version_fk FOREIGN KEY (form_version_id, organization_id) REFERENCES public.form_version(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: judge_assignment judge_assignment_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.judge_assignment
    ADD CONSTRAINT judge_assignment_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: judge_assignment judge_assignment_staff_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.judge_assignment
    ADD CONSTRAINT judge_assignment_staff_fk FOREIGN KEY (staff_assignment_id, organization_id, challenge_id) REFERENCES public.challenge_staff_assignment(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: judge_assignment judge_assignment_submission_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.judge_assignment
    ADD CONSTRAINT judge_assignment_submission_fk FOREIGN KEY (submission_id, organization_id, challenge_id) REFERENCES public.submission(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: matchmaking_interest matchmaking_interest_post_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.matchmaking_interest
    ADD CONSTRAINT matchmaking_interest_post_fk FOREIGN KEY (post_id, organization_id) REFERENCES public.matchmaking_post(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: matchmaking_interest matchmaking_interest_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.matchmaking_interest
    ADD CONSTRAINT matchmaking_interest_user_fk FOREIGN KEY (interested_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matchmaking_post matchmaking_post_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.matchmaking_post
    ADD CONSTRAINT matchmaking_post_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: matchmaking_post matchmaking_post_team_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.matchmaking_post
    ADD CONSTRAINT matchmaking_post_team_fk FOREIGN KEY (poster_team_id, organization_id, challenge_id) REFERENCES public.challenge_team(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: matchmaking_post matchmaking_post_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.matchmaking_post
    ADD CONSTRAINT matchmaking_post_user_fk FOREIGN KEY (poster_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: media_asset media_asset_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.media_asset
    ADD CONSTRAINT media_asset_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: media_asset media_asset_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.media_asset
    ADD CONSTRAINT media_asset_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: media_asset media_asset_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.media_asset
    ADD CONSTRAINT media_asset_owner_fk FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification_preference notification_preference_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.notification_preference
    ADD CONSTRAINT notification_preference_user_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification notification_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_user_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: organization_application organization_application_created_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_application
    ADD CONSTRAINT organization_application_created_organization_id_fkey FOREIGN KEY (created_organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: organization_application organization_application_requester_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_application
    ADD CONSTRAINT organization_application_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_application organization_application_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_application
    ADD CONSTRAINT organization_application_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: organization_invitation organization_invitation_accepted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_invitation
    ADD CONSTRAINT organization_invitation_accepted_by_user_id_fkey FOREIGN KEY (accepted_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: organization_invitation organization_invitation_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_invitation
    ADD CONSTRAINT organization_invitation_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: organization_invitation organization_invitation_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_invitation
    ADD CONSTRAINT organization_invitation_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_join_code organization_join_code_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_code
    ADD CONSTRAINT organization_join_code_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: organization_join_code organization_join_code_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_code
    ADD CONSTRAINT organization_join_code_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_join_request organization_join_request_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_request
    ADD CONSTRAINT organization_join_request_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_join_request organization_join_request_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_request
    ADD CONSTRAINT organization_join_request_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: organization_join_request organization_join_request_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_join_request
    ADD CONSTRAINT organization_join_request_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_limit organization_limit_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_limit
    ADD CONSTRAINT organization_limit_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_membership organization_membership_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_membership
    ADD CONSTRAINT organization_membership_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_membership organization_membership_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_membership
    ADD CONSTRAINT organization_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: outbox_event outbox_event_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.outbox_event
    ADD CONSTRAINT outbox_event_actor_fk FOREIGN KEY (actor_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: challenge_participation participation_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_participation
    ADD CONSTRAINT participation_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_participation participation_form_response_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_participation
    ADD CONSTRAINT participation_form_response_fk FOREIGN KEY (form_response_id, organization_id, challenge_id) REFERENCES public.form_response(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: challenge_participation participation_terms_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_participation
    ADD CONSTRAINT participation_terms_version_fk FOREIGN KEY (terms_version_id, organization_id, challenge_id) REFERENCES public.challenge_terms_version(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: platform_role_assignment platform_role_assignment_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.platform_role_assignment
    ADD CONSTRAINT platform_role_assignment_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: platform_role_assignment platform_role_assignment_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.platform_role_assignment
    ADD CONSTRAINT platform_role_assignment_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_prize prize_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_prize
    ADD CONSTRAINT prize_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reminder_schedule reminder_schedule_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.reminder_schedule
    ADD CONSTRAINT reminder_schedule_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reminder_schedule reminder_schedule_innovation_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.reminder_schedule
    ADD CONSTRAINT reminder_schedule_innovation_fk FOREIGN KEY (innovation_id, organization_id) REFERENCES public.innovation(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reminder_schedule reminder_schedule_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.reminder_schedule
    ADD CONSTRAINT reminder_schedule_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: result_snapshot result_snapshot_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.result_snapshot
    ADD CONSTRAINT result_snapshot_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: result_snapshot result_snapshot_finalizer_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.result_snapshot
    ADD CONSTRAINT result_snapshot_finalizer_fk FOREIGN KEY (finalized_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rubric rubric_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.rubric
    ADD CONSTRAINT rubric_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rubric_criterion rubric_criterion_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.rubric_criterion
    ADD CONSTRAINT rubric_criterion_version_fk FOREIGN KEY (rubric_version_id, organization_id) REFERENCES public.rubric_version(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rubric_version rubric_version_rubric_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.rubric_version
    ADD CONSTRAINT rubric_version_rubric_fk FOREIGN KEY (rubric_id, organization_id, challenge_id) REFERENCES public.rubric(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_schedule_change schedule_change_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_schedule_change
    ADD CONSTRAINT schedule_change_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scorecard scorecard_assignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.scorecard
    ADD CONSTRAINT scorecard_assignment_fk FOREIGN KEY (judge_assignment_id, organization_id, challenge_id) REFERENCES public.judge_assignment(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scorecard scorecard_rubric_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.scorecard
    ADD CONSTRAINT scorecard_rubric_version_fk FOREIGN KEY (rubric_version_id, organization_id, challenge_id) REFERENCES public.rubric_version(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: session session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_sponsor sponsor_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_sponsor
    ADD CONSTRAINT sponsor_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_staff_assignment staff_assignment_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_staff_assignment
    ADD CONSTRAINT staff_assignment_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_staff_invitation staff_invitation_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_staff_invitation
    ADD CONSTRAINT staff_invitation_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stored_object stored_object_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.stored_object
    ADD CONSTRAINT stored_object_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stored_object stored_object_organization_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.stored_object
    ADD CONSTRAINT stored_object_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stored_object stored_object_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.stored_object
    ADD CONSTRAINT stored_object_owner_fk FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_asset submission_asset_file_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_asset
    ADD CONSTRAINT submission_asset_file_fk FOREIGN KEY (file_asset_id, organization_id, challenge_id) REFERENCES public.file_asset(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_asset submission_asset_media_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_asset
    ADD CONSTRAINT submission_asset_media_fk FOREIGN KEY (media_asset_id, organization_id, challenge_id) REFERENCES public.media_asset(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_asset submission_asset_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_asset
    ADD CONSTRAINT submission_asset_version_fk FOREIGN KEY (submission_version_id, organization_id, challenge_id) REFERENCES public.submission_version(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: submission submission_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission
    ADD CONSTRAINT submission_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: submission submission_draft_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission
    ADD CONSTRAINT submission_draft_version_fk FOREIGN KEY (draft_version_id, organization_id, challenge_id, id) REFERENCES public.submission_version(id, organization_id, challenge_id, submission_id) ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: submission submission_final_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission
    ADD CONSTRAINT submission_final_version_fk FOREIGN KEY (final_version_id, organization_id, challenge_id, id) REFERENCES public.submission_version(id, organization_id, challenge_id, submission_id) ON UPDATE CASCADE ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: challenge_submission_requirement_version submission_requirement_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_submission_requirement_version
    ADD CONSTRAINT submission_requirement_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: challenge_submission_requirement_version submission_requirement_creator_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_submission_requirement_version
    ADD CONSTRAINT submission_requirement_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_result submission_result_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_result
    ADD CONSTRAINT submission_result_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: submission_result submission_result_snapshot_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_result
    ADD CONSTRAINT submission_result_snapshot_fk FOREIGN KEY (snapshot_id, organization_id, challenge_id) REFERENCES public.result_snapshot(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_result submission_result_submission_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_result
    ADD CONSTRAINT submission_result_submission_fk FOREIGN KEY (submission_id, organization_id, challenge_id) REFERENCES public.submission(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_result submission_result_track_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_result
    ADD CONSTRAINT submission_result_track_fk FOREIGN KEY (track_id, organization_id, challenge_id) REFERENCES public.challenge_track(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_result submission_result_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_result
    ADD CONSTRAINT submission_result_version_fk FOREIGN KEY (submission_version_id, organization_id, challenge_id, submission_id) REFERENCES public.submission_version(id, organization_id, challenge_id, submission_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission submission_team_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission
    ADD CONSTRAINT submission_team_fk FOREIGN KEY (team_id, organization_id, challenge_id) REFERENCES public.challenge_team(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_technology submission_technology_tag_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_technology
    ADD CONSTRAINT submission_technology_tag_fk FOREIGN KEY (technology_tag_id) REFERENCES public.technology_tag(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_technology submission_technology_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_technology
    ADD CONSTRAINT submission_technology_version_fk FOREIGN KEY (submission_version_id, organization_id, challenge_id) REFERENCES public.submission_version(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: submission submission_track_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission
    ADD CONSTRAINT submission_track_fk FOREIGN KEY (track_id, organization_id, challenge_id) REFERENCES public.challenge_track(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_version submission_version_creator_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_version
    ADD CONSTRAINT submission_version_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: submission_version submission_version_submission_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_version
    ADD CONSTRAINT submission_version_submission_fk FOREIGN KEY (submission_id, organization_id, challenge_id) REFERENCES public.submission(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: submission_version submission_version_terms_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.submission_version
    ADD CONSTRAINT submission_version_terms_fk FOREIGN KEY (terms_version_id, organization_id, challenge_id) REFERENCES public.challenge_terms_version(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: support_ticket_comment support_ticket_comment_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.support_ticket_comment
    ADD CONSTRAINT support_ticket_comment_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_ticket(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: support_ticket_internal_note support_ticket_internal_note_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.support_ticket_internal_note
    ADD CONSTRAINT support_ticket_internal_note_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_ticket(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_team team_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_team
    ADD CONSTRAINT team_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: team_invitation team_invitation_invitee_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.team_invitation
    ADD CONSTRAINT team_invitation_invitee_fk FOREIGN KEY (invited_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: team_invitation team_invitation_inviter_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.team_invitation
    ADD CONSTRAINT team_invitation_inviter_fk FOREIGN KEY (invited_by_user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: team_invitation team_invitation_team_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.team_invitation
    ADD CONSTRAINT team_invitation_team_fk FOREIGN KEY (team_id, organization_id, challenge_id) REFERENCES public.challenge_team(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_team_member team_member_team_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_team_member
    ADD CONSTRAINT team_member_team_fk FOREIGN KEY (team_id, organization_id, challenge_id) REFERENCES public.challenge_team(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_team_member team_member_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_team_member
    ADD CONSTRAINT team_member_user_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: challenge_team team_track_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_team
    ADD CONSTRAINT team_track_fk FOREIGN KEY (track_id, organization_id, challenge_id) REFERENCES public.challenge_track(id, organization_id, challenge_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: challenge_terms_version terms_version_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_terms_version
    ADD CONSTRAINT terms_version_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: challenge_track track_challenge_fk; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.challenge_track
    ADD CONSTRAINT track_challenge_fk FOREIGN KEY (challenge_id, organization_id) REFERENCES public.challenge(id, organization_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: two_factor two_factor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.two_factor
    ADD CONSTRAINT two_factor_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_profile user_profile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_skill user_skill_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.user_skill
    ADD CONSTRAINT user_skill_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skill(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_skill user_skill_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ip_migrator
--

ALTER TABLE ONLY public.user_skill
    ADD CONSTRAINT user_skill_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


CREATE FUNCTION public.prevent_media_asset_scope_mutation() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.delivery_type IS DISTINCT FROM OLD.delivery_type
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.challenge_id IS DISTINCT FROM OLD.challenge_id
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
     OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.cloudinary_public_id IS DISTINCT FROM OLD.cloudinary_public_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'media asset authorization scope is immutable';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.prevent_media_asset_scope_mutation() FROM PUBLIC;

CREATE TRIGGER media_asset_scope_immutable
BEFORE UPDATE OF purpose, delivery_type, organization_id, challenge_id, owner_user_id, resource_type, resource_id, cloudinary_public_id
ON public.media_asset
FOR EACH ROW EXECUTE FUNCTION public.prevent_media_asset_scope_mutation();


-- Reject polymorphic bindings whose exact target is outside the declared
-- organization/challenge. Implicit bindings (user, organization, challenge)
-- are enforced by media_asset_scope_chk and ordinary foreign keys.
CREATE FUNCTION public.validate_media_asset_resource_scope() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.purpose = 'SPONSOR_LOGO'::public."MediaAssetPurpose"
     AND NOT EXISTS (
       SELECT 1 FROM public.challenge_sponsor s
       WHERE s.id = NEW.resource_id
         AND s.organization_id = NEW.organization_id
         AND s.challenge_id = NEW.challenge_id
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'media asset sponsor binding is outside its authorization scope';
  ELSIF NEW.purpose = 'SUBMISSION_SCREENSHOT'::public."MediaAssetPurpose"
     AND NOT EXISTS (
       SELECT 1 FROM public.submission s
       WHERE s.id = NEW.resource_id
         AND s.organization_id = NEW.organization_id
         AND s.challenge_id = NEW.challenge_id
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'media asset submission binding is outside its authorization scope';
  ELSIF NEW.purpose = 'SUPPORT_TICKET_SCREENSHOT'::public."MediaAssetPurpose"
     AND NOT EXISTS (
       SELECT 1 FROM public.support_ticket t
       WHERE t.id = NEW.resource_id
         AND t.user_id = NEW.owner_user_id
         AND t.organization_id IS NOT DISTINCT FROM NEW.organization_id
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'media asset support-ticket binding is outside its authorization scope';
  ELSIF NEW.purpose = 'PORTFOLIO_EVIDENCE'::public."MediaAssetPurpose"
     AND NOT EXISTS (
       SELECT 1 FROM public.innovation i
       WHERE i.id = NEW.resource_id
         AND i.organization_id = NEW.organization_id
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'media asset innovation binding is outside its authorization scope';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.validate_media_asset_resource_scope() FROM PUBLIC;

CREATE TRIGGER media_asset_resource_scope_valid
BEFORE INSERT ON public.media_asset
FOR EACH ROW EXECUTE FUNCTION public.validate_media_asset_resource_scope();


-- Domain records may reference only a confirmed asset authorization issued
-- for that exact resource. This is intentionally a database invariant rather
-- than a convention in each service method.
CREATE FUNCTION public.validate_media_asset_attachment() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  expected_asset_id uuid;
  expected_purpose public."MediaAssetPurpose";
  expected_organization_id uuid;
  expected_challenge_id uuid;
  expected_resource_type text;
  expected_resource_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'user_profile' THEN
    expected_asset_id := NEW.avatar_asset_id;
    expected_purpose := 'USER_AVATAR';
    expected_organization_id := NULL;
    expected_challenge_id := NULL;
    expected_resource_type := 'user';
    expected_resource_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'organization' THEN
    expected_asset_id := NEW.logo_asset_id;
    expected_purpose := 'ORGANIZATION_LOGO';
    expected_organization_id := NEW.id;
    expected_challenge_id := NULL;
    expected_resource_type := 'organization';
    expected_resource_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'challenge' THEN
    expected_asset_id := NEW.cover_asset_id;
    expected_purpose := 'CHALLENGE_COVER';
    expected_organization_id := NEW.organization_id;
    expected_challenge_id := NEW.id;
    expected_resource_type := 'challenge';
    expected_resource_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'challenge_sponsor' THEN
    expected_asset_id := NEW.logo_asset_id;
    expected_purpose := 'SPONSOR_LOGO';
    expected_organization_id := NEW.organization_id;
    expected_challenge_id := NEW.challenge_id;
    expected_resource_type := 'challenge_sponsor';
    expected_resource_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'submission_asset' THEN
    expected_asset_id := NEW.media_asset_id;
    IF expected_asset_id IS NOT NULL THEN
      SELECT sv.submission_id
      INTO expected_resource_id
      FROM public.submission_version sv
      WHERE sv.id = NEW.submission_version_id
        AND sv.organization_id = NEW.organization_id
        AND sv.challenge_id = NEW.challenge_id;
    END IF;
    expected_purpose := 'SUBMISSION_SCREENSHOT';
    expected_organization_id := NEW.organization_id;
    expected_challenge_id := NEW.challenge_id;
    expected_resource_type := 'submission';
  ELSIF TG_TABLE_NAME = 'innovation_evidence' THEN
    expected_asset_id := NEW.media_asset_id;
    expected_purpose := 'PORTFOLIO_EVIDENCE';
    expected_organization_id := NEW.organization_id;
    expected_challenge_id := NULL;
    expected_resource_type := 'innovation';
    expected_resource_id := NEW.innovation_id;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unsupported media attachment table';
  END IF;

  IF expected_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF expected_resource_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.media_asset m
    WHERE m.id = expected_asset_id
      AND m.status = 'CONFIRMED'::public."MediaAssetStatus"
      AND m.purpose = expected_purpose
      AND m.organization_id IS NOT DISTINCT FROM expected_organization_id
      AND m.challenge_id IS NOT DISTINCT FROM expected_challenge_id
      AND m.resource_type = expected_resource_type
      AND m.resource_id = expected_resource_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'media asset was not confirmed for this exact resource';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.validate_media_asset_attachment() FROM PUBLIC;

CREATE TRIGGER user_profile_media_attachment_valid
BEFORE INSERT OR UPDATE OF avatar_asset_id ON public.user_profile
FOR EACH ROW EXECUTE FUNCTION public.validate_media_asset_attachment();

CREATE TRIGGER organization_media_attachment_valid
BEFORE INSERT OR UPDATE OF logo_asset_id ON public.organization
FOR EACH ROW EXECUTE FUNCTION public.validate_media_asset_attachment();

CREATE TRIGGER challenge_media_attachment_valid
BEFORE INSERT OR UPDATE OF cover_asset_id ON public.challenge
FOR EACH ROW EXECUTE FUNCTION public.validate_media_asset_attachment();

CREATE TRIGGER challenge_sponsor_media_attachment_valid
BEFORE INSERT OR UPDATE OF logo_asset_id ON public.challenge_sponsor
FOR EACH ROW EXECUTE FUNCTION public.validate_media_asset_attachment();

CREATE TRIGGER submission_asset_media_attachment_valid
BEFORE INSERT OR UPDATE OF media_asset_id, submission_version_id, organization_id, challenge_id
ON public.submission_asset
FOR EACH ROW EXECUTE FUNCTION public.validate_media_asset_attachment();

CREATE TRIGGER innovation_evidence_media_attachment_valid
BEFORE INSERT OR UPDATE OF media_asset_id, innovation_id, organization_id
ON public.innovation_evidence
FOR EACH ROW EXECUTE FUNCTION public.validate_media_asset_attachment();


-- Resolve only the scope of one opaque media identifier before RLS context is
-- known. This cannot enumerate assets or return provider metadata.
CREATE FUNCTION public.app_resolve_media_asset_context(p_asset_id uuid, p_actor_user_id uuid)
RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, owned_by_actor boolean, purpose public."MediaAssetPurpose")
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT m.id, m.organization_id, m.challenge_id,
         m.owner_user_id = p_actor_user_id AS owned_by_actor, m.purpose
  FROM public.media_asset AS m
  WHERE m.id = p_asset_id
    AND EXISTS (
      SELECT 1 FROM public."user" AS u
      WHERE u.id = p_actor_user_id AND u.deleted_at IS NULL
    )
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.app_resolve_media_asset_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_resolve_media_asset_context(uuid, uuid) TO ip_app;
COMMENT ON FUNCTION public.app_resolve_media_asset_context(uuid, uuid) IS
  'Exact-ID media scope resolver. Returns no provider metadata and cannot enumerate rows.';


-- Public delivery never opens the media table. It resolves one opaque asset
-- only when that asset is confirmed, attached to the exact declared resource,
-- and the resource is public at query time. Privacy/moderation changes take
-- effect immediately because no public flag is copied onto media_asset.
CREATE FUNCTION public.app_resolve_public_media_delivery(p_asset_id uuid)
RETURNS TABLE(
  cloudinary_public_id character varying,
  delivery_type public."MediaAssetDeliveryType",
  format character varying
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  SELECT m.cloudinary_public_id, m.delivery_type, m.format
  FROM public.media_asset m
  WHERE m.id = p_asset_id
    AND m.status = 'CONFIRMED'::public."MediaAssetStatus"
    AND (
      (m.purpose = 'ORGANIZATION_LOGO'::public."MediaAssetPurpose" AND EXISTS (
        SELECT 1 FROM public.organization o
        WHERE o.id = m.resource_id
          AND o.id = m.organization_id
          AND o.logo_asset_id = m.id
          AND o.status = 'ACTIVE'::public."OrganizationStatus"
          AND o.visibility = 'PUBLIC'::public."OrganizationVisibility"
      ))
      OR (m.purpose = 'CHALLENGE_COVER'::public."MediaAssetPurpose" AND EXISTS (
        SELECT 1
        FROM public.challenge c
        JOIN public.organization o ON o.id = c.organization_id
        WHERE c.id = m.resource_id
          AND c.id = m.challenge_id
          AND c.organization_id = m.organization_id
          AND c.cover_asset_id = m.id
          AND c.visibility = 'PUBLIC'::public."ChallengeVisibility"
          AND c.published_at IS NOT NULL
          AND c.moderation_hidden_at IS NULL
          AND o.status = 'ACTIVE'::public."OrganizationStatus"
      ))
      OR (m.purpose = 'SPONSOR_LOGO'::public."MediaAssetPurpose" AND EXISTS (
        SELECT 1
        FROM public.challenge_sponsor s
        JOIN public.challenge c
          ON c.id = s.challenge_id AND c.organization_id = s.organization_id
        JOIN public.organization o ON o.id = s.organization_id
        WHERE s.id = m.resource_id
          AND s.organization_id = m.organization_id
          AND s.challenge_id = m.challenge_id
          AND s.logo_asset_id = m.id
          AND c.visibility = 'PUBLIC'::public."ChallengeVisibility"
          AND c.published_at IS NOT NULL
          AND c.moderation_hidden_at IS NULL
          AND o.status = 'ACTIVE'::public."OrganizationStatus"
      ))
      OR (m.purpose = 'SUBMISSION_SCREENSHOT'::public."MediaAssetPurpose" AND EXISTS (
        SELECT 1
        FROM public.submission_asset sa
        JOIN public.submission_version v
          ON v.id = sa.submission_version_id
         AND v.organization_id = sa.organization_id
         AND v.challenge_id = sa.challenge_id
        JOIN public.submission s
          ON s.id = v.submission_id
         AND s.organization_id = v.organization_id
         AND s.challenge_id = v.challenge_id
        JOIN public.challenge c
          ON c.id = s.challenge_id AND c.organization_id = s.organization_id
        JOIN public.organization o ON o.id = s.organization_id
        WHERE sa.media_asset_id = m.id
          AND s.id = m.resource_id
          AND s.final_version_id = v.id
          AND v.publication_consent = true
          AND s.disqualified_at IS NULL
          AND c.visibility = 'PUBLIC'::public."ChallengeVisibility"
          AND c.published_at IS NOT NULL
          AND c.moderation_hidden_at IS NULL
          AND o.status = 'ACTIVE'::public."OrganizationStatus"
      ))
      OR (m.purpose = 'PORTFOLIO_EVIDENCE'::public."MediaAssetPurpose" AND EXISTS (
        SELECT 1
        FROM public.innovation_evidence e
        JOIN public.innovation i
          ON i.id = e.innovation_id AND i.organization_id = e.organization_id
        JOIN public.organization o ON o.id = i.organization_id
        WHERE e.media_asset_id = m.id
          AND i.id = m.resource_id
          AND i.organization_id = m.organization_id
          AND i.public_visible = true
          AND o.status = 'ACTIVE'::public."OrganizationStatus"
      ))
    )
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.app_resolve_public_media_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_resolve_public_media_delivery(uuid) TO ip_app;
COMMENT ON FUNCTION public.app_resolve_public_media_delivery(uuid) IS
  'Exact-ID public media resolver. Returns delivery metadata only for a currently attached, public-eligible resource.';


--
-- Name: analytics_daily_rollup; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.analytics_daily_rollup ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_daily_rollup analytics_daily_rollup_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY analytics_daily_rollup_tenant_isolation ON public.analytics_daily_rollup USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: announcement; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.announcement ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement announcement_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY announcement_tenant_isolation ON public.announcement USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: audit_event; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.audit_event ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_event audit_event_scoped_access; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY audit_event_scoped_access ON public.audit_event USING (((organization_id = public.app_current_organization_id()) OR ((organization_id IS NULL) AND (actor_user_id = public.app_current_actor_id())) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR ((organization_id IS NULL) AND (actor_user_id = public.app_current_actor_id())) OR public.app_platform_access()));


--
-- Name: challenge; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participation; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_participation ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participation challenge_participation_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_participation_tenant_isolation ON public.challenge_participation USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_prize; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_prize ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_prize challenge_prize_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_prize_tenant_isolation ON public.challenge_prize USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_schedule_change; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_schedule_change ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_schedule_change challenge_schedule_change_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_schedule_change_tenant_isolation ON public.challenge_schedule_change USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_sponsor; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_sponsor ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_sponsor challenge_sponsor_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_sponsor_tenant_isolation ON public.challenge_sponsor USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_staff_assignment; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_staff_assignment ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_staff_assignment challenge_staff_assignment_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_staff_assignment_tenant_isolation ON public.challenge_staff_assignment USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_staff_invitation; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_staff_invitation ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_staff_invitation challenge_staff_invitation_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_staff_invitation_tenant_isolation ON public.challenge_staff_invitation USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access() OR public.app_secret_lookup_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_submission_requirement_version; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_submission_requirement_version ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_team; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_team ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_team_member; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_team_member ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_team_member challenge_team_member_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_team_member_tenant_isolation ON public.challenge_team_member USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_team challenge_team_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_team_tenant_isolation ON public.challenge_team USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge challenge_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_tenant_isolation ON public.challenge USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_terms_version; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_terms_version ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_terms_version challenge_terms_version_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_terms_version_tenant_isolation ON public.challenge_terms_version USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_track; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.challenge_track ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_track challenge_track_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY challenge_track_tenant_isolation ON public.challenge_track USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: consent_record; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.consent_record ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_record consent_record_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY consent_record_tenant_isolation ON public.consent_record USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: criterion_score; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.criterion_score ENABLE ROW LEVEL SECURITY;

--
-- Name: criterion_score criterion_score_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY criterion_score_tenant_isolation ON public.criterion_score USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: data_export; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.data_export ENABLE ROW LEVEL SECURITY;

--
-- Name: data_export data_export_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY data_export_tenant_isolation ON public.data_export USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: email_delivery; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.email_delivery ENABLE ROW LEVEL SECURITY;

--
-- Name: email_delivery_attempt; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.email_delivery_attempt ENABLE ROW LEVEL SECURITY;

--
-- Name: email_delivery_attempt email_delivery_attempt_scope; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY email_delivery_attempt_scope ON public.email_delivery_attempt USING ((EXISTS ( SELECT 1
   FROM public.email_delivery d
  WHERE (d.id = email_delivery_attempt.email_delivery_id)))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.email_delivery d
  WHERE (d.id = email_delivery_attempt.email_delivery_id))));


--
-- Name: email_delivery email_delivery_scope; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY email_delivery_scope ON public.email_delivery USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access() OR ((organization_id IS NULL) AND (recipient_user_id IS NOT NULL) AND (recipient_user_id = public.app_current_actor_id())))) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access() OR ((organization_id IS NULL) AND (recipient_user_id IS NOT NULL) AND (recipient_user_id = public.app_current_actor_id()))));


--
-- Name: faq; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;

--
-- Name: faq faq_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY faq_tenant_isolation ON public.faq USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: file_asset; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.file_asset ENABLE ROW LEVEL SECURITY;

--
-- Name: file_asset file_asset_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY file_asset_tenant_isolation ON public.file_asset USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: form_definition; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.form_definition ENABLE ROW LEVEL SECURITY;

--
-- Name: form_definition form_definition_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY form_definition_tenant_isolation ON public.form_definition USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: form_response; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.form_response ENABLE ROW LEVEL SECURITY;

--
-- Name: form_response form_response_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY form_response_tenant_isolation ON public.form_response USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: form_version; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.form_version ENABLE ROW LEVEL SECURITY;

--
-- Name: form_version form_version_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY form_version_tenant_isolation ON public.form_version USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: idempotency_record; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.idempotency_record ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency_record idempotency_record_scoped_access; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY idempotency_record_scoped_access ON public.idempotency_record USING ((public.app_platform_access() OR ((actor_user_id = public.app_current_actor_id()) AND ((organization_id IS NULL) OR (organization_id = public.app_current_organization_id()))))) WITH CHECK ((public.app_platform_access() OR ((actor_user_id = public.app_current_actor_id()) AND ((organization_id IS NULL) OR (organization_id = public.app_current_organization_id())))));


--
-- Name: innovation; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.innovation ENABLE ROW LEVEL SECURITY;

--
-- Name: innovation_evidence; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.innovation_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: innovation_evidence innovation_evidence_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY innovation_evidence_tenant_isolation ON public.innovation_evidence USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: innovation_metric; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.innovation_metric ENABLE ROW LEVEL SECURITY;

--
-- Name: innovation_metric_measurement; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.innovation_metric_measurement ENABLE ROW LEVEL SECURITY;

--
-- Name: innovation_metric_measurement innovation_metric_measurement_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY innovation_metric_measurement_tenant_isolation ON public.innovation_metric_measurement USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: innovation_metric innovation_metric_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY innovation_metric_tenant_isolation ON public.innovation_metric USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: innovation_milestone; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.innovation_milestone ENABLE ROW LEVEL SECURITY;

--
-- Name: innovation_milestone innovation_milestone_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY innovation_milestone_tenant_isolation ON public.innovation_milestone USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: innovation_stage_history; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.innovation_stage_history ENABLE ROW LEVEL SECURITY;

--
-- Name: innovation_stage_history innovation_stage_history_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY innovation_stage_history_tenant_isolation ON public.innovation_stage_history USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: innovation innovation_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY innovation_tenant_isolation ON public.innovation USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: integration; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.integration ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_delivery; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.integration_delivery ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_delivery_attempt; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.integration_delivery_attempt ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_delivery_attempt integration_delivery_attempt_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY integration_delivery_attempt_tenant_isolation ON public.integration_delivery_attempt USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: integration_delivery integration_delivery_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY integration_delivery_tenant_isolation ON public.integration_delivery USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: integration integration_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY integration_tenant_isolation ON public.integration USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: judge_assignment; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.judge_assignment ENABLE ROW LEVEL SECURITY;

--
-- Name: judge_assignment judge_assignment_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY judge_assignment_tenant_isolation ON public.judge_assignment USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: matchmaking_interest; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.matchmaking_interest ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_interest matchmaking_interest_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY matchmaking_interest_tenant_isolation ON public.matchmaking_interest USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


-- Organization media follows tenant context; user media follows the
-- server-controlled actor context. Workers use explicit platform purpose.
ALTER TABLE public.media_asset ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_asset_scoped_access ON public.media_asset
USING (
  (organization_id = public.app_current_organization_id())
  OR (organization_id IS NULL AND owner_user_id = public.app_current_actor_id())
  OR public.app_platform_access()
)
WITH CHECK (
  (organization_id = public.app_current_organization_id())
  OR (organization_id IS NULL AND owner_user_id = public.app_current_actor_id())
  OR public.app_platform_access()
);


--
-- Name: matchmaking_post; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.matchmaking_post ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_post matchmaking_post_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY matchmaking_post_tenant_isolation ON public.matchmaking_post USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: notification; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;

--
-- Name: notification notification_owner_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY notification_owner_isolation ON public.notification USING (((user_id = public.app_current_actor_id()) OR public.app_platform_access())) WITH CHECK (((user_id = public.app_current_actor_id()) OR public.app_platform_access()));


--
-- Name: notification_preference; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.notification_preference ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preference notification_preference_owner_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY notification_preference_owner_isolation ON public.notification_preference USING (((user_id = public.app_current_actor_id()) OR public.app_platform_access())) WITH CHECK (((user_id = public.app_current_actor_id()) OR public.app_platform_access()));


--
-- Name: organization; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_invitation; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.organization_invitation ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_invitation organization_invitation_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY organization_invitation_tenant_isolation ON public.organization_invitation USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access() OR public.app_secret_lookup_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: organization_join_code; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.organization_join_code ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_join_code organization_join_code_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY organization_join_code_tenant_isolation ON public.organization_join_code USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access() OR public.app_secret_lookup_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access() OR public.app_secret_lookup_access()));


--
-- Name: organization_join_request; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.organization_join_request ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_join_request organization_join_request_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY organization_join_request_tenant_isolation ON public.organization_join_request USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: organization_limit; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.organization_limit ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_limit organization_limit_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY organization_limit_tenant_isolation ON public.organization_limit USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: organization_membership; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.organization_membership ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_membership organization_membership_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY organization_membership_tenant_isolation ON public.organization_membership USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: organization_settings; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_settings organization_settings_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY organization_settings_tenant_isolation ON public.organization_settings USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: organization organization_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY organization_tenant_isolation ON public.organization USING (((id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: outbox_event; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.outbox_event ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox_event outbox_event_scoped_access; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY outbox_event_scoped_access ON public.outbox_event USING (((organization_id = public.app_current_organization_id()) OR ((organization_id IS NULL) AND (actor_user_id = public.app_current_actor_id())) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR ((organization_id IS NULL) AND (actor_user_id = public.app_current_actor_id())) OR public.app_platform_access()));


--
-- Name: reminder_schedule; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.reminder_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: reminder_schedule reminder_schedule_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY reminder_schedule_tenant_isolation ON public.reminder_schedule USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: result_snapshot; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.result_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: result_snapshot result_snapshot_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY result_snapshot_tenant_isolation ON public.result_snapshot USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: rubric; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.rubric ENABLE ROW LEVEL SECURITY;

--
-- Name: rubric_criterion; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.rubric_criterion ENABLE ROW LEVEL SECURITY;

--
-- Name: rubric_criterion rubric_criterion_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY rubric_criterion_tenant_isolation ON public.rubric_criterion USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: rubric rubric_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY rubric_tenant_isolation ON public.rubric USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: rubric_version; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.rubric_version ENABLE ROW LEVEL SECURITY;

--
-- Name: rubric_version rubric_version_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY rubric_version_tenant_isolation ON public.rubric_version USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: scorecard; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.scorecard ENABLE ROW LEVEL SECURITY;

--
-- Name: scorecard scorecard_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY scorecard_tenant_isolation ON public.scorecard USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: stored_object; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.stored_object ENABLE ROW LEVEL SECURITY;

--
-- Name: stored_object stored_object_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY stored_object_tenant_isolation ON public.stored_object USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: submission; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.submission ENABLE ROW LEVEL SECURITY;

--
-- Name: submission_asset; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.submission_asset ENABLE ROW LEVEL SECURITY;

--
-- Name: submission_asset submission_asset_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY submission_asset_tenant_isolation ON public.submission_asset USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: challenge_submission_requirement_version submission_requirement_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY submission_requirement_tenant_isolation ON public.challenge_submission_requirement_version USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: submission_result; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.submission_result ENABLE ROW LEVEL SECURITY;

--
-- Name: submission_result submission_result_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY submission_result_tenant_isolation ON public.submission_result USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: submission_technology; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.submission_technology ENABLE ROW LEVEL SECURITY;

--
-- Name: submission_technology submission_technology_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY submission_technology_tenant_isolation ON public.submission_technology USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: submission submission_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY submission_tenant_isolation ON public.submission USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: submission_version; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.submission_version ENABLE ROW LEVEL SECURITY;

--
-- Name: submission_version submission_version_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY submission_version_tenant_isolation ON public.submission_version USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: team_invitation; Type: ROW SECURITY; Schema: public; Owner: ip_migrator
--

ALTER TABLE public.team_invitation ENABLE ROW LEVEL SECURITY;

--
-- Name: team_invitation team_invitation_tenant_isolation; Type: POLICY; Schema: public; Owner: ip_migrator
--

CREATE POLICY team_invitation_tenant_isolation ON public.team_invitation USING (((organization_id = public.app_current_organization_id()) OR public.app_platform_access() OR public.app_secret_lookup_access())) WITH CHECK (((organization_id = public.app_current_organization_id()) OR public.app_platform_access()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: ip_migrator
--

GRANT USAGE ON SCHEMA public TO ip_app;
GRANT USAGE ON SCHEMA public TO ip_public_views;
REVOKE CREATE ON SCHEMA public FROM ip_public_views;

-- The no-login view owner receives only the base-table reads its eight public
-- projections require. It has no access to identity, audit, delivery, file,
-- integration, idempotency, or other private tables.
GRANT SELECT ON TABLE public.announcement TO ip_public_views;
GRANT SELECT ON TABLE public.challenge TO ip_public_views;
GRANT SELECT ON TABLE public.challenge_team TO ip_public_views;
GRANT SELECT ON TABLE public.challenge_track TO ip_public_views;
GRANT SELECT ON TABLE public.faq TO ip_public_views;
GRANT SELECT ON TABLE public.innovation TO ip_public_views;
GRANT SELECT ON TABLE public.organization TO ip_public_views;
GRANT SELECT ON TABLE public.result_snapshot TO ip_public_views;
GRANT SELECT ON TABLE public.submission TO ip_public_views;
GRANT SELECT ON TABLE public.submission_result TO ip_public_views;
GRANT SELECT ON TABLE public.submission_technology TO ip_public_views;
GRANT SELECT ON TABLE public.submission_version TO ip_public_views;


--
-- Name: FUNCTION app_current_actor_id(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.app_current_actor_id() TO ip_app;


--
-- Name: FUNCTION app_current_organization_id(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.app_current_organization_id() TO ip_app;


--
-- Name: FUNCTION app_find_my_judge_assignment(p_assignment_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_find_my_judge_assignment(p_assignment_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_find_my_judge_assignment(p_assignment_id uuid, p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_find_my_scorecard(p_assignment_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_find_my_scorecard(p_assignment_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_find_my_scorecard(p_assignment_id uuid, p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_list_active_memberships(p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_list_active_memberships(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_list_active_memberships(p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_list_my_challenge_participations(p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_list_my_challenge_participations(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_list_my_challenge_participations(p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_list_my_join_requests(p_user_id uuid, p_cursor_at timestamp with time zone, p_cursor_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_list_my_join_requests(p_user_id uuid, p_cursor_at timestamp with time zone, p_cursor_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_list_my_join_requests(p_user_id uuid, p_cursor_at timestamp with time zone, p_cursor_id uuid, p_limit integer) TO ip_app;


--
-- Name: FUNCTION app_list_my_judge_assignments(p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_list_my_judge_assignments(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_list_my_judge_assignments(p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_list_my_staff_invitations(p_email text); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_list_my_staff_invitations(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_list_my_staff_invitations(p_email text) TO ip_app;


--
-- Name: FUNCTION app_list_my_team_invitations(p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_list_my_team_invitations(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_list_my_team_invitations(p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_organization_slug_taken(p_slug text); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_organization_slug_taken(p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_organization_slug_taken(p_slug text) TO ip_app;


--
-- Name: FUNCTION app_platform_access(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.app_platform_access() TO ip_app;


--
-- Name: FUNCTION app_resolve_challenge_context(p_challenge_id uuid, p_organization_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_resolve_challenge_context(p_challenge_id uuid, p_organization_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_resolve_challenge_context(p_challenge_id uuid, p_organization_id uuid, p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_resolve_file_context(p_file_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_resolve_file_context(p_file_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_resolve_file_context(p_file_id uuid, p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_resolve_organization_context(p_organization_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_resolve_organization_context(p_organization_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_resolve_organization_context(p_organization_id uuid, p_user_id uuid) TO ip_app;


--
-- Name: FUNCTION app_secret_lookup_access(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.app_secret_lookup_access() TO ip_app;


--
-- Name: FUNCTION app_user_has_organization_membership(p_user_id uuid, p_organization_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_user_has_organization_membership(p_user_id uuid, p_organization_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_user_has_organization_membership(p_user_id uuid, p_organization_id uuid) TO ip_app;


--
-- Name: FUNCTION app_user_shares_organization(p_viewer_id uuid, p_target_id uuid); Type: ACL; Schema: public; Owner: ip_migrator
--

REVOKE ALL ON FUNCTION public.app_user_shares_organization(p_viewer_id uuid, p_target_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_user_shares_organization(p_viewer_id uuid, p_target_id uuid) TO ip_app;


--
-- Name: FUNCTION create_default_organization_limit(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.create_default_organization_limit() TO ip_app;


--
-- Name: FUNCTION enforce_criterion_score_range(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.enforce_criterion_score_range() TO ip_app;


--
-- Name: FUNCTION enforce_file_asset_object_scope(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.enforce_file_asset_object_scope() TO ip_app;


--
-- Name: FUNCTION enforce_form_scope_chain(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.enforce_form_scope_chain() TO ip_app;


--
-- Name: FUNCTION enforce_join_request_form_chain(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.enforce_join_request_form_chain() TO ip_app;


--
-- Name: FUNCTION enforce_submission_requirement_immutability(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.enforce_submission_requirement_immutability() TO ip_app;


--
-- Name: FUNCTION prevent_final_submission_version_update(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.prevent_final_submission_version_update() TO ip_app;


--
-- Name: FUNCTION prevent_locked_criterion_score_delete(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.prevent_locked_criterion_score_delete() TO ip_app;


--
-- Name: FUNCTION prevent_locked_scorecard_total_change(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.prevent_locked_scorecard_total_change() TO ip_app;


--
-- Name: FUNCTION prevent_result_decision_mutation(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.prevent_result_decision_mutation() TO ip_app;


--
-- Name: FUNCTION prevent_rubric_criterion_mutation_after_judging(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.prevent_rubric_criterion_mutation_after_judging() TO ip_app;


--
-- Name: FUNCTION prevent_stored_object_scope_mutation(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.prevent_stored_object_scope_mutation() TO ip_app;


--
-- Name: FUNCTION prevent_submitted_form_response_mutation(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.prevent_submitted_form_response_mutation() TO ip_app;


--
-- Name: FUNCTION verify_rubric_total_weight(); Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT ALL ON FUNCTION public.verify_rubric_total_weight() TO ip_app;


--
-- Name: TABLE account; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account TO ip_app;


--
-- Name: TABLE account_deletion_request; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_deletion_request TO ip_app;


--
-- Name: TABLE analytics_daily_rollup; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.analytics_daily_rollup TO ip_app;


--
-- Name: TABLE announcement; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.announcement TO ip_app;


--
-- Name: TABLE audit_event; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT ON TABLE public.audit_event TO ip_app;


--
-- Name: TABLE challenge; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge TO ip_app;


--
-- Name: TABLE challenge_participation; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_participation TO ip_app;


--
-- Name: TABLE challenge_prize; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_prize TO ip_app;


--
-- Name: TABLE challenge_schedule_change; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_schedule_change TO ip_app;


--
-- Name: TABLE challenge_sponsor; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_sponsor TO ip_app;


--
-- Name: TABLE challenge_staff_assignment; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_staff_assignment TO ip_app;


--
-- Name: TABLE challenge_staff_invitation; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_staff_invitation TO ip_app;


--
-- Name: TABLE challenge_submission_requirement_version; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.challenge_submission_requirement_version TO ip_app;


--
-- Name: TABLE challenge_team; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_team TO ip_app;


--
-- Name: TABLE challenge_team_member; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_team_member TO ip_app;


--
-- Name: TABLE challenge_terms_version; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_terms_version TO ip_app;


--
-- Name: TABLE challenge_track; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.challenge_track TO ip_app;


--
-- Name: TABLE consent_record; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.consent_record TO ip_app;


--
-- Name: TABLE content_report; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_report TO ip_app;


--
-- Name: TABLE criterion_score; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.criterion_score TO ip_app;


--
-- Name: TABLE data_export; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.data_export TO ip_app;


--
-- Name: TABLE email_delivery; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.email_delivery TO ip_app;


--
-- Name: TABLE email_delivery_attempt; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.email_delivery_attempt TO ip_app;


--
-- Name: TABLE email_suppression; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.email_suppression TO ip_app;


--
-- Name: TABLE faq; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.faq TO ip_app;


--
-- Name: TABLE file_asset; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.file_asset TO ip_app;


--
-- Name: TABLE form_definition; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.form_definition TO ip_app;


--
-- Name: TABLE form_response; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.form_response TO ip_app;


--
-- Name: TABLE form_version; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.form_version TO ip_app;


--
-- Name: TABLE idempotency_record; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.idempotency_record TO ip_app;


--
-- Name: TABLE innovation; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.innovation TO ip_app;


--
-- Name: TABLE innovation_evidence; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.innovation_evidence TO ip_app;


--
-- Name: TABLE innovation_metric; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.innovation_metric TO ip_app;


--
-- Name: TABLE innovation_metric_measurement; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.innovation_metric_measurement TO ip_app;


--
-- Name: TABLE innovation_milestone; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.innovation_milestone TO ip_app;


--
-- Name: TABLE innovation_stage_history; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.innovation_stage_history TO ip_app;


--
-- Name: TABLE integration; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.integration TO ip_app;


--
-- Name: TABLE integration_delivery; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.integration_delivery TO ip_app;


--
-- Name: TABLE integration_delivery_attempt; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.integration_delivery_attempt TO ip_app;


--
-- Name: TABLE judge_assignment; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.judge_assignment TO ip_app;


--
-- Name: TABLE matchmaking_interest; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.matchmaking_interest TO ip_app;


--
-- Name: TABLE matchmaking_post; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.matchmaking_post TO ip_app;


--
-- Name: TABLE media_asset; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.media_asset TO ip_app;


--
-- Name: TABLE notification; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification TO ip_app;


--
-- Name: TABLE notification_preference; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notification_preference TO ip_app;


--
-- Name: TABLE organization; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization TO ip_app;


--
-- Name: TABLE organization_application; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_application TO ip_app;


--
-- Name: TABLE organization_invitation; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_invitation TO ip_app;


--
-- Name: TABLE organization_join_code; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_join_code TO ip_app;


--
-- Name: TABLE organization_join_request; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_join_request TO ip_app;


--
-- Name: TABLE organization_limit; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_limit TO ip_app;


--
-- Name: TABLE organization_membership; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_membership TO ip_app;


--
-- Name: TABLE organization_settings; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_settings TO ip_app;


--
-- Name: TABLE outbox_event; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.outbox_event TO ip_app;


--
-- Name: TABLE platform_role_assignment; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.platform_role_assignment TO ip_app;


--
-- Name: TABLE public_announcement_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_announcement_view TO ip_app;


--
-- Name: TABLE public_challenge_track_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_challenge_track_view TO ip_app;


--
-- Name: TABLE public_challenge_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_challenge_view TO ip_app;


--
-- Name: TABLE public_faq_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_faq_view TO ip_app;


--
-- Name: TABLE public_innovation_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_innovation_view TO ip_app;


--
-- Name: TABLE public_organization_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_organization_view TO ip_app;


--
-- Name: TABLE submission; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.submission TO ip_app;


--
-- Name: TABLE submission_technology; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.submission_technology TO ip_app;


--
-- Name: TABLE submission_version; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.submission_version TO ip_app;


--
-- Name: TABLE public_project_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_project_view TO ip_app;


--
-- Name: TABLE result_snapshot; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.result_snapshot TO ip_app;


--
-- Name: TABLE submission_result; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.submission_result TO ip_app;


--
-- Name: TABLE public_submission_result_view; Type: ACL; Schema: public; Owner: ip_public_views
--

GRANT SELECT ON TABLE public.public_submission_result_view TO ip_app;


--
-- Name: TABLE reminder_schedule; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reminder_schedule TO ip_app;


--
-- Name: TABLE rubric; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.rubric TO ip_app;


--
-- Name: TABLE rubric_criterion; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.rubric_criterion TO ip_app;


--
-- Name: TABLE rubric_version; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.rubric_version TO ip_app;


--
-- Name: TABLE scorecard; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.scorecard TO ip_app;


--
-- Name: TABLE session; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.session TO ip_app;


--
-- Name: TABLE skill; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.skill TO ip_app;


--
-- Name: TABLE stored_object; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stored_object TO ip_app;


--
-- Name: TABLE submission_asset; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.submission_asset TO ip_app;


--
-- Name: TABLE support_ticket; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.support_ticket TO ip_app;


--
-- Name: TABLE support_ticket_comment; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.support_ticket_comment TO ip_app;


--
-- Name: TABLE support_ticket_internal_note; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.support_ticket_internal_note TO ip_app;


--
-- Name: TABLE team_invitation; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.team_invitation TO ip_app;


--
-- Name: TABLE technology_tag; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.technology_tag TO ip_app;


--
-- Name: TABLE two_factor; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.two_factor TO ip_app;


--
-- Name: TABLE "user"; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public."user" TO ip_app;


--
-- Name: TABLE user_profile; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_profile TO ip_app;


--
-- Name: TABLE user_skill; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_skill TO ip_app;


--
-- Name: TABLE verification; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.verification TO ip_app;


--
-- Name: TABLE webhook_event; Type: ACL; Schema: public; Owner: ip_migrator
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.webhook_event TO ip_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: ip_migrator
--

ALTER DEFAULT PRIVILEGES FOR ROLE ip_migrator IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO ip_app;


--
--
-- PostgreSQL database dump complete
--
