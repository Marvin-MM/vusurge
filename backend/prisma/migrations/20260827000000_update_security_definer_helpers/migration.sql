-- Make the authorization SECURITY DEFINER helpers self-sufficient under the
-- single-role architecture.
--
-- Background: every tenant table is created with FORCE ROW LEVEL SECURITY, and
-- since the database consolidated onto a single non-superuser application role
-- (which now OWNS the schema), that role no longer bypasses RLS on its own
-- tables. A SECURITY DEFINER function runs as its owner — the same
-- non-superuser role — so it is ALSO subject to RLS. The original plain-SQL
-- helpers therefore returned zero rows whenever they were invoked from a
-- transaction that carried no tenant context (`withoutTenant`), because the
-- tenant-isolation policies evaluate `organization_id = app_current_organization_id()
-- OR app_platform_access()` and neither was set. That silently broke every
-- authorization lookup that runs before a tenant is known (organization and
-- challenge context resolution, membership/invitation/participation listings,
-- file and media scope resolution, slug availability, etc.).
--
-- Fix: each helper now enables `app.platform_access` for the duration of its
-- own query only, then restores the previous value. The bypass is scoped to
-- the single, parameter-bound statement inside the function — the function
-- already constrains results to the exact resource and caller and returns only
-- authorization fields — so the runtime role never receives a general,
-- transaction-wide RLS bypass. Callers can (and do) use `withoutTenant`, which
-- keeps routine authorization checks out of the platform-access audit path.
--
-- The setting is applied transaction-locally (`set_config(..., true)`), so it
-- cannot leak onto the next request that reuses the pooled connection, and it
-- is restored before the function returns so an enclosing transaction observes
-- no change.

