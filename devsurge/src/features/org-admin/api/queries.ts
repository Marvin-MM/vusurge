import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiArray, apiCursorList, apiPost, apiPatch, apiDelete } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
  Organization,
  OrgSettings,
  Membership,
  Invitation,
  JoinCode,
  JoinRequest,
  Challenge,
  Track,
  Prize,
  Sponsor,
  ParticipationRecord,
  Team,
  Submission,
  Rubric,
  RubricVersion,
  StaffAssignment,
  StaffInvitation,
  JudgeAssignment,
  JudgingProgress,
  Result,
  Announcement,
  FAQ,
  AuditEvent,
  InnovationPortfolioItem,
  InnovationMilestone,
  InnovationMetric,
  InnovationMetricMeasurement,
  InnovationEvidence,
  InnovationStageHistoryEntry,
  OrgRole,
} from "@/types";

// =============================================================================
// Organization settings & profile
// =============================================================================

export function useOrganizationSettings(organizationId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "settings"],
    queryFn: () => apiGet<OrgSettings>(`/organizations/${organizationId}/settings`),
    enabled: Boolean(organizationId),
  });
}

export function useUpdateOrganizationSettings(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<OrgSettings> & { visibility?: string }) =>
      apiPatch<OrgSettings>(`/organizations/${organizationId}/settings`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "settings"] });
    },
  });
}

export function useTransferOwnership(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { newOwnerUserId: string; reason: string }) =>
      apiPost(`/organizations/${organizationId}/transfer-ownership`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "memberships"] });
    },
  });
}

export function useArchiveOrganization(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => apiPost(`/organizations/${organizationId}/archive`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["auth", "memberships"] });
    },
  });
}

export function useUpdateOrganizationProfile(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; description?: string; websiteUrl?: string; country?: string; region?: string; logoAssetId?: string }) =>
      apiPatch<Organization>(`/organizations/${organizationId}/profile`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId] });
    },
  });
}

// =============================================================================
// Members
// =============================================================================

export function useOrgAdminMembers(organizationId: string, status?: "ACTIVE" | "INACTIVE", options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "members", { status }],
    // GET /organizations/:id/members returns a cursor page
    // (`{ items, nextCursor, hasMore }` — see backend
    // memberships.dto.ts's `MemberListResponse = PageOf(MemberResponse)`),
    // not a bare array, unlike most other admin list endpoints. This page
    // doesn't offer "load more" UI, so pull a single generously-sized page
    // (100 is the backend's hard cap — see `PaginationQuery` in
    // shared/http/dto-primitives.ts) rather than truncating silently at
    // the default page size — real per-org membership rosters are small
    // enough that this holds in practice, and the org-scoped audit/export
    // flows remain the correct path for anything larger.
    queryFn: () =>
      apiCursorList<Membership>(`/organizations/${organizationId}/members`, { params: { limit: 100, status } }).then(
        (page) => page.items
      ),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useChangeMemberRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      apiPost(`/organizations/${organizationId}/members/${userId}/change-role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
    },
  });
}

export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiPost(`/organizations/${organizationId}/members/${userId}/remove`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
    },
  });
}

export function useReactivateMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role?: OrgRole }) =>
      apiPost(`/organizations/${organizationId}/members/${userId}/reactivate`, role ? { role } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
    },
  });
}

// =============================================================================
// Invitations
// =============================================================================

export function useOrgInvitations(organizationId: string, options?: { enabled?: boolean }) {
  return useCursorList<Invitation>(["organizations", organizationId, "invitations"], `/organizations/${organizationId}/invitations`, undefined, options);
}

export function useCreateInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; role: OrgRole }) =>
      apiPost<Invitation>(`/organizations/${organizationId}/invitations`, payload, {
        headers: { "idempotency-key": newIdempotencyKey() },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "invitations"] });
    },
  });
}

export function useRevokeInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => apiPost(`/organizations/${organizationId}/invitations/${invitationId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "invitations"] });
    },
  });
}

