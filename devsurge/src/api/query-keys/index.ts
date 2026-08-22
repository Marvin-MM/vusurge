export const queryKeys = {
  // Users & Auth
  currentUser: ["users", "me"] as const,
  user: (id: string) => ["users", id] as const,
  userProfile: (username: string) => ["users", "profile", username] as const,

  // Organizations
  organizations: {
    all: ["organizations"] as const,
    list: (filters?: Record<string, any>) => ["organizations", "list", filters] as const,
    detail: (idOrSlug: string) => ["organizations", "detail", idOrSlug] as const,
    members: (orgId: string) => ["organizations", orgId, "members"] as const,
    invitations: (orgId: string) => ["organizations", orgId, "invitations"] as const,
    applications: (filters?: Record<string, any>) => ["organization-applications", filters] as const,
    auditEvents: (orgId: string) => ["organizations", orgId, "audit-events"] as const,
    portfolio: (orgId: string) => ["organizations", orgId, "portfolio"] as const,
    integrations: (orgId: string) => ["organizations", orgId, "integrations"] as const,
  },

  // Challenges
  challenges: {
    all: ["challenges"] as const,
    list: (filters?: Record<string, any>) => ["challenges", "list", filters] as const,
    detail: (idOrSlug: string) => ["challenges", "detail", idOrSlug] as const,
    tracks: (challengeId: string) => ["challenges", challengeId, "tracks"] as const,
    prizes: (challengeId: string) => ["challenges", challengeId, "prizes"] as const,
    rubric: (challengeId: string) => ["challenges", challengeId, "rubric"] as const,
    announcements: (challengeId: string) => ["challenges", challengeId, "announcements"] as const,
    participants: (challengeId: string) => ["challenges", challengeId, "participants"] as const,
    analytics: (challengeId: string) => ["challenges", challengeId, "analytics"] as const,
  },

  // Teams & Matchmaking
  teams: {
    all: ["teams"] as const,
    list: (filters?: Record<string, any>) => ["teams", "list", filters] as const,
    detail: (id: string) => ["teams", "detail", id] as const,
    myTeam: (challengeId: string) => ["teams", "my-team", challengeId] as const,
    matchmaking: (challengeId: string) => ["matchmaking", challengeId] as const,
  },

  // Submissions
  submissions: {
    all: ["submissions"] as const,
    list: (filters?: Record<string, any>) => ["submissions", "list", filters] as const,
    detail: (id: string) => ["submissions", "detail", id] as const,
    mySubmission: (challengeId: string) => ["submissions", "my", challengeId] as const,
  },

  // Judging
  judging: {
    assignments: (judgeUserId?: string, challengeId?: string) => ["judging", "assignments", judgeUserId, challengeId] as const,
    scorecards: (challengeId?: string, judgeUserId?: string) => ["judging", "scorecards", challengeId, judgeUserId] as const,
    scorecard: (submissionId: string, judgeUserId?: string) => ["judging", "scorecard", submissionId, judgeUserId] as const,
    conflicts: (challengeId?: string) => ["judging", "conflicts", challengeId] as const,
    rubric: (challengeId: string) => ["judging", "rubric", challengeId] as const,
    rubricVersions: (challengeId: string) => ["judging", "rubric-versions", challengeId] as const,
    finalization: (challengeId: string) => ["judging", "finalization", challengeId] as const,
  },

  // Results
  results: {
    list: (challengeId?: string) => ["results", "list", challengeId] as const,
    detail: (challengeId: string) => ["results", "detail", challengeId] as const,
  },

  // Notifications & Support
  notifications: ["notifications"] as const,
  supportTickets: (filters?: Record<string, any>) => ["support-tickets", filters] as const,
  supportTicket: (id: string) => ["support-tickets", "detail", id] as const,
  moderationReports: (filters?: Record<string, any>) => ["moderation-reports", filters] as const,
  moderationReport: (id: string) => ["moderation-reports", "detail", id] as const,
  platformHealth: ["platform", "health"] as const,
  platformSettings: ["platform", "settings"] as const,
  platformStats: ["platform", "stats"] as const,
  platformAnalytics: (filters?: Record<string, any>) => ["platform", "analytics", filters] as const,
  platformAudit: (filters?: Record<string, any>) => ["platform", "audit-events", filters] as const,
};