CREATE OR REPLACE FUNCTION public.app_resolve_organization_context(p_organization_id uuid, p_user_id uuid)
 RETURNS TABLE(organization_id uuid, organization_status text, membership_role text, membership_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT o.id, o.status::text, m.role::text, m.status::text
  FROM public.organization o
  LEFT JOIN public.organization_membership m
    ON m.organization_id = o.id AND m.user_id = p_user_id
  WHERE o.id = p_organization_id
  LIMIT 1;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_resolve_challenge_context(p_challenge_id uuid, p_organization_id uuid, p_user_id uuid)
 RETURNS TABLE(challenge_id uuid, organization_id uuid, staff_role text, participation_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
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
  LIMIT 1;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_resolve_file_context(p_file_id uuid, p_user_id uuid)
 RETURNS TABLE(organization_id uuid, challenge_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
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
  LIMIT 1;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_resolve_media_asset_context(p_asset_id uuid, p_actor_user_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, owned_by_actor boolean, purpose "MediaAssetPurpose")
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT m.id, m.organization_id, m.challenge_id,
         m.owner_user_id = p_actor_user_id AS owned_by_actor, m.purpose
  FROM public.media_asset AS m
  WHERE m.id = p_asset_id
    AND EXISTS (
      SELECT 1 FROM public."user" AS u
      WHERE u.id = p_actor_user_id AND u.deleted_at IS NULL
    )
  LIMIT 1;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_resolve_public_media_delivery(p_asset_id uuid)
 RETURNS TABLE(cloudinary_public_id character varying, delivery_type "MediaAssetDeliveryType", format character varying)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
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
  LIMIT 1;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_active_memberships(p_user_id uuid)
 RETURNS TABLE(organization_id uuid, organization_slug character varying, organization_name character varying, membership_role text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT m.organization_id, o.slug, o.name, m.role::text, m.joined_at
  FROM public.organization_membership m
  JOIN public.organization o ON o.id = m.organization_id
  WHERE m.user_id = p_user_id AND m.status = 'ACTIVE'
  ORDER BY m.joined_at DESC;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_challenge_participations(p_user_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, organization_slug character varying, challenge_id uuid, challenge_title character varying, participation_status text, applied_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT cp.id, cp.organization_id, o.slug, cp.challenge_id, c.title,
         cp.status::text, cp.applied_at
  FROM public.challenge_participation cp
  JOIN public.challenge c
    ON c.id = cp.challenge_id AND c.organization_id = cp.organization_id
  JOIN public.organization o ON o.id = cp.organization_id
  WHERE cp.user_id = p_user_id
  ORDER BY cp.applied_at DESC;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_join_requests(p_user_id uuid, p_cursor_at timestamp with time zone, p_cursor_id uuid, p_limit integer)
 RETURNS TABLE(id uuid, organization_id uuid, user_id uuid, request_status text, message character varying, reviewed_by_user_id uuid, reviewed_at timestamp with time zone, decision_reason character varying, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT r.id, r.organization_id, r.user_id, r.status::text, r.message,
         r.reviewed_by_user_id, r.reviewed_at, r.decision_reason, r.created_at
  FROM public.organization_join_request r
  WHERE r.user_id = p_user_id
    AND (p_cursor_at IS NULL OR r.created_at < p_cursor_at
         OR (r.created_at = p_cursor_at AND r.id < p_cursor_id))
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 101);

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_staff_invitations(p_email text)
 RETURNS TABLE(id uuid, organization_id uuid, organization_slug character varying, challenge_id uuid, challenge_title character varying, staff_role text, invitation_status text, expires_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT si.id, si.organization_id, o.slug, si.challenge_id, c.title,
         si.role::text, si.status::text, si.expires_at, si.created_at
  FROM public.challenge_staff_invitation si
  JOIN public.challenge c
    ON c.id = si.challenge_id AND c.organization_id = si.organization_id
  JOIN public.organization o ON o.id = si.organization_id
  WHERE lower(si.email) = lower(p_email)
  ORDER BY si.created_at DESC;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_team_invitations(p_user_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, organization_slug character varying, challenge_id uuid, team_id uuid, team_name character varying, invitation_status text, expires_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT ti.id, ti.organization_id, o.slug, ti.challenge_id, ti.team_id, t.name,
         ti.status::text, ti.expires_at, ti.created_at
  FROM public.team_invitation ti
  JOIN public.challenge_team t
    ON t.id = ti.team_id AND t.organization_id = ti.organization_id
       AND t.challenge_id = ti.challenge_id
  JOIN public.organization o ON o.id = ti.organization_id
  WHERE ti.invited_user_id = p_user_id
  ORDER BY ti.created_at DESC;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_judge_assignments(p_user_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, staff_assignment_id uuid, submission_id uuid, assignment_status text, conflict_declared_at timestamp with time zone, recused_at timestamp with time zone, created_at timestamp with time zone, staff_user_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT ja.id, ja.organization_id, ja.challenge_id, ja.staff_assignment_id,
         ja.submission_id, ja.status::text, ja.conflict_declared_at,
         ja.recused_at, ja.created_at, sa.user_id
  FROM public.judge_assignment ja
  JOIN public.challenge_staff_assignment sa
    ON sa.id = ja.staff_assignment_id AND sa.organization_id = ja.organization_id
       AND sa.challenge_id = ja.challenge_id
  WHERE sa.user_id = p_user_id AND sa.status = 'ACTIVE'
  ORDER BY ja.created_at DESC;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_find_my_judge_assignment(p_assignment_id uuid, p_user_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, staff_assignment_id uuid, submission_id uuid, assignment_status text, conflict_declared_at timestamp with time zone, recused_at timestamp with time zone, created_at timestamp with time zone, staff_user_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
  SELECT ja.id, ja.organization_id, ja.challenge_id, ja.staff_assignment_id,
         ja.submission_id, ja.status::text, ja.conflict_declared_at,
         ja.recused_at, ja.created_at, sa.user_id
  FROM public.judge_assignment ja
  JOIN public.challenge_staff_assignment sa
    ON sa.id = ja.staff_assignment_id AND sa.organization_id = ja.organization_id
       AND sa.challenge_id = ja.challenge_id
  WHERE ja.id = p_assignment_id AND sa.user_id = p_user_id AND sa.status = 'ACTIVE'
  LIMIT 1;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_find_my_scorecard(p_assignment_id uuid, p_user_id uuid)
 RETURNS TABLE(id uuid, organization_id uuid, challenge_id uuid, judge_assignment_id uuid, rubric_version_id uuid, scorecard_status text, total_score integer, max_possible_score integer, submitted_at timestamp with time zone, locked_at timestamp with time zone, reopened_at timestamp with time zone, reopen_reason character varying, created_at timestamp with time zone, staff_user_id uuid, criterion_scores jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  RETURN QUERY
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
  LIMIT 1;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_organization_slug_taken(p_slug text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
  result boolean;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  SELECT EXISTS (SELECT 1 FROM public.organization o WHERE lower(o.slug) = lower(p_slug)) INTO result;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_user_has_organization_membership(p_user_id uuid, p_organization_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
  result boolean;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  SELECT EXISTS (
    SELECT 1 FROM public.organization_membership m
    WHERE m.user_id = p_user_id AND m.organization_id = p_organization_id
  ) INTO result;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_user_shares_organization(p_viewer_id uuid, p_target_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  prev_access text;
  result boolean;
BEGIN
  prev_access := current_setting('app.platform_access', true);
  PERFORM set_config('app.platform_access', 'on', true);

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_membership viewer
    JOIN public.organization_membership target
      ON target.organization_id = viewer.organization_id
    WHERE viewer.user_id = p_viewer_id AND viewer.status = 'ACTIVE'
      AND target.user_id = p_target_id AND target.status = 'ACTIVE'
  ) INTO result;

  PERFORM set_config('app.platform_access', coalesce(prev_access, 'off'), true);
  RETURN result;
END;
$function$;