export function useResendInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => apiPost(`/organizations/${organizationId}/invitations/${invitationId}/resend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "invitations"] });
    },
  });
}

// =============================================================================
// Join codes & join requests
// =============================================================================

export function useOrgJoinCodes(organizationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "join-codes"],
    queryFn: () => apiArray<JoinCode>(`/organizations/${organizationId}/join-codes`),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useCreateJoinCode(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { label?: string; expiresInDays?: number; maxUses?: number; allowedEmailDomains?: string[] }) =>
      apiPost<JoinCode>(`/organizations/${organizationId}/join-codes`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "join-codes"] });
    },
  });
}

export function useRevokeJoinCode(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (joinCodeId: string) => apiPost(`/organizations/${organizationId}/join-codes/${joinCodeId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "join-codes"] });
    },
  });
}

export function useOrgJoinRequests(organizationId: string, options?: { enabled?: boolean }) {
  return useCursorList<JoinRequest>(["organizations", organizationId, "join-requests"], `/organizations/${organizationId}/join-requests`, undefined, options);
}

export function useApproveJoinRequest(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => apiPost(`/organizations/${organizationId}/join-requests/${requestId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "join-requests"] });
    },
  });
}

export function useRejectJoinRequest(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      apiPost(`/organizations/${organizationId}/join-requests/${requestId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "join-requests"] });
    },
  });
}

// =============================================================================
// Challenges — list, create, update, lifecycle
// =============================================================================

export function useOrgChallenges(organizationId: string, status?: string) {
  return useCursorList<Challenge>(["organizations", organizationId, "challenges", { status }], `/organizations/${organizationId}/challenges`, {
    status,
  });
}

export interface ChallengePayload {
  title?: string;
  slug?: string;
  summary?: string;
  description?: string;
  visibility?: "ORG_MEMBERS" | "PUBLIC" | "UNLISTED";
  displayTimeZone?: string;
  minTeamSize?: number;
  maxTeamSize?: number;
  soloParticipationAllowed?: boolean;
  screeningRequired?: boolean;
  participationPolicy?: string;
  submissionRequirements?: string;
  publicProjectPublicationEnabled?: boolean;
  blindJudgingEnabled?: boolean;
  coverAssetId?: string;
}

export function useCreateChallenge(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChallengePayload & { title: string; slug: string }) =>
      apiPost<Challenge>(`/organizations/${organizationId}/challenges`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges"] });
    },
  });
}

export function useUpdateChallenge(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChallengePayload) => apiPatch<Challenge>(`/organizations/${organizationId}/challenges/${challengeId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId] });
    },
  });
}

/** challengeId is a call-time argument (not baked in at hook-creation) so one hook instance can drive lifecycle actions across an arbitrary list of challenges. */
function useChallengeLifecycleAction(organizationId: string, action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, payload }: { challengeId: string; payload?: Record<string, unknown> }) =>
      apiPost<Challenge>(`/organizations/${organizationId}/challenges/${challengeId}/${action}`, payload ?? {}),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", variables.challengeId] });
    },
  });
}

export const usePublishChallenge = (organizationId: string) => useChallengeLifecycleAction(organizationId, "publish");
export const useCancelChallenge = (organizationId: string) => useChallengeLifecycleAction(organizationId, "cancel");
export const useArchiveChallenge = (organizationId: string) => useChallengeLifecycleAction(organizationId, "archive");
export const useReopenChallenge = (organizationId: string) => useChallengeLifecycleAction(organizationId, "reopen");

export interface ReschedulePayload {
  registrationOpenAt?: string;
  registrationCloseAt?: string;
  submissionOpenAt?: string;
  submissionDeadline?: string;
  judgingStartAt?: string;
  judgingEndAt?: string;
  reason: string;
}

export function useRescheduleChallenge(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, payload }: { challengeId: string; payload: ReschedulePayload }) =>
      apiPost<Challenge>(`/organizations/${organizationId}/challenges/${challengeId}/reschedule`, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", variables.challengeId] });
    },
  });
}

// =============================================================================
// Tracks / Prizes / Sponsors / Terms
// =============================================================================

function challengeBase(organizationId: string, challengeId: string) {
  return `/organizations/${organizationId}/challenges/${challengeId}`;
}

export function useAdminTracks(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "tracks"],
    queryFn: () => apiArray<Track>(`${challengeBase(organizationId, challengeId)}/tracks`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useCreateTrack(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; displayOrder?: number }) =>
      apiPost<Track>(`${challengeBase(organizationId, challengeId)}/tracks`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "tracks"] }),
  });
}

export function useUpdateTrack(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trackId, payload }: { trackId: string; payload: Partial<{ name: string; description: string; displayOrder: number }> }) =>
      apiPatch<Track>(`${challengeBase(organizationId, challengeId)}/tracks/${trackId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "tracks"] }),
  });
}

