# DevArena — Complete Route Manifest

This manifest documents all navigable routes in DevArena across public discovery, participant workflows, judge evaluations, organization management, and platform governance.

---

## 1. Public & Marketing Surface

| Path | Layout Shell | Component / Description |
| :--- | :--- | :--- |
| `/` | `PublicShell` | `PublicLandingPage` — Hero, featured competitions, stats, and trust signals. |
| `/challenges` | `PublicShell` | `PublicChallengesPage` — Filterable catalog of public challenges. |
| `/challenges/:slug` | `PublicShell` | `PublicChallengeDetailPage` — Public challenge overview, timeline, prizes, and tracks. |
| `/organizations` | `PublicShell` | `PublicOrganizationsPage` — Directory of host enterprises and labs. |
| `/organizations/:slug` | `PublicShell` | `PublicOrgDetailPage` — Public organization profile, active challenges, and portfolio. |
| `/innovations` | `PublicShell` | `PublicInnovationsPage` — Innovation portfolio showcase gallery. |
| `/innovations/:id` | `PublicShell` | `PublicInnovationDetailPage` — Detailed case study of an awarded solution. |
| `/results` | `PublicShell` | `PublicResultsPage` — Official winner podium and prize recipients. |
| `/about` | `PublicShell` | `PublicAboutPage` — Platform mission, architecture, and team. |
| `/how-it-works` | `PublicShell` | `PublicHowItWorksPage` — Participant, judge, and host lifecycle guide. |
| `/faq` | `PublicShell` | `PublicFAQPage` — Categorized interactive FAQ accordion. |
| `/partners` | `PublicShell` | `PublicPartnersPage` — Ecosystem sponsors, API providers, and venture funds. |
| `/privacy` | `PublicShell` | `PublicPrivacyPage` — Data privacy policy and GDPR compliance notice. |
| `/terms` | `PublicShell` | `PublicTermsPage` — Platform terms of service. |
| `/acceptable-use` | `PublicShell` | `PublicAcceptableUsePage` — Code of conduct, rules of engagement, and anti-plagiarism guidelines. |

---

## 2. Authentication & Onboarding

| Path | Layout Shell | Component / Description |
| :--- | :--- | :--- |
| `/auth/signin` | `PublicShell` | `SignInPage` — Email/password sign-in and quick demo persona credentials. |
| `/auth/signup` | `PublicShell` | `SignUpPage` — User account registration with validation. |
| `/auth/verify-email` | `PublicShell` | `VerifyEmailPage` — Email verification confirmation view. |
| `/auth/forgot-password` | `PublicShell` | `ForgotPasswordPage` — Password reset request dispatch. |
| `/auth/reset-password` | `PublicShell` | `ResetPasswordPage` — Password change confirmation. |
| `/invitations/:token` | `PublicShell` | `InvitationLandingPage` — Organization & challenge invite acceptance. |
| `/onboarding` | `PublicShell` | `OnboardingPage` — Persona selection and onboarding wizard. |
| `/onboarding/join-code` | `PublicShell` | `JoinCodeRedemptionPage` — 6-character code redemption. |
| `/onboarding/organization-application` | `PublicShell` | `OrganizationApplicationPage` — Tenant creation application form. |

---

## 3. Participant Portal (`/app`)

| Path | Layout Shell | Component / Description |
| :--- | :--- | :--- |
| `/app` | `ParticipantShell` | `ParticipantDashboard` — Personalized challenge countdowns, active team status, and notifications. |
| `/app/challenges` | `ParticipantShell` | `ChallengesExplorePage` — In-app challenge catalog with registration actions. |
| `/app/challenges/:id` | `ParticipantShell` | `ChallengeDetailPage` — Deep dive, rubric guidelines, and submission links. |
| `/app/my-challenges` | `ParticipantShell` | `MyChallengesPage` — Registered, ongoing, and completed competitions. |
| `/app/teams` | `ParticipantShell` | `TeamsMatchmakingPage` — Team management and participant matchmaking. |
| `/app/teams/:teamId` | `ParticipantShell` | `TeamDetailPage` — Team roster, captain controls, and invitation links. |
| `/app/submissions` | `ParticipantShell` | `SubmissionsListPage` — Submission draft status and history. |
| `/app/submissions/new` | `ParticipantShell` | `SubmissionEditorPage` — Project builder with multi-tab authoring. |
| `/app/submissions/:id` | `ParticipantShell` | `SubmissionDetailPage` — Finalized project details, version logs, and score feedback. |
| `/app/submissions/:id/edit` | `ParticipantShell` | `SubmissionEditorPage` — Edit draft submission. |
| `/app/organizations` | `ParticipantShell` | `OrganizationsExplorePage` — Member organization affiliations and directory. |
| `/app/results` | `ParticipantShell` | `ParticipantResultsPage` — Historical results and leaderboard access. |
| `/app/support` | `ParticipantShell` | `SupportTicketsPage` — Support ticket inquiry desk. |
| `/app/support/:id` | `ParticipantShell` | `SupportTicketDetailPage` — Conversation thread with platform support. |
| `/app/inbox` | `ParticipantShell` | `InboxPage` — System and challenge notification stream. |
| `/app/profile` | `ParticipantShell` | `UserProfilePage` — Skills picker, bio, and social links. |
| `/app/settings` | `ParticipantShell` | `UserSettingsPage` — Account security, notifications, and theme settings. |

