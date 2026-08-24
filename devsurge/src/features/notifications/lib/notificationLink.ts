/**
 * Notification `linkUrl` values are produced by the backend's worker handlers
 * and point at **API resource paths** (`/organizations/:id/challenges/:id/...`)
 * or, for support tickets, an absolute URL built from `WEB_APP_BASE_URL`.
 * Neither shape is a real client route — navigating to one directly lands on
 * the 404 page. This maps the shapes the backend actually emits onto the
 * routes this app actually has.
 *
 * Every producer is accounted for (grep `linkUrl:` under
 * `backend/src/workers/handlers/`): judging progress, portfolio reminders,
 * challenge deadline reminders, team invitations, submission events, and
 * support-ticket updates. Anything unrecognized returns `null` so the caller
 * renders no navigation affordance rather than a link that 404s.
 */
import type { Permission } from "@/types/permissions";

export interface NotificationRoute {
  path: string;
  /**
   * Permission the destination requires, when it is an organization-portal
   * route. A notification can outlive the role that made it actionable (a
   * demoted admin, a member who was never staff), so the caller must check
   * this before offering navigation — otherwise the reader is handed a link
   * straight to a "Restricted" screen.
   */
  permission?: Permission;
}

export function resolveNotificationRoute(linkUrl: string | null): NotificationRoute | null {
  if (!linkUrl) return null;

  // Support-ticket notifications carry an absolute URL (webAppBaseUrl + path).
  // Reduce it to a path; ignore anything pointing at a different origin.
  let path = linkUrl;
  if (/^https?:\/\//i.test(linkUrl)) {
    try {
      const parsed = new URL(linkUrl);
      if (parsed.origin !== window.location.origin) return null;
      path = parsed.pathname;
    } catch {
      return null;
    }
  }

  // Invitation actions are already real client routes and contain the
  // one-time token required by their backend accept/decline endpoints.
  if (
    /^\/invitations\/[^/]+(?:\/accept)?$/.test(path) ||
    /^\/team-invitations\/[^/]+\/accept$/.test(path) ||
    /^\/challenge-staff-invitations\/[^/]+\/accept$/.test(path)
  ) {
    return { path };
  }

  if (path === "/judge" || path === "/app/my-challenges" || path === "/app/results") return { path };

  // New support emails use the real frontend path. Keep the legacy mapping
  // below for notifications created before this fix.
  if (/^\/app\/support\/[^/]+$/.test(path)) return { path };

  // /support/tickets/:ticketId  ->  /app/support/:ticketId
  const support = path.match(/^\/support\/tickets\/([^/]+)$/);
  if (support) return { path: `/app/support/${support[1]}` };

  // Everything else the backend emits is /organizations/:organizationId/...
  const org = path.match(/^\/organizations\/([^/]+)\/(.*)$/);
  if (!org) return null;
  const [, organizationId, rest] = org;

  // .../challenges/:challengeId/judging/progress -> org-admin judging view
  const judging = rest.match(/^challenges\/([^/]+)\/judging(?:\/progress)?$/);
  if (judging) {
    return {
      path: `/org/${organizationId}/challenges/${judging[1]}/judging`,
      permission: "challenge.manage_judges",
    };
  }

  // .../challenges/:challengeId/teams/:teamId -> participant team detail
  // (the team page resolves its own org/challenge context from the query).
  const team = rest.match(/^challenges\/([^/]+)\/teams\/([^/]+)$/);
  if (team) {
    return {
      path: `/app/teams/${team[2]}?organizationId=${organizationId}&challengeId=${team[1]}`,
    };
  }

  // .../challenges/:challengeId/submission -> the caller's own submissions.
  // There is no per-challenge "my submission" route; the list is the closest
  // real destination and is scoped to the caller anyway.
  if (/^challenges\/([^/]+)\/submission$/.test(rest)) return { path: "/app/submissions" };

  // .../innovations/:innovationId -> org-admin portfolio detail
  const innovation = rest.match(/^innovations\/([^/]+)$/);
  if (innovation) {
    return {
      path: `/org/${organizationId}/portfolio/${innovation[1]}`,
      permission: "innovation.view",
    };
  }

  // .../challenges/:challengeId -> the participant-facing challenge workspace.
  // That route is keyed by organization *slug*, which a notification does not
  // carry, so send the reader to their challenge list instead of guessing.
  if (/^challenges\/([^/]+)$/.test(rest)) return { path: "/app/my-challenges" };

  return null;
}