export function useDeleteTrack(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trackId: string) => apiDelete(`${challengeBase(organizationId, challengeId)}/tracks/${trackId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "tracks"] }),
  });
}

export function useAdminPrizes(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "prizes"],
    queryFn: () => apiArray<Prize>(`${challengeBase(organizationId, challengeId)}/prizes`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useCreatePrize(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; description?: string; valueLabel?: string; trackId?: string; displayOrder?: number }) =>
      apiPost<Prize>(`${challengeBase(organizationId, challengeId)}/prizes`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "prizes"] }),
  });
}

export function useUpdatePrize(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prizeId, payload }: { prizeId: string; payload: Partial<{ title: string; description: string; valueLabel: string; trackId: string | null; displayOrder: number }> }) =>
      apiPatch<Prize>(`${challengeBase(organizationId, challengeId)}/prizes/${prizeId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "prizes"] }),
  });
}

export function useDeletePrize(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prizeId: string) => apiDelete(`${challengeBase(organizationId, challengeId)}/prizes/${prizeId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "prizes"] }),
  });
}

export function useAdminSponsors(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "sponsors"],
    queryFn: () => apiArray<Sponsor>(`${challengeBase(organizationId, challengeId)}/sponsors`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useCreateSponsor(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; websiteUrl?: string; tier?: string; displayOrder?: number }) =>
      apiPost<Sponsor>(`${challengeBase(organizationId, challengeId)}/sponsors`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "sponsors"] }),
  });
}

export function useUpdateSponsor(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sponsorId, payload }: { sponsorId: string; payload: Partial<{ name: string; websiteUrl: string | null; logoAssetId: string | null; tier: string | null; displayOrder: number }> }) =>
      apiPatch<Sponsor>(`${challengeBase(organizationId, challengeId)}/sponsors/${sponsorId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "sponsors"] }),
  });
}

export function useDeleteSponsor(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sponsorId: string) => apiDelete(`${challengeBase(organizationId, challengeId)}/sponsors/${sponsorId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "sponsors"] }),
  });
}

export interface TermsVersion {
  id: string;
  challengeId: string;
  version: number;
  content: string;
  isActive: boolean;
  activatedAt: string | null;
  createdAt: string;
}

// A newly-created terms version is NOT automatically active — it must be
// explicitly activated (see `useActivateTermsVersion`) before participants
// see it as the current version they're asked to accept.
export function useCreateTermsVersion(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => apiPost<TermsVersion>(`${challengeBase(organizationId, challengeId)}/terms/versions`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "terms"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "terms", "versions"] });
    },
  });
}

export function useTermsVersions(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "terms", "versions"],
    queryFn: () => apiArray<TermsVersion>(`${challengeBase(organizationId, challengeId)}/terms`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useActivateTermsVersion(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (termsVersionId: string) =>
      apiPost<TermsVersion>(`${challengeBase(organizationId, challengeId)}/terms/versions/${termsVersionId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "terms"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "terms", "versions"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "terms", "current"] });
    },
  });
}

