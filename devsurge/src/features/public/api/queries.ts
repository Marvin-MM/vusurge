import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { apiGet, apiPost } from "@/api/client/axiosClient";
import { Organization, Challenge } from "@/types";

export interface PublicSearchResults {
  organizations: Organization[];
  challenges: Challenge[];
}

/** Anonymous-safe global search across organizations and public challenges — `GET /public/search`. */
export function usePublicSearch(q: string) {
  return useQuery({
    queryKey: ["public", "search", q],
    queryFn: () => apiGet<PublicSearchResults>("/public/search", { params: { q } }),
    enabled: q.trim().length > 0,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tokenOrId: string) => {
      const res = await apiClient.post(`/invitations/${tokenOrId}/accept`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitation"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tokenOrId: string) => {
      const res = await apiClient.post(`/invitations/${tokenOrId}/decline`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitation"] });
    },
  });
}

export function useAcceptTeamInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => apiPost<{ id: string; challengeId: string }>(`/team-invitations/${token}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "team-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}

export function useDeclineTeamInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => apiPost(`/team-invitations/${token}/decline`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "team-invitations"] }),
  });
}

export function useAcceptStaffInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiPost<{ id: string; challengeId: string; role: "JUDGE" | "MENTOR" }>(
        `/challenge-staff-invitations/${token}/accept`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "challenge-staff-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["judging"] });
    },
  });
}

export function useDeclineStaffInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => apiPost(`/challenge-staff-invitations/${token}/decline`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "challenge-staff-invitations"] }),
  });
}

// Sign-in/sign-up/verify-email/forgot-password/reset-password all go
// through the real Better Auth client directly (src/api/client/authClient.ts)
// — via useAuth() for sign-in/sign-up, or authClient.<method>() for the
// rest — not a hand-rolled mutation wrapper. Better Auth's own endpoints
// already provide everything a TanStack Query wrapper would add here.
