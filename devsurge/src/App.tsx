import * as React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FileCheck2, Gavel, UserCheck, Users, Megaphone } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/guards/RequireAuth";
import { PublicOnlyRoute } from "@/components/guards/PublicOnlyRoute";
import { OrgAdminEntryRedirect } from "@/components/guards/OrgAdminEntryRedirect";
import { ErrorBoundary, NotFoundPage, ForbiddenPage, UnauthorizedPage, OrganizationSuspendedPage, InvitationExpiredPage } from "@/components/feedback/ErrorPages";

// Layout Shells
import { PublicShell } from "@/app/layouts/PublicShell";
import { ParticipantShell } from "@/app/layouts/ParticipantShell";
import { OrganizationAdminShell } from "@/app/layouts/OrganizationAdminShell";
import { JudgeShell } from "@/app/layouts/JudgeShell";
import { PlatformAdminShell } from "@/app/layouts/PlatformAdminShell";

import { RoleInvitationLandingPage } from "@/features/public/pages/RoleInvitationLandingPage";
import {
  OrgAccessSectionLayout,
  OrgInsightsSectionLayout,
  OrgGovernanceSectionLayout,
  OrgEvaluationSectionLayout,
  ParticipantMessagesSectionLayout,
  ParticipantAccountSectionLayout,
} from "@/app/layouts/sections";
import { OrgChallengeScopePickerPage } from "@/features/org-admin/pages/OrgChallengeScopePickerPage";

// Portal workspaces are route-loaded. Most users enter only one of these
// portals, so shipping every organizer, judge, and platform-admin screen in
// the public/participant entry bundle wastes bandwidth and parse time.
const lazyNamed = (loader: () => Promise<Record<string, unknown>>, exportName: string) =>
  React.lazy(async () => {
    const component = (await loader())[exportName];
    if (typeof component !== "function") {
      throw new Error(`Lazy route export "${exportName}" is not a React component.`);
    }
    return { default: component as React.ComponentType };
  });