export function useCurrentTerms(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "terms", "current"],
    queryFn: () => apiGet<TermsVersion | null>(`${challengeBase(organizationId, challengeId)}/terms/current`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

// =============================================================================
// Participants (oversight — approve/reject/disqualify)
// =============================================================================

export function useAdminParticipants(organizationId: string, challengeId: string, status?: string) {
  // The roster projection carries the applicant's identity (resolved
  // server-side) — `/users/:id/profile` 404s for anyone the caller does not
  // share an organization with, which most challenge applicants are not.
  return useCursorList<
    ParticipationRecord & {
      userId: string;
      decidedByUserId: string | null;
      internalNotes: string | null;
      displayName: string | null;
      email: string;
    }
  >(
    ["organizations", organizationId, "challenges", challengeId, "participants", { status }],
    `${challengeBase(organizationId, challengeId)}/participants`,
    { status }
  );
}

function useParticipantDecision(organizationId: string, challengeId: string, action: "approve" | "reject" | "disqualify" | "reinstate") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participationId, reason }: { participationId: string; reason?: string }) =>
      apiPost(`${challengeBase(organizationId, challengeId)}/participants/${participationId}/${action}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "participants"] });
    },
  });
}

export const useApproveParticipant = (organizationId: string, challengeId: string) => useParticipantDecision(organizationId, challengeId, "approve");
export const useRejectParticipant = (organizationId: string, challengeId: string) => useParticipantDecision(organizationId, challengeId, "reject");
export const useDisqualifyParticipant = (organizationId: string, challengeId: string) => useParticipantDecision(organizationId, challengeId, "disqualify");
export const useReinstateParticipant = (organizationId: string, challengeId: string) => useParticipantDecision(organizationId, challengeId, "reinstate");

// =============================================================================
// Teams oversight (read-only from the org-admin side)
// =============================================================================

export function useAdminTeams(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "teams"],
    queryFn: () => apiArray<Team>(`${challengeBase(organizationId, challengeId)}/teams`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

// =============================================================================
// Submissions pool (org-admin oversight)
// =============================================================================

export function useAdminSubmissions(organizationId: string, challengeId: string, status?: string) {
  return useCursorList<Submission>(
    ["organizations", organizationId, "challenges", challengeId, "submissions", { status }],
    `${challengeBase(organizationId, challengeId)}/submissions`,
    { status }
  );
}

export function useDisqualifySubmission(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, reason }: { submissionId: string; reason: string }) =>
      apiPost(`${challengeBase(organizationId, challengeId)}/submissions/${submissionId}/disqualify`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions"] }),
  });
}

export function useReopenSubmission(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, reason }: { submissionId: string; reason: string }) =>
      apiPost(`${challengeBase(organizationId, challengeId)}/submissions/${submissionId}/reopen`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions"] }),
  });
}

export function useReinstateSubmission(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, reason }: { submissionId: string; reason: string }) =>
      apiPost(`${challengeBase(organizationId, challengeId)}/submissions/${submissionId}/reinstate`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions"] }),
  });
}

export interface PromoteToInnovationPayload {
  title?: string;
  opportunityStatement?: string;
  thesis?: string;
  strategicThemes?: string[];
  expectedImpact?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  beneficiaries?: string;
}

export function usePromoteSubmissionToInnovation(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, payload }: { submissionId: string; payload: PromoteToInnovationPayload }) =>
      apiPost<InnovationPortfolioItem>(`${challengeBase(organizationId, challengeId)}/submissions/${submissionId}/promote-to-innovation`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations"] });
    },
  });
}

// =============================================================================
// Rubrics
// =============================================================================

export function useAdminRubrics(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "rubrics"],
    queryFn: () => apiArray<Rubric>(`${challengeBase(organizationId, challengeId)}/rubrics`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useCreateRubric(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string }) => apiPost<Rubric>(`${challengeBase(organizationId, challengeId)}/rubrics`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "rubrics"] }),
  });
}

export function useRubricVersions(organizationId: string, challengeId: string, rubricId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "rubrics", rubricId, "versions"],
    queryFn: () => apiArray<RubricVersion>(`${challengeBase(organizationId, challengeId)}/rubrics/${rubricId}/versions`),
    enabled: Boolean(rubricId),
  });
}

export function useCreateRubricVersion(organizationId: string, challengeId: string, rubricId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { criteria: { key: string; label: string; description?: string; minScore: number; maxScore: number; weight: number }[]; tieBreakPolicy?: string; judgeCommentRules?: string }) =>
      apiPost<RubricVersion>(`${challengeBase(organizationId, challengeId)}/rubrics/${rubricId}/versions`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "rubrics", rubricId, "versions"] }),
  });
}

export function useActivateRubricVersion(organizationId: string, challengeId: string, rubricId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => apiPost(`${challengeBase(organizationId, challengeId)}/rubrics/${rubricId}/versions/${versionId}/activate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "rubrics", rubricId, "versions"] }),
  });
}

// =============================================================================
// Challenge staff (judges/mentors) & judge assignments
// =============================================================================

