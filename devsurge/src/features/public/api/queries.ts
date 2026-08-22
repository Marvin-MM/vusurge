import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { apiGet } from "@/api/client/axiosClient";
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

// Sign-in/sign-up/verify-email/forgot-password/reset-password all go
// through the real Better Auth client directly (src/api/client/authClient.ts)
// — via useAuth() for sign-in/sign-up, or authClient.<method>() for the
// rest — not a hand-rolled mutation wrapper. Better Auth's own endpoints
// already provide everything a TanStack Query wrapper would add here.
