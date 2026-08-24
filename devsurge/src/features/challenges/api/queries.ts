import { useQuery } from "@tanstack/react-query";
import { apiGet, apiArray } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { Challenge, Announcement, FAQ, Track } from "@/types";

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