export function useAdminStaff(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "staff"],
    queryFn: () => apiArray<StaffAssignment>(`${challengeBase(organizationId, challengeId)}/staff`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useInviteStaff(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { role: "JUDGE" | "MENTOR"; email: string }) =>
      apiPost<StaffInvitation>(`${challengeBase(organizationId, challengeId)}/staff-invitations`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "staff-invitations"] }),
  });
}

export function useStaffInvitations(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "staff-invitations"],
    queryFn: () => apiArray<StaffInvitation>(`${challengeBase(organizationId, challengeId)}/staff-invitations`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useRevokeStaffInvitation(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiPost(`${challengeBase(organizationId, challengeId)}/staff-invitations/${invitationId}/revoke`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "staff-invitations"] }),
  });
}

export function useReassignJudgeAssignment(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, newStaffAssignmentId, reason }: { assignmentId: string; newStaffAssignmentId: string; reason: string }) =>
      apiPost<JudgeAssignment>(`${challengeBase(organizationId, challengeId)}/judge-assignments/${assignmentId}/reassign`, { newStaffAssignmentId, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "judge-assignments"] }),
  });
}

export function useDeleteJudgeAssignment(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => apiDelete(`${challengeBase(organizationId, challengeId)}/judge-assignments/${assignmentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "judge-assignments"] }),
  });
}

export function useReopenScorecard(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scorecardId, reason }: { scorecardId: string; reason: string }) =>
      apiPost(`${challengeBase(organizationId, challengeId)}/scorecards/${scorecardId}/reopen`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "judge-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "judging", "progress"] });
    },
  });
}

export function useRemoveStaff(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (staffAssignmentId: string) => apiPost(`${challengeBase(organizationId, challengeId)}/staff/${staffAssignmentId}/remove`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "staff"] }),
  });
}

export function useAdminJudgeAssignments(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "judge-assignments"],
    queryFn: () => apiArray<JudgeAssignment>(`${challengeBase(organizationId, challengeId)}/judge-assignments`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useCreateJudgeAssignment(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { staffAssignmentId: string; submissionId: string }) =>
      apiPost<JudgeAssignment>(`${challengeBase(organizationId, challengeId)}/judge-assignments`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "judge-assignments"] }),
  });
}

export function useAutoBalanceJudgeAssignments(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`${challengeBase(organizationId, challengeId)}/judge-assignments/auto-balance`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "judge-assignments"] }),
  });
}

export function useJudgingProgress(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "judging", "progress"],
    queryFn: () => apiGet<JudgingProgress>(`${challengeBase(organizationId, challengeId)}/judging/progress`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useFinalizeJudging(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`${challengeBase(organizationId, challengeId)}/judging/finalize`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "judging", "progress"] }),
  });
}

export function useReleaseFeedback(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`${challengeBase(organizationId, challengeId)}/feedback/release`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions"] });
    },
  });
}

// =============================================================================
// Results
// =============================================================================

export function useAdminResults(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "results"],
    queryFn: () => apiArray<Result>(`${challengeBase(organizationId, challengeId)}/results`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useFinalizeResults(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (selections: { submissionId: string; trackId?: string; selectionType: string; rankLabel?: string; rank?: number }[]) =>
      apiPost<Result[]>(`${challengeBase(organizationId, challengeId)}/results/finalize`, { selections }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "results"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId] });
    },
  });
}

export function usePublishResults(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost(`${challengeBase(organizationId, challengeId)}/results/publish`, undefined, {
        headers: { "idempotency-key": newIdempotencyKey() },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "results"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId] });
    },
  });
}

export function useRetractResults(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => apiPost(`${challengeBase(organizationId, challengeId)}/results/retract`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "results"] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId] });
    },
  });
}

// =============================================================================
// Announcements & FAQs (org-scoped, optionally filtered/tagged by challengeId)
// =============================================================================

export function useOrgAnnouncements(organizationId: string, challengeId?: string) {
  return useCursorList<Announcement>(
    ["organizations", organizationId, "announcements", { challengeId }],
    `/organizations/${organizationId}/announcements`,
    { challengeId }
  );
}

export function useCreateAnnouncement(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { challengeId?: string; title: string; body: string; audience?: string; priority?: string }) =>
      apiPost<Announcement>(`/organizations/${organizationId}/announcements`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "announcements"] }),
  });
}

export function usePublishAnnouncement(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: string) => apiPost(`/organizations/${organizationId}/announcements/${announcementId}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "announcements"] }),
  });
}

