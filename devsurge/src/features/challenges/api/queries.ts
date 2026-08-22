import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { apiGet, apiArray } from "@/api/client/axiosClient";
import { queryKeys } from "@/api/query-keys";
import { useCursorList } from "@/lib/useCursorList";
import { Challenge, Announcement, FAQ, Track, Rubric } from "@/types";

interface PublicResult {
  id: string;
  challengeId: string;
  submissionId: string;
  trackId: string | null;
  rankLabel: string | null;
  rank: number | null;
  aggregateScore: number | null;
}

/** Global public challenge feed — `GET /public/challenges` (anonymous-safe). */
export function usePublicChallenges(filters?: { q?: string }) {
  return useCursorList<Challenge>(["public", "challenges", "list"], "/public/challenges", filters);
}

/** Public challenges scoped to one organization — `GET /public/organizations/:slug/challenges`. */
export function usePublicOrganizationChallenges(orgSlug: string) {
  return useCursorList<Challenge>(
    ["public", "organizations", orgSlug, "challenges"],
    `/public/organizations/${orgSlug}/challenges`,
    undefined,
    { enabled: Boolean(orgSlug) }
  );
}

/**
 * Public single-challenge detail — challenge slugs are unique per
 * organization, not platform-wide, so both slugs are required
 * (backend: `@@unique([organizationId, slug])`).
 */
export function usePublicChallenge(organizationSlug: string, challengeSlug: string) {
  return useQuery({
    queryKey: ["public", "organizations", organizationSlug, "challenges", challengeSlug],
    queryFn: () => apiGet<Challenge>(`/public/organizations/${organizationSlug}/challenges/${challengeSlug}`),
    enabled: Boolean(organizationSlug) && Boolean(challengeSlug),
  });
}

export function usePublicChallengeTracks(organizationSlug: string, challengeSlug: string) {
  return useQuery({
    queryKey: ["public", "organizations", organizationSlug, "challenges", challengeSlug, "tracks"],
    queryFn: () => apiArray<Track>(`/public/organizations/${organizationSlug}/challenges/${challengeSlug}/tracks`),
    enabled: Boolean(organizationSlug) && Boolean(challengeSlug),
  });
}

export function usePublicChallengeFaqs(organizationSlug: string, challengeSlug: string) {
  return useQuery({
    queryKey: ["public", "organizations", organizationSlug, "challenges", challengeSlug, "faqs"],
    queryFn: () => apiArray<FAQ>(`/public/organizations/${organizationSlug}/challenges/${challengeSlug}/faqs`),
    enabled: Boolean(organizationSlug) && Boolean(challengeSlug),
  });
}

export function usePublicChallengeAnnouncements(organizationSlug: string, challengeSlug: string) {
  return useQuery({
    queryKey: ["public", "organizations", organizationSlug, "challenges", challengeSlug, "announcements"],
    queryFn: () =>
      apiArray<Announcement>(`/public/organizations/${organizationSlug}/challenges/${challengeSlug}/announcements`),
    enabled: Boolean(organizationSlug) && Boolean(challengeSlug),
  });
}

/** Authenticated org-scoped challenge fetch by UUID — used by the participant/org-admin portals, which navigate by id, not slug. */
export function useOrgChallenge(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId],
    queryFn: () => apiGet<Challenge>(`/organizations/${organizationId}/challenges/${challengeId}`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function usePublicChallengeResults(organizationSlug: string, challengeSlug: string) {
  return useQuery({
    queryKey: ["public", "organizations", organizationSlug, "challenges", challengeSlug, "results"],
    queryFn: () =>
      apiArray<PublicResult>(`/public/organizations/${organizationSlug}/challenges/${challengeSlug}/results`),
    enabled: Boolean(organizationSlug) && Boolean(challengeSlug),
  });
}

// --- Authenticated (participant/org-admin/judge/superadmin) hooks below ----
// TODO: these hit a flat `/challenges` collection that doesn't exist on the
// real backend (challenges are always nested under an organization —
// `/organizations/:orgId/challenges/*`, see docs/openapi.json). Left as
// pre-existing placeholders — used by ~25 pages across the participant,
// org-admin, judge, and superadmin portals — until each portal's own
// integration phase rewires its call sites to the real nested endpoints.
// Not Phase 2 (public portal) scope; only the new `usePublic*` hooks above
// are wired for real in this phase.

export function useChallenges(filters?: { organizationId?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.challenges.list(filters),
    queryFn: async () => {
      const res = await apiClient.get<any, { data: Challenge[]; meta: any }>("/challenges", { params: filters });
      return res.data;
    },
  });
}

export function useChallenge(idOrSlug: string) {
  return useQuery({
    queryKey: queryKeys.challenges.detail(idOrSlug),
    queryFn: async () => {
      const res = await apiClient.get<any, { data: Challenge }>(`/challenges/${idOrSlug}`);
      return res.data;
    },
    enabled: Boolean(idOrSlug),
  });
}

export function useChallengeAnnouncements(challengeId: string) {
  return useQuery({
    queryKey: queryKeys.challenges.announcements(challengeId),
    queryFn: async () => {
      const res = await apiClient.get<any, { data: Announcement[] }>("/announcements", { params: { challengeId } });
      return res.data;
    },
    enabled: Boolean(challengeId),
  });
}

export const useChallengeBySlug = useChallenge;

export function useChallengeRubric(challengeId: string) {
  return useQuery({
    queryKey: queryKeys.challenges.rubric(challengeId),
    queryFn: async () => {
      const res = await apiClient.get<any, { data: Rubric }>(`/rubrics/challenge/${challengeId}`);
      return res.data;
    },
    enabled: Boolean(challengeId),
  });
}

export function useMutateChallengeLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      action,
      payload,
      data,
    }: {
      challengeId: string;
      action: "PUBLISH" | "EXTEND_DEADLINE" | "REOPEN" | "CANCEL" | string;
      payload?: any;
      data?: any;
    }) => {
      const extra = payload || data || {};
      const res = await apiClient.post(`/challenges/${challengeId}/lifecycle`, { action, ...extra });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
    },
  });
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challengeData: Partial<Challenge>) => {
      const res = await apiClient.post("/challenges", challengeData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
    },
  });
}

export function useUpdateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Challenge> & { id: string }) => {
      const res = await apiClient.patch(`/challenges/${id}`, data);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.challenges.detail(vars.id) });
    },
  });
}