---

## 4. Judge Suite (`/judge`)

| Path | Layout Shell | Component / Description |
| :--- | :--- | :--- |
| `/judge` | `JudgeShell` | `JudgeDashboard` — Assigned submission evaluation queue and progress indicator. |
| `/judge/assignments` | `JudgeShell` | `JudgeDashboard` — Direct alias for evaluation queue. |
| `/judge/challenges/:id` | `JudgeShell` | `JudgeChallengeOverviewPage` — Challenge briefing, rubric preview, and scoring guidelines. |
| `/judge/submissions/:id` | `JudgeShell` | `JudgeEvaluationPage` — Blind evaluation interface with weighted scorecards. |
| `/judge/scorecards` | `JudgeShell` | `JudgeScorecardsPage` — History of completed scorecards and feedback comments. |
| `/judge/rubric-guide` | `JudgeShell` | `JudgeRubricGuidePage` — Criteria descriptors and scoring calibration standards. |

---

## 5. Organization Administration (`/org/:orgId`)

| Path | Layout Shell | Component / Description |
| :--- | :--- | :--- |
| `/org/:orgId` | `OrganizationAdminShell` | `OrgDashboard` — Tenant overview, active KPIs, and challenge status. |
| `/org/:orgId/challenges` | `OrganizationAdminShell` | `OrgChallengesPage` — Organization challenge management index. |
| `/org/:orgId/challenges/new` | `OrganizationAdminShell` | `OrgChallengeEditorPage` — Challenge creation wizard. |
| `/org/:orgId/challenges/:id/edit` | `OrganizationAdminShell` | `OrgChallengeEditorPage` — Challenge editor. |
| `/org/:orgId/challenges/:id/participants` | `OrganizationAdminShell` | `OrgParticipantsPage` — Participant approval and screening desk. |
| `/org/:orgId/challenges/:id/teams` | `OrganizationAdminShell` | `OrgTeamsOversightPage` — Challenge team rosters and sizing. |
| `/org/:orgId/challenges/:id/announcements` | `OrganizationAdminShell` | `OrgAnnouncementsPage` — Direct broadcast sender. |
| `/org/:orgId/challenges/:id/judging` | `OrganizationAdminShell` | `OrgJudgingManagementPage` — Judge assignment matrix and rubric editor. |
| `/org/:orgId/challenges/:id/results` | `OrganizationAdminShell` | `OrgResultsManagementPage` — Leaderboard computation and winner publication. |
| `/org/:orgId/submissions` | `OrganizationAdminShell` | `OrgSubmissionsPoolPage` — All-submission intake pool with filters. |
| `/org/:orgId/members` | `OrganizationAdminShell` | `OrgMembersPage` — Member directory and role management. |
| `/org/:orgId/invitations` | `OrganizationAdminShell` | `OrgInvitationsPage` — Email invitations sender and tracking. |
| `/org/:orgId/join-codes` | `OrganizationAdminShell` | `OrgJoinCodesPage` — Join codes and domain whitelist manager. |
| `/org/:orgId/portfolio` | `OrganizationAdminShell` | `OrgPortfolioPage` — Enterprise innovation portfolio manager. |
| `/org/:orgId/analytics` | `OrganizationAdminShell` | `OrgAnalyticsPage` — Participation curves and engagement telemetry. |
| `/org/:orgId/exports` | `OrganizationAdminShell` | `OrgExportsPage` — CSV and ZIP archive data export jobs. |
| `/org/:orgId/integrations` | `OrganizationAdminShell` | `OrgIntegrationsPage` — GitHub, Discord, Slack, and webhook integrations. |
| `/org/:orgId/audit` | `OrganizationAdminShell` | `OrgAuditPage` — Tenant security event logs. |
| `/org/:orgId/settings` | `OrganizationAdminShell` | `OrgSettingsPage` — Tenant profile, domain rules, and branding. |

---

## 6. Platform Superadmin (`/admin`)

| Path | Layout Shell | Component / Description |
| :--- | :--- | :--- |
| `/admin` | `PlatformAdminShell` | `AdminDashboard` — Global platform overview, system health, and quick actions. |
| `/admin/organizations` | `PlatformAdminShell` | `AdminOrganizationsPage` — Multi-tenant management and application approval. |
| `/admin/moderation` | `PlatformAdminShell` | `AdminModerationPage` — Content safety flags and triage queue. |
| `/admin/support` | `PlatformAdminShell` | `AdminSupportPage` — Global support ticket operations. |
| `/admin/challenges` | `PlatformAdminShell` | `AdminChallengesPage` — Global challenge directory and lifecycle overrides. |
| `/admin/users` | `PlatformAdminShell` | `AdminUsersPage` — Global user directory and role management. |
| `/admin/analytics` | `PlatformAdminShell` | `AdminAnalyticsPage` — Cross-tenant aggregate telemetry. |
| `/admin/health` | `PlatformAdminShell` | `AdminHealthPage` — Infrastructure services status and latencies. |
| `/admin/audit-logs` | `PlatformAdminShell` | `AdminAuditLogsPage` — Global audit trail with JSON inspector and CSV export. |
| `/admin/settings` | `PlatformAdminShell` | `AdminSystemSettingsPage` — Feature flags, quotas, and emergency broadcast banners. |