export function useUnpublishAnnouncement(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: string) => apiPost(`/organizations/${organizationId}/announcements/${announcementId}/unpublish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "announcements"] }),
  });
}

export function useUpdateAnnouncement(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ announcementId, payload }: { announcementId: string; payload: Partial<{ title: string; body: string; audience: string; priority: string }> }) =>
      apiPatch<Announcement>(`/organizations/${organizationId}/announcements/${announcementId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "announcements"] }),
  });
}

export function useOrgFaqs(organizationId: string, challengeId?: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "faqs", { challengeId }],
    queryFn: () => apiArray<FAQ>(`/organizations/${organizationId}/faqs`, { params: { challengeId } }),
    enabled: Boolean(organizationId),
  });
}

export function useCreateFaq(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { challengeId?: string; question: string; answer: string; displayOrder?: number }) =>
      apiPost<FAQ>(`/organizations/${organizationId}/faqs`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "faqs"] }),
  });
}

export function useUpdateFaq(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ faqId, payload }: { faqId: string; payload: Partial<{ question: string; answer: string; displayOrder: number; isPublished: boolean }> }) =>
      apiPatch<FAQ>(`/organizations/${organizationId}/faqs/${faqId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "faqs"] }),
  });
}

export function useDeleteFaq(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (faqId: string) => apiDelete(`/organizations/${organizationId}/faqs/${faqId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "faqs"] }),
  });
}

export function useReorderFaqs(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => apiPost(`/organizations/${organizationId}/faqs/reorder`, { orderedIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "faqs"] }),
  });
}

// =============================================================================
// Audit
// =============================================================================

export function useOrgAuditEvents(organizationId: string, options?: { enabled?: boolean }) {
  return useCursorList<AuditEvent>(
    ["organizations", organizationId, "audit"],
    `/organizations/${organizationId}/audit`,
    undefined,
    options
  );
}

// =============================================================================
// Analytics
// =============================================================================

export interface OrgAnalyticsOverview {
  members: number;
  registrations: number;
  approvedParticipants: number;
  activeTeams: number;
  submissionsStarted: number;
  finalSubmissions: number;
  completionRate: number;
  judgingCompletion: number;
  averageScoringTurnaroundHours: number | null;
  topTechnologyTags: { tag: string; count: number }[];
  finalistCount: number;
  winnerCount: number;
}

export interface OrgChallengeAnalytics {
  challengeId: string;
  title: string;
  registrations: number;
  approvedParticipants: number;
  finalSubmissions: number;
  judgingCompletion: number;
}

export interface OrgPortfolioAnalytics {
  totalInnovations: number;
  byStage: Record<string, number>;
  portfolioConversionRate: number;
  activeMilestones: number;
  overdueMilestones: number;
}

export function useOrgAnalyticsOverview(organizationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "analytics", "overview"],
    queryFn: () => apiGet<OrgAnalyticsOverview>(`/organizations/${organizationId}/analytics/overview`),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useOrgChallengeAnalytics(organizationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "analytics", "challenges"],
    queryFn: () => apiArray<OrgChallengeAnalytics>(`/organizations/${organizationId}/analytics/challenges`),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useOrgPortfolioAnalytics(organizationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "analytics", "portfolio"],
    queryFn: () => apiGet<OrgPortfolioAnalytics>(`/organizations/${organizationId}/analytics/portfolio`),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export interface ChallengeAnalyticsDeepDive {
  members: number;
  registrations: number;
  approvedParticipants: number;
  activeTeams: number;
  submissionsStarted: number;
  finalSubmissions: number;
  completionRate: number;
  judgingCompletion: number;
  averageScoringTurnaroundHours: number | null;
  topTechnologyTags: { tag: string; count: number }[];
  finalistCount: number;
  winnerCount: number;
  submissionsPerTrack: { trackId: string | null; trackName: string | null; submissions: number }[];
}