const PublicLandingPage = lazyNamed(() => import("@/features/public/pages/PublicLandingPage"), "PublicLandingPage");
const PublicChallengesPage = lazyNamed(() => import("@/features/public/pages/PublicChallengesPage"), "PublicChallengesPage");
const PublicChallengeDetailPage = lazyNamed(() => import("@/features/public/pages/PublicChallengeDetailPage"), "PublicChallengeDetailPage");
const PublicOrganizationsPage = lazyNamed(() => import("@/features/public/pages/PublicOrganizationsPage"), "PublicOrganizationsPage");
const PublicSearchPage = lazyNamed(() => import("@/features/public/pages/PublicSearchPage"), "PublicSearchPage");
const PublicOrgDetailPage = lazyNamed(() => import("@/features/public/pages/PublicOrgDetailPage"), "PublicOrgDetailPage");
const PublicResultsPage = lazyNamed(() => import("@/features/public/pages/PublicResultsPage"), "PublicResultsPage");
const PublicAboutPage = lazyNamed(() => import("@/features/public/pages/PublicAboutPage"), "PublicAboutPage");
const PublicHowItWorksPage = lazyNamed(() => import("@/features/public/pages/PublicHowItWorksPage"), "PublicHowItWorksPage");
const PublicFAQPage = lazyNamed(() => import("@/features/public/pages/PublicFAQPage"), "PublicFAQPage");
const PublicPrivacyPage = lazyNamed(() => import("@/features/public/pages/PublicPrivacyPage"), "PublicPrivacyPage");
const PublicTermsPage = lazyNamed(() => import("@/features/public/pages/PublicTermsPage"), "PublicTermsPage");
const PublicAcceptableUsePage = lazyNamed(() => import("@/features/public/pages/PublicAcceptableUsePage"), "PublicAcceptableUsePage");
const SignInPage = lazyNamed(() => import("@/features/public/pages/SignInPage"), "SignInPage");
const SignUpPage = lazyNamed(() => import("@/features/public/pages/SignUpPage"), "SignUpPage");
const VerifyEmailPage = lazyNamed(() => import("@/features/public/pages/VerifyEmailPage"), "VerifyEmailPage");
const TwoFactorVerifyPage = lazyNamed(() => import("@/features/public/pages/TwoFactorVerifyPage"), "TwoFactorVerifyPage");
const ForgotPasswordPage = lazyNamed(() => import("@/features/public/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyNamed(() => import("@/features/public/pages/ResetPasswordPage"), "ResetPasswordPage");
const InvitationLandingPage = lazyNamed(() => import("@/features/public/pages/InvitationLandingPage"), "InvitationLandingPage");
const JoinCodeRedemptionPage = lazyNamed(() => import("@/features/public/pages/JoinCodeRedemptionPage"), "JoinCodeRedemptionPage");

const ParticipantDashboard = lazyNamed(() => import("@/features/participant/pages/ParticipantDashboard"), "ParticipantDashboard");
const ChallengesExplorePage = lazyNamed(() => import("@/features/challenges/pages/ChallengesExplorePage"), "ChallengesExplorePage");
const ChallengeDetailPage = lazyNamed(() => import("@/features/challenges/pages/ChallengeDetailPage"), "ChallengeDetailPage");
const MyChallengesPage = lazyNamed(() => import("@/features/challenges/pages/MyChallengesPage"), "MyChallengesPage");
const ParticipantResultsPage = lazyNamed(() => import("@/features/participant/pages/ParticipantResultsPage"), "ParticipantResultsPage");
const TeamsMatchmakingPage = lazyNamed(() => import("@/features/teams/pages/TeamsMatchmakingPage"), "TeamsMatchmakingPage");
const TeamDetailPage = lazyNamed(() => import("@/features/teams/pages/TeamDetailPage"), "TeamDetailPage");
const SubmissionsListPage = lazyNamed(() => import("@/features/submissions/pages/SubmissionsListPage"), "SubmissionsListPage");
const SubmissionEditorPage = lazyNamed(() => import("@/features/submissions/pages/SubmissionEditorPage"), "SubmissionEditorPage");
const SubmissionDetailPage = lazyNamed(() => import("@/features/submissions/pages/SubmissionDetailPage"), "SubmissionDetailPage");
const OrganizationsExplorePage = lazyNamed(() => import("@/features/organizations/pages/OrganizationsExplorePage"), "OrganizationsExplorePage");
const InboxPage = lazyNamed(() => import("@/features/notifications/pages/InboxPage"), "InboxPage");
const SupportTicketsPage = lazyNamed(() => import("@/features/participant/pages/SupportTicketsPage"), "SupportTicketsPage");
const SupportTicketDetailPage = lazyNamed(() => import("@/features/participant/pages/SupportTicketDetailPage"), "SupportTicketDetailPage");
const ApplyOrganizationPage = lazyNamed(() => import("@/features/participant/pages/ApplyOrganizationPage"), "ApplyOrganizationPage");
const UserProfilePage = lazyNamed(() => import("@/features/participant/pages/UserProfilePage"), "UserProfilePage");
const UserSettingsPage = lazyNamed(() => import("@/features/participant/pages/UserSettingsPage"), "UserSettingsPage");

const OrgDashboard = lazyNamed(() => import("@/features/org-admin/pages/OrgDashboard"), "OrgDashboard");
const OrgChallengesPage = lazyNamed(() => import("@/features/org-admin/pages/OrgChallengesPage"), "OrgChallengesPage");
const OrgChallengeEditorPage = lazyNamed(() => import("@/features/org-admin/pages/OrgChallengeEditorPage"), "OrgChallengeEditorPage");
const OrgSubmissionsPoolPage = lazyNamed(() => import("@/features/org-admin/pages/OrgSubmissionsPoolPage"), "OrgSubmissionsPoolPage");
const OrgJudgingManagementPage = lazyNamed(() => import("@/features/org-admin/pages/OrgJudgingManagementPage"), "OrgJudgingManagementPage");
const OrgResultsManagementPage = lazyNamed(() => import("@/features/org-admin/pages/OrgResultsManagementPage"), "OrgResultsManagementPage");
const OrgParticipantsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgParticipantsPage"), "OrgParticipantsPage");
const OrgTeamsOversightPage = lazyNamed(() => import("@/features/org-admin/pages/OrgTeamsOversightPage"), "OrgTeamsOversightPage");
const OrgAnnouncementsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgAnnouncementsPage"), "OrgAnnouncementsPage");
const OrgMembersPage = lazyNamed(() => import("@/features/org-admin/pages/OrgMembersPage"), "OrgMembersPage");
const OrgInvitationsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgInvitationsPage"), "OrgInvitationsPage");
const OrgJoinCodesPage = lazyNamed(() => import("@/features/org-admin/pages/OrgJoinCodesPage"), "OrgJoinCodesPage");
const OrgJoinRequestsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgJoinRequestsPage"), "OrgJoinRequestsPage");
const OrgPortfolioPage = lazyNamed(() => import("@/features/org-admin/pages/OrgPortfolioPage"), "OrgPortfolioPage");
const OrgPortfolioDetailPage = lazyNamed(() => import("@/features/org-admin/pages/OrgPortfolioDetailPage"), "OrgPortfolioDetailPage");
const OrgFormsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgFormsPage"), "OrgFormsPage");
const OrgFormDetailPage = lazyNamed(() => import("@/features/org-admin/pages/OrgFormDetailPage"), "OrgFormDetailPage");
const OrgExportsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgExportsPage"), "OrgExportsPage");
const OrgIntegrationsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgIntegrationsPage"), "OrgIntegrationsPage");
const OrgAnalyticsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgAnalyticsPage"), "OrgAnalyticsPage");
const OrgAuditPage = lazyNamed(() => import("@/features/org-admin/pages/OrgAuditPage"), "OrgAuditPage");
const OrgSettingsPage = lazyNamed(() => import("@/features/org-admin/pages/OrgSettingsPage"), "OrgSettingsPage");

const JudgeDashboard = lazyNamed(() => import("@/features/judging/pages/JudgeDashboard"), "JudgeDashboard");
const JudgeEvaluationPage = lazyNamed(() => import("@/features/judging/pages/JudgeEvaluationPage"), "JudgeEvaluationPage");

const AdminDashboard = lazyNamed(() => import("@/features/superadmin/pages/AdminDashboard"), "AdminDashboard");
const AdminOrganizationsPage = lazyNamed(() => import("@/features/superadmin/pages/AdminOrganizationsPage"), "AdminOrganizationsPage");
const AdminChallengesPage = lazyNamed(() => import("@/features/superadmin/pages/AdminChallengesPage"), "AdminChallengesPage");
const AdminModerationPage = lazyNamed(() => import("@/features/superadmin/pages/AdminModerationPage"), "AdminModerationPage");
const AdminSupportPage = lazyNamed(() => import("@/features/superadmin/pages/AdminSupportPage"), "AdminSupportPage");
const AdminHealthPage = lazyNamed(() => import("@/features/superadmin/pages/AdminHealthPage"), "AdminHealthPage");
const AdminAuditLogsPage = lazyNamed(() => import("@/features/superadmin/pages/AdminAuditLogsPage"), "AdminAuditLogsPage");
const AdminUsersPage = lazyNamed(() => import("@/features/superadmin/pages/AdminUsersPage"), "AdminUsersPage");
const AdminAnalyticsPage = lazyNamed(() => import("@/features/superadmin/pages/AdminAnalyticsPage"), "AdminAnalyticsPage");
const AdminPlatformSettingsPage = lazyNamed(() => import("@/features/superadmin/pages/AdminPlatformSettingsPage"), "AdminPlatformSettingsPage");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays authoritative for five minutes, so moving between pages
      // inside the app serves from cache instead of refetching. (Verified:
      // a client-side return visit issues zero requests. A full browser
      // reload necessarily refetches — the cache lives in the JS heap.)
      staleTime: 1000 * 60 * 5,
      // Outlive staleTime so a page revisited after its data went stale still
      // paints instantly from cache while it revalidates in the background,
      // rather than dropping to a spinner. With the default 5 minutes the
      // entry was evicted at the exact moment it became stale.
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      // Retrying a 4xx cannot succeed — the request was refused, not dropped.
      // It only doubles the latency the user waits through and doubles the
      // browser's console noise. 408/429 are the exceptions: both explicitly
      // mean "try again". Everything else (network/5xx) keeps one retry.
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status !== undefined && status >= 400 && status < 500) {
          return status === 408 || status === 429 ? failureCount < 1 : false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      // A mutation is not idempotent unless the endpoint says so (several
      // require an explicit Idempotency-Key); never replay one automatically.
      retry: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <React.Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading workspace...</div>}>
              <Routes>
              {/* Public Experience Routes */}
              <Route path="/" element={<PublicShell />}>
                <Route index element={<PublicLandingPage />} />
                
                {/* Direct clean public routes */}
                <Route path="challenges" element={<PublicChallengesPage />} />
                {/* Challenge slugs are unique per-organization, not
                    platform-wide (backend: @@unique([organizationId, slug])) —
                    the org slug must be part of the path, not just the
                    challenge slug, or two different orgs' challenges with
                    the same slug would collide. */}
                <Route path="challenges/:organizationSlug/:challengeSlug" element={<PublicChallengeDetailPage />} />
                <Route path="organizations" element={<PublicOrganizationsPage />} />
                <Route path="search" element={<PublicSearchPage />} />
                <Route path="organizations/:organizationSlug" element={<PublicOrgDetailPage />} />
                {/* No cross-organization public innovations endpoint exists
                    on the backend — only a per-organization one
                    (`/public/organizations/:slug/innovations`), already
                    surfaced on each org's profile page. Redirect rather than
                    dead-end a bookmarked/shared link. */}
                <Route path="innovations" element={<Navigate to="/organizations" replace />} />
                <Route path="results" element={<PublicResultsPage />} />
                <Route path="about" element={<PublicAboutPage />} />
                <Route path="how-it-works" element={<PublicHowItWorksPage />} />
                <Route path="faq" element={<PublicFAQPage />} />
                <Route path="privacy" element={<PublicPrivacyPage />} />
                <Route path="terms" element={<PublicTermsPage />} />
                <Route path="acceptable-use" element={<PublicAcceptableUsePage />} />

                {/* Backwards compatibility for /public/* prefixed links */}
                <Route path="public/challenges" element={<PublicChallengesPage />} />
                <Route path="public/challenges/:organizationSlug/:challengeSlug" element={<PublicChallengeDetailPage />} />
                <Route path="public/organizations" element={<PublicOrganizationsPage />} />
                <Route path="public/organizations/:organizationSlug" element={<PublicOrgDetailPage />} />
                <Route path="public/innovations" element={<Navigate to="/organizations" replace />} />
                <Route path="public/results" element={<PublicResultsPage />} />
                <Route path="public/about" element={<PublicAboutPage />} />

                {/* Authentication & Onboarding Routes */}
                <Route path="auth/signin" element={<PublicOnlyRoute><SignInPage /></PublicOnlyRoute>} />
                <Route path="auth/signup" element={<PublicOnlyRoute><SignUpPage /></PublicOnlyRoute>} />
                <Route path="auth/verify-email" element={<VerifyEmailPage />} />
                <Route path="auth/verify-2fa" element={<TwoFactorVerifyPage />} />
                <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="auth/reset-password" element={<ResetPasswordPage />} />
                <Route path="invitations/:token" element={<InvitationLandingPage />} />
                <Route path="invitations/:token/accept" element={<InvitationLandingPage />} />
                <Route path="team-invitations/:token/accept" element={<RoleInvitationLandingPage kind="team" />} />
                <Route path="challenge-staff-invitations/:token/accept" element={<RoleInvitationLandingPage kind="staff" />} />
                {/* No standalone "onboarding wizard" concept on the
                    backend — profile setup, join-code redemption, and
                    invitation acceptance are already independent real
                    flows (see /app/profile, below, and /invitations/:token). */}
                <Route path="onboarding" element={<Navigate to="/app" replace />} />
                <Route path="onboarding/join-code" element={<JoinCodeRedemptionPage />} />
                {/* Organization applications require authentication on the
                    backend (every /organization-applications/* route is
                    requireAuth: true) — there is no meaningful anonymous
                    version of this flow. This used to be a full duplicate
                    page here that re-implemented its own "sign in first"
                    prompt; consolidated onto the one real authenticated page
                    at /app/apply-organization, whose own RequireAuth wrapper
                    already redirects to sign-in (with returnTo) for free. */}
                <Route path="onboarding/organization-application" element={<Navigate to="/app/apply-organization" replace />} />

                {/* Direct Error Landing States */}
                <Route path="forbidden" element={<ForbiddenPage />} />
                <Route path="unauthorized" element={<UnauthorizedPage />} />
                <Route path="suspended" element={<OrganizationSuspendedPage />} />
                <Route path="invitation-expired" element={<InvitationExpiredPage />} />
              </Route>

              {/* Quick Route Aliases */}
              <Route path="/dashboard" element={<Navigate to="/app" replace />} />
              <Route path="/org-admin" element={<OrgAdminEntryRedirect />} />
              <Route path="/admin/audit" element={<Navigate to="/admin/audit-logs" replace />} />

              {/* Participant Portal Routes */}
              <Route path="/app" element={<RequireAuth><ParticipantShell /></RequireAuth>}>
                <Route index element={<ParticipantDashboard />} />
                <Route path="challenges" element={<ChallengesExplorePage />} />
                {/* Authenticated org-scoped endpoints need the
                    organization's UUID, not its slug — the page resolves
                    :organizationSlug -> id once via usePublicOrganization
                    (the same slug already available from every source that
                    links here: MyParticipationSummary, the public challenge
                    feed, etc). challengeId is already a UUID everywhere. */}
                <Route path="challenges/:organizationSlug/:challengeId" element={<ChallengeDetailPage />} />
                <Route path="my-challenges" element={<MyChallengesPage />} />
                <Route path="teams" element={<TeamsMatchmakingPage />} />
                <Route path="teams/:teamId" element={<TeamDetailPage />} />
                <Route path="submissions" element={<SubmissionsListPage />} />
                <Route path="submissions/new" element={<SubmissionEditorPage />} />
                <Route path="submissions/:submissionId" element={<SubmissionDetailPage />} />
                <Route path="submissions/:submissionId/edit" element={<SubmissionEditorPage />} />
                <Route path="organizations" element={<OrganizationsExplorePage />} />
                <Route path="invitations" element={<InvitationLandingPage />} />
                <Route path="apply-organization" element={<ApplyOrganizationPage />} />
                <Route path="results" element={<ParticipantResultsPage />} />
                {/* Inbox and Support Desk are both "messages addressed to
                    me"; profile and settings are both "my account". Grouped
                    behind one nav entry each, with their routes preserved. */}
                <Route element={<ParticipantMessagesSectionLayout />}>
                  <Route path="inbox" element={<InboxPage />} />
                  <Route path="support" element={<SupportTicketsPage />} />
                </Route>
                <Route path="support/:ticketId" element={<SupportTicketDetailPage />} />
                <Route element={<ParticipantAccountSectionLayout />}>
                  <Route path="profile" element={<UserProfilePage />} />
                  <Route path="settings" element={<UserSettingsPage />} />
                </Route>
              </Route>

              {/* Organization Admin Routes */}
              <Route path="/org/:orgId" element={<RequireAuth><OrganizationAdminShell /></RequireAuth>}>
                <Route index element={<OrgDashboard />} />
                <Route path="challenges" element={<OrgChallengesPage />} />
                <Route path="challenges/new" element={<OrgChallengeEditorPage />} />
                <Route path="challenges/:challengeId/edit" element={<OrgChallengeEditorPage />} />
                <Route path="challenges/:challengeId/participants" element={<OrgParticipantsPage />} />
                <Route path="challenges/:challengeId/teams" element={<OrgTeamsOversightPage />} />
                <Route path="challenges/:challengeId/announcements" element={<OrgAnnouncementsPage />} />
                {/* Submissions pool, judging setup, and results are three
                    stages of one evaluation workflow on the same challenge —
                    grouped so an organizer moves between them without
                    returning to the challenge list each time. */}
                <Route element={<OrgEvaluationSectionLayout />}>
                  <Route path="challenges/:challengeId/submissions" element={<OrgSubmissionsPoolPage />} />
                  <Route path="challenges/:challengeId/judging" element={<OrgJudgingManagementPage />} />
                  <Route path="challenges/:challengeId/results" element={<OrgResultsManagementPage />} />
                </Route>
                {/* Submissions/judging/participants/teams/announcements are
                    always challenge-scoped on the backend — there is no
                    org-wide resource for any of them. These bare
                    (challenge-less) routes are what the sidebar nav and
                    OrgDashboard's "Operational Workspaces" panel link to;
                    OrgChallengeScopePickerPage resolves the ambiguity by
                    auto-continuing when there's exactly one challenge, or
                    showing a picker when there's more than one — previously
                    this silently bounced straight back to the Challenges
                    list, making those nav items dead clicks. */}
                <Route
                  path="submissions"
                  element={
                    <OrgChallengeScopePickerPage
                      destination="submissions"
                      title="Submissions Pool"
                      description="Review project submissions for a challenge."
                      icon={FileCheck2}
                      permission="submission.view_all"
                    />
                  }
                />
                <Route
                  path="judging"
                  element={
                    <OrgChallengeScopePickerPage
                      destination="judging"
                      title="Judging & Rubrics"
                      description="Manage rubrics, judge assignments, and scoring progress for a challenge."
                      icon={Gavel}
                      permission="challenge.manage_judges"
                    />
                  }
                />
                <Route
                  path="participants"
                  element={
                    <OrgChallengeScopePickerPage
                      destination="participants"
                      title="Participant Screening"
                      description="Review and approve challenge applicants."
                      icon={UserCheck}
                      permission="challenge.manage_participants"
                    />
                  }
                />
                <Route
                  path="teams"
                  element={
                    <OrgChallengeScopePickerPage
                      destination="teams"
                      title="Team Oversight"
                      description="View team rosters for a challenge."
                      icon={Users}
                      permission="challenge.manage_teams"
                    />
                  }
                />
                <Route
                  path="announcements"
                  element={
                    <OrgChallengeScopePickerPage
                      destination="announcements"
                      title="Announcements"
                      description="Manage announcements and FAQs for a challenge."
                      icon={Megaphone}
                      permission="organization.manage_announcements"
                    />
                  }
                />
                {/* Related admin surfaces are grouped behind one nav entry
                    with in-page tabs. Each keeps its own route, URL, and
                    permission guard, so existing links and deep links are
                    unaffected and a tab the viewer cannot use is not shown. */}
                <Route element={<OrgAccessSectionLayout />}>
                  <Route path="members" element={<OrgMembersPage />} />
                  <Route path="invitations" element={<OrgInvitationsPage />} />
                  <Route path="join-codes" element={<OrgJoinCodesPage />} />
                  <Route path="join-requests" element={<OrgJoinRequestsPage />} />
                </Route>
                <Route path="portfolio" element={<OrgPortfolioPage />} />
                <Route path="portfolio/:itemId" element={<OrgPortfolioDetailPage />} />
                <Route path="forms" element={<OrgFormsPage />} />
                <Route path="forms/:formId" element={<OrgFormDetailPage />} />
                <Route element={<OrgInsightsSectionLayout />}>
                  <Route path="analytics" element={<OrgAnalyticsPage />} />
                  <Route path="exports" element={<OrgExportsPage />} />
                </Route>
                <Route path="integrations" element={<OrgIntegrationsPage />} />
                <Route element={<OrgGovernanceSectionLayout />}>
                  <Route path="settings" element={<OrgSettingsPage />} />
                  <Route path="audit" element={<OrgAuditPage />} />
                </Route>
              </Route>

              {/* Judge Suite Routes */}
              <Route path="/judge" element={<RequireAuth><JudgeShell /></RequireAuth>}>
                <Route index element={<JudgeDashboard />} />
                <Route path="assignments/:assignmentId" element={<JudgeEvaluationPage />} />
              </Route>

              {/* Platform Superadmin Routes */}
              <Route path="/admin" element={<RequireAuth><PlatformAdminShell /></RequireAuth>}>
                <Route index element={<AdminDashboard />} />
                <Route path="organizations" element={<AdminOrganizationsPage />} />
                <Route path="organization-applications" element={<AdminOrganizationsPage />} />
                <Route path="organization-applications/:applicationId" element={<AdminOrganizationsPage />} />
                <Route path="moderation" element={<AdminModerationPage />} />
                <Route path="moderation/:reportId" element={<AdminModerationPage />} />
                <Route path="support" element={<AdminSupportPage />} />
                <Route path="support/:ticketId" element={<AdminSupportPage />} />
                <Route path="challenges" element={<AdminChallengesPage />} />
                <Route path="health" element={<AdminHealthPage />} />
                <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="platform-settings" element={<AdminPlatformSettingsPage />} />
                <Route path="settings" element={<Navigate to="/admin/platform-settings" replace />} />
              </Route>

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </React.Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}
