import * as React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FileCheck2, Gavel, UserCheck, Users, Megaphone } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/guards/RequireAuth";
import { OrgAdminEntryRedirect } from "@/components/guards/OrgAdminEntryRedirect";
import { ErrorBoundary, NotFoundPage, ForbiddenPage, UnauthorizedPage, OrganizationSuspendedPage, InvitationExpiredPage } from "@/components/feedback/ErrorPages";

// Layout Shells
import { PublicShell } from "@/app/layouts/PublicShell";
import { ParticipantShell } from "@/app/layouts/ParticipantShell";
import { OrganizationAdminShell } from "@/app/layouts/OrganizationAdminShell";
import { JudgeShell } from "@/app/layouts/JudgeShell";
import { PlatformAdminShell } from "@/app/layouts/PlatformAdminShell";

// Public Pages
import { PublicLandingPage } from "@/features/public/pages/PublicLandingPage";
import { PublicChallengesPage } from "@/features/public/pages/PublicChallengesPage";
import { PublicChallengeDetailPage } from "@/features/public/pages/PublicChallengeDetailPage";
import { PublicOrganizationsPage } from "@/features/public/pages/PublicOrganizationsPage";
import { PublicSearchPage } from "@/features/public/pages/PublicSearchPage";
import { PublicOrgDetailPage } from "@/features/public/pages/PublicOrgDetailPage";
import { PublicResultsPage } from "@/features/public/pages/PublicResultsPage";
import { PublicAboutPage } from "@/features/public/pages/PublicAboutPage";
import { PublicHowItWorksPage } from "@/features/public/pages/PublicHowItWorksPage";
import { PublicFAQPage } from "@/features/public/pages/PublicFAQPage";
import { PublicPrivacyPage } from "@/features/public/pages/PublicPrivacyPage";
import { PublicTermsPage } from "@/features/public/pages/PublicTermsPage";
import { PublicAcceptableUsePage } from "@/features/public/pages/PublicAcceptableUsePage";

// Auth & Onboarding Pages
import { SignInPage } from "@/features/public/pages/SignInPage";
import { SignUpPage } from "@/features/public/pages/SignUpPage";
import { VerifyEmailPage } from "@/features/public/pages/VerifyEmailPage";
import { TwoFactorVerifyPage } from "@/features/public/pages/TwoFactorVerifyPage";
import { ForgotPasswordPage } from "@/features/public/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/public/pages/ResetPasswordPage";
import { InvitationLandingPage } from "@/features/public/pages/InvitationLandingPage";
import { JoinCodeRedemptionPage } from "@/features/public/pages/JoinCodeRedemptionPage";

// Participant Pages
import { ParticipantDashboard } from "@/features/participant/pages/ParticipantDashboard";
import { ChallengesExplorePage } from "@/features/challenges/pages/ChallengesExplorePage";
import { ChallengeDetailPage } from "@/features/challenges/pages/ChallengeDetailPage";
import { MyChallengesPage } from "@/features/challenges/pages/MyChallengesPage";
import { TeamsMatchmakingPage } from "@/features/teams/pages/TeamsMatchmakingPage";
import { TeamDetailPage } from "@/features/teams/pages/TeamDetailPage";
import { SubmissionsListPage } from "@/features/submissions/pages/SubmissionsListPage";
import { SubmissionEditorPage } from "@/features/submissions/pages/SubmissionEditorPage";
import { SubmissionDetailPage } from "@/features/submissions/pages/SubmissionDetailPage";
import { OrganizationsExplorePage } from "@/features/organizations/pages/OrganizationsExplorePage";
import { InboxPage } from "@/features/notifications/pages/InboxPage";
import { SupportTicketsPage } from "@/features/participant/pages/SupportTicketsPage";
import { SupportTicketDetailPage } from "@/features/participant/pages/SupportTicketDetailPage";
import { ApplyOrganizationPage } from "@/features/participant/pages/ApplyOrganizationPage";
import { UserProfilePage } from "@/features/participant/pages/UserProfilePage";
import { UserSettingsPage } from "@/features/participant/pages/UserSettingsPage";