export function useChallengeAnalyticsDeepDive(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "analytics"],
    queryFn: () => apiGet<ChallengeAnalyticsDeepDive>(`${challengeBase(organizationId, challengeId)}/analytics`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

// =============================================================================
// Exports
// =============================================================================

export interface ExportJob {
  id: string;
  organizationId: string;
  requestedByUserId: string;
  exportType: "ORGANIZATION_MEMBERS" | "ORGANIZATION_SUBMISSIONS" | "ORGANIZATION_PARTICIPATION" | "CHALLENGE_RESULTS";
  filters: Record<string, unknown> | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  storageKey: string | null;
  fileSizeBytes: number | null;
  rowCount: number | null;
  failureReason: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function useExportJobs(organizationId: string, options?: { enabled?: boolean }) {
  return useCursorList<ExportJob>(["organizations", organizationId, "exports"], `/organizations/${organizationId}/exports`, undefined, options);
}

export function useCreateExportJob(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { exportType: ExportJob["exportType"]; filters?: Record<string, unknown> }) =>
      apiPost<ExportJob>(`/organizations/${organizationId}/exports`, payload, {
        headers: { "idempotency-key": newIdempotencyKey() },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "exports"] }),
  });
}

export function useDeleteExportJob(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exportId: string) => apiDelete(`/organizations/${organizationId}/exports/${exportId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "exports"] }),
  });
}

export function useDownloadExportJob(organizationId: string) {
  return useMutation({
    mutationFn: (exportId: string) => apiGet<{ downloadUrl: string; expiresAt: string }>(`/organizations/${organizationId}/exports/${exportId}/download`),
  });
}

// =============================================================================
// Integrations
// =============================================================================

export interface Integration {
  id: string;
  organizationId: string;
  provider: string;
  status: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export function useOrgIntegrations(organizationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "integrations"],
    queryFn: () => apiArray<Integration>(`/organizations/${organizationId}/integrations`),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useCreateSlackIntegration(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookUrl: string) => apiPost<Integration>(`/organizations/${organizationId}/integrations/slack`, { webhookUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "integrations"] }),
  });
}

export function useCreateDiscordIntegration(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookUrl: string) => apiPost<Integration>(`/organizations/${organizationId}/integrations/discord`, { webhookUrl }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "integrations"] }),
  });
}

export function useDeleteIntegration(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) => apiDelete(`/organizations/${organizationId}/integrations/${integrationId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "integrations"] }),
  });
}

export function useTestIntegration(organizationId: string) {
  return useMutation({
    mutationFn: (integrationId: string) => apiPost(`/organizations/${organizationId}/integrations/${integrationId}/test`),
  });
}

export interface IntegrationDelivery {
  id: string;
  integrationId: string;
  eventType: string;
  status: "PENDING" | "SENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  succeeded: boolean | null;
  responseStatus: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export function useIntegrationDeliveries(organizationId: string, integrationId: string) {
  return useCursorList<IntegrationDelivery>(
    ["organizations", organizationId, "integrations", integrationId, "deliveries"],
    `/organizations/${organizationId}/integrations/${integrationId}/deliveries`,
  );
}

// =============================================================================
// Innovation portfolio
// =============================================================================

export function useInnovationPortfolio(organizationId: string, stage?: string, options?: { enabled?: boolean }) {
  return useCursorList<InnovationPortfolioItem>(
    ["organizations", organizationId, "innovations", { stage }],
    `/organizations/${organizationId}/innovations`,
    { stage },
    options
  );
}

export interface CreateInnovationPayload {
  title: string;
  opportunityStatement?: string;
  thesis?: string;
  strategicThemes?: string[];
  expectedImpact?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  beneficiaries?: string;
}

export function useCreateInnovation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInnovationPayload) =>
      apiPost<InnovationPortfolioItem>(`/organizations/${organizationId}/innovations`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations"] }),
  });
}

export function useInnovationPortfolioItem(organizationId: string, innovationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "innovations", innovationId],
    queryFn: () => apiGet<InnovationPortfolioItem>(`/organizations/${organizationId}/innovations/${innovationId}`),
    enabled: Boolean(organizationId) && Boolean(innovationId) && (options?.enabled ?? true),
  });
}

