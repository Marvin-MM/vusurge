import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiArray, apiPost, apiPatch, apiDelete } from "@/api/client/axiosClient";
import { Team, MatchmakingPost, TeamMemberInvitation } from "@/types";

// Teams, invitations, and matchmaking are all scoped under an organization +
// challenge (never a flat top-level collection) — see
// backend/docs/openapi.json's `/organizations/:orgId/challenges/:challengeId/*`
// nesting.

export function useTeams(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "teams"],
    queryFn: () => apiArray<Team>(`/organizations/${organizationId}/challenges/${challengeId}/teams`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useTeam(organizationId: string, challengeId: string, teamId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "teams", teamId],
    queryFn: () => apiGet<Team>(`/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}`),
    enabled: Boolean(organizationId) && Boolean(challengeId) && Boolean(teamId),
  });
}

// Backend-side `requireCaptainOrOrganizer` returns 403 for anyone else, so
// callers should pass `enabled: isCaptain` (participant side) — the
// org-admin side (organizer) is always allowed and can leave it default.
export function useTeamInvitations(organizationId: string, challengeId: string, teamId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "teams", teamId, "invitations"],
    queryFn: () =>
      apiArray<TeamMemberInvitation>(
        `/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}/invitations`
      ),
    enabled: Boolean(organizationId) && Boolean(challengeId) && Boolean(teamId) && (options?.enabled ?? true),
  });
}

export function useMatchmakingPosts(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "matchmaking"],
    queryFn: () => apiArray<MatchmakingPost>(`/organizations/${organizationId}/challenges/${challengeId}/matchmaking`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useCreateTeam(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; trackId?: string }) =>
      apiPost<Team>(`/organizations/${organizationId}/challenges/${challengeId}/teams`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams"] });
    },
  });
}

export function useInviteTeamMember(organizationId: string, challengeId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { userId: string }) =>
      apiPost(`/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}/invitations`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams", teamId] });
    },
  });
}

export function useRevokeTeamInvitation(organizationId: string, challengeId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiPost(`/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}/invitations/${invitationId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "challenges", challengeId, "teams", teamId, "invitations"],
      });
    },
  });
}

export function useRemoveTeamMember(organizationId: string, challengeId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiPost(`/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}/members/${userId}/remove`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams", teamId] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams"] });
    },
  });
}

/** Org-admin-only override for post-deadline roster corrections — see `openapi.json`'s `organizer-exception` op. */
export function useTeamOrganizerException(organizationId: string, challengeId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { action: "ADD_MEMBER" | "REMOVE_MEMBER"; userId: string; reason: string }) =>
      apiPost<Team>(`/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}/organizer-exception`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams", teamId] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams"] });
    },
  });
}

export function useLeaveTeam(organizationId: string, challengeId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams"] });
    },
  });
}

export function useTransferCaptain(organizationId: string, challengeId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { newCaptainUserId: string }) =>
      apiPost<Team>(`/organizations/${organizationId}/challenges/${challengeId}/teams/${teamId}/transfer-captain`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "teams", teamId] });
    },
  });
}

export function useCreateMatchmakingPost(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      posterTeamId?: string;
      skillsOffered: string[];
      rolesSought: string[];
      message: string;
      availability?: string;
      contactPreference?: string;
    }) => apiPost<MatchmakingPost>(`/organizations/${organizationId}/challenges/${challengeId}/matchmaking`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "matchmaking"] });
    },
  });
}

export function useExpressMatchmakingInterest(organizationId: string, challengeId: string, postId: string) {
  return useMutation({
    mutationFn: (payload?: { message?: string }) =>
      apiPost(`/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${postId}/interest`, payload ?? {}),
  });
}

// Note: there is no dedicated `useMatchmakingPost` (GET single) hook — the
// single-post response shape in openapi.json is identical to each item in
// the list response above, so `useMatchmakingPosts` already carries
// everything a detail view would need.

export function useUpdateMatchmakingPost(organizationId: string, challengeId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      skillsOffered?: string[];
      rolesSought?: string[];
      message?: string;
      availability?: string;
      contactPreference?: string;
    }) => apiPatch<MatchmakingPost>(`/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${postId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "matchmaking"] });
    },
  });
}

export function useCloseMatchmakingPost(organizationId: string, challengeId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<MatchmakingPost>(`/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${postId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "matchmaking"] });
    },
  });
}

export function useDeleteMatchmakingPost(organizationId: string, challengeId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`/organizations/${organizationId}/challenges/${challengeId}/matchmaking/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "matchmaking"] });
    },
  });
}