// Org Admin Pages
import { OrgDashboard } from "@/features/org-admin/pages/OrgDashboard";
import { OrgChallengesPage } from "@/features/org-admin/pages/OrgChallengesPage";
import { OrgChallengeScopePickerPage } from "@/features/org-admin/pages/OrgChallengeScopePickerPage";
import { OrgChallengeEditorPage } from "@/features/org-admin/pages/OrgChallengeEditorPage";
import { OrgSubmissionsPoolPage } from "@/features/org-admin/pages/OrgSubmissionsPoolPage";
import { OrgJudgingManagementPage } from "@/features/org-admin/pages/OrgJudgingManagementPage";
import { OrgResultsManagementPage } from "@/features/org-admin/pages/OrgResultsManagementPage";
import { OrgParticipantsPage } from "@/features/org-admin/pages/OrgParticipantsPage";
import { OrgTeamsOversightPage } from "@/features/org-admin/pages/OrgTeamsOversightPage";
import { OrgAnnouncementsPage } from "@/features/org-admin/pages/OrgAnnouncementsPage";
import { OrgMembersPage } from "@/features/org-admin/pages/OrgMembersPage";
import { OrgInvitationsPage } from "@/features/org-admin/pages/OrgInvitationsPage";
import { OrgJoinCodesPage } from "@/features/org-admin/pages/OrgJoinCodesPage";
import { OrgJoinRequestsPage } from "@/features/org-admin/pages/OrgJoinRequestsPage";
import { OrgPortfolioPage } from "@/features/org-admin/pages/OrgPortfolioPage";
import { OrgPortfolioDetailPage } from "@/features/org-admin/pages/OrgPortfolioDetailPage";
import { OrgFormsPage } from "@/features/org-admin/pages/OrgFormsPage";
import { OrgFormDetailPage } from "@/features/org-admin/pages/OrgFormDetailPage";
import { OrgExportsPage } from "@/features/org-admin/pages/OrgExportsPage";
import { OrgIntegrationsPage } from "@/features/org-admin/pages/OrgIntegrationsPage";
import { OrgAnalyticsPage } from "@/features/org-admin/pages/OrgAnalyticsPage";
import { OrgAuditPage } from "@/features/org-admin/pages/OrgAuditPage";
import { OrgSettingsPage } from "@/features/org-admin/pages/OrgSettingsPage";

// Judge Pages
import { JudgeDashboard } from "@/features/judging/pages/JudgeDashboard";
import { JudgeEvaluationPage } from "@/features/judging/pages/JudgeEvaluationPage";

// Superadmin Pages
import { AdminDashboard } from "@/features/superadmin/pages/AdminDashboard";
import { AdminOrganizationsPage } from "@/features/superadmin/pages/AdminOrganizationsPage";
import { AdminChallengesPage } from "@/features/superadmin/pages/AdminChallengesPage";
import { AdminModerationPage } from "@/features/superadmin/pages/AdminModerationPage";
import { AdminSupportPage } from "@/features/superadmin/pages/AdminSupportPage";
import { AdminHealthPage } from "@/features/superadmin/pages/AdminHealthPage";
import { AdminAuditLogsPage } from "@/features/superadmin/pages/AdminAuditLogsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <BrowserRouter>
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
                <Route path="auth/signin" element={<SignInPage />} />
                <Route path="auth/signup" element={<SignUpPage />} />
                <Route path="auth/verify-email" element={<VerifyEmailPage />} />
                <Route path="auth/verify-2fa" element={<TwoFactorVerifyPage />} />
                <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="auth/reset-password" element={<ResetPasswordPage />} />
                <Route path="invitations/:token" element={<InvitationLandingPage />} />
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
                {/* Results are public content by construction — reuse the
                    real public results page rather than a separate
                    authenticated duplicate. */}
                <Route path="results" element={<Navigate to="/results" replace />} />
                <Route path="support" element={<SupportTicketsPage />} />
                <Route path="support/:ticketId" element={<SupportTicketDetailPage />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="profile" element={<UserProfilePage />} />
                <Route path="settings" element={<UserSettingsPage />} />
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
                <Route path="challenges/:challengeId/judging" element={<OrgJudgingManagementPage />} />
                <Route path="challenges/:challengeId/results" element={<OrgResultsManagementPage />} />
                <Route path="challenges/:challengeId/submissions" element={<OrgSubmissionsPoolPage />} />
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
                <Route path="members" element={<OrgMembersPage />} />
                <Route path="invitations" element={<OrgInvitationsPage />} />
                <Route path="join-codes" element={<OrgJoinCodesPage />} />
                <Route path="join-requests" element={<OrgJoinRequestsPage />} />
                <Route path="portfolio" element={<OrgPortfolioPage />} />
                <Route path="portfolio/:itemId" element={<OrgPortfolioDetailPage />} />
                <Route path="forms" element={<OrgFormsPage />} />
                <Route path="forms/:formId" element={<OrgFormDetailPage />} />
                <Route path="analytics" element={<OrgAnalyticsPage />} />
                <Route path="exports" element={<OrgExportsPage />} />
                <Route path="integrations" element={<OrgIntegrationsPage />} />
                <Route path="audit" element={<OrgAuditPage />} />
                <Route path="settings" element={<OrgSettingsPage />} />
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
                {/* No real platform settings/feature-flag/user-directory/analytics endpoints exist server-side */}
                <Route path="users" element={<Navigate to="/admin" replace />} />
                <Route path="analytics" element={<Navigate to="/admin" replace />} />
                <Route path="platform-settings" element={<Navigate to="/admin" replace />} />
                <Route path="settings" element={<Navigate to="/admin" replace />} />
              </Route>

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  );
}