export function useInnovationMilestones(organizationId: string, innovationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "innovations", innovationId, "milestones"],
    queryFn: () => apiArray<InnovationMilestone>(`/organizations/${organizationId}/innovations/${innovationId}/milestones`),
    enabled: Boolean(innovationId) && (options?.enabled ?? true),
  });
}

export function useInnovationMetrics(organizationId: string, innovationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "innovations", innovationId, "metrics"],
    queryFn: () => apiArray<InnovationMetric>(`/organizations/${organizationId}/innovations/${innovationId}/metrics`),
    enabled: Boolean(innovationId) && (options?.enabled ?? true),
  });
}

export function useInnovationEvidence(organizationId: string, innovationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "innovations", innovationId, "evidence"],
    queryFn: () => apiArray<InnovationEvidence>(`/organizations/${organizationId}/innovations/${innovationId}/evidence`),
    enabled: Boolean(innovationId) && (options?.enabled ?? true),
  });
}

export function useInnovationStageHistory(organizationId: string, innovationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "innovations", innovationId, "stage-history"],
    queryFn: () => apiArray<InnovationStageHistoryEntry>(`/organizations/${organizationId}/innovations/${innovationId}/stage-history`),
    enabled: Boolean(innovationId) && (options?.enabled ?? true),
  });
}

export function useTransitionInnovationStage(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { toStage: string; decision?: string; notes?: string; nextReviewDate?: string }) =>
      apiPost<InnovationPortfolioItem>(`/organizations/${organizationId}/innovations/${innovationId}/transition-stage`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "stage-history"] });
    },
  });
}

export function useCreateMilestone(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; description?: string; status?: string; dueDate?: string }) =>
      apiPost<InnovationMilestone>(`/organizations/${organizationId}/innovations/${innovationId}/milestones`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "milestones"] });
    },
  });
}

export function useUpdateMilestone(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, payload }: { milestoneId: string; payload: { title?: string; description?: string; status?: string; dueDate?: string | null } }) =>
      apiPatch<InnovationMilestone>(`/organizations/${organizationId}/innovations/${innovationId}/milestones/${milestoneId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "milestones"] });
    },
  });
}

export function useDeleteMilestone(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) =>
      apiDelete(`/organizations/${organizationId}/innovations/${innovationId}/milestones/${milestoneId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "milestones"] });
    },
  });
}

export function useCreateMetric(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; metricType: string; unit?: string; targetValue?: string }) =>
      apiPost<InnovationMetric>(`/organizations/${organizationId}/innovations/${innovationId}/metrics`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "metrics"] });
    },
  });
}

export function useUpdateMetric(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ metricId, payload }: { metricId: string; payload: { name?: string; unit?: string; targetValue?: string | null } }) =>
      apiPatch<InnovationMetric>(`/organizations/${organizationId}/innovations/${innovationId}/metrics/${metricId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "metrics"] });
    },
  });
}

export function useMetricMeasurements(organizationId: string, innovationId: string, metricId: string) {
  return useCursorList<InnovationMetricMeasurement>(
    ["organizations", organizationId, "innovations", innovationId, "metrics", metricId, "measurements"],
    `/organizations/${organizationId}/innovations/${innovationId}/metrics/${metricId}/measurements`,
    {},
    { enabled: Boolean(metricId) }
  );
}

export function useRecordMeasurement(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ metricId, payload }: { metricId: string; payload: { value: string; measuredAt: string; note?: string } }) =>
      apiPost<InnovationMetricMeasurement>(`/organizations/${organizationId}/innovations/${innovationId}/metrics/${metricId}/measurements`, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "innovations", innovationId, "metrics", variables.metricId, "measurements"],
      });
    },
  });
}

export function useCreateEvidence(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { type: "LINK" | "MEDIA_ASSET" | "NOTE"; title: string; url?: string; mediaAssetId?: string; note?: string }) =>
      apiPost<InnovationEvidence>(`/organizations/${organizationId}/innovations/${innovationId}/evidence`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "evidence"] });
    },
  });
}

export function useDeleteEvidence(organizationId: string, innovationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (evidenceId: string) =>
      apiDelete(`/organizations/${organizationId}/innovations/${innovationId}/evidence/${evidenceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "innovations", innovationId, "evidence"] });
    },
  });
}
