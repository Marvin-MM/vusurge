import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { newIdempotencyKey } from "@/lib/idempotency";

export interface UserProfile {
  id: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  avatarAssetId: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  skills: { id: string | null; name: string; isCustom: boolean }[];
}

/** Public-enough profile lookup by id — used to resolve a bare userId (e.g. a matchmaking post's posterUserId, a team member) into a displayable name. */
export function useUserProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["users", userId, "profile"],
    queryFn: () => apiGet<UserProfile>(`/users/${userId}/profile`),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
}

export interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  location?: string;
  avatarAssetId?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  discordHandle?: string;
  visibility?: "PUBLIC" | "ORGANIZATION_MEMBERS" | "PRIVATE";
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => apiPatch("/me/profile", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export function useSkillsCatalog() {
  // A platform-curated catalogue that effectively never changes within a
  // session — refetching it on the ordinary five-minute cadence is pure waste.
  return useCursorList<SkillCatalogEntry>(["meta", "skills"], "/meta/skills", { limit: 100 }, {
    staleTime: 60 * 60_000,
  });
}

export interface TechnologyTagEntry {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

/** Searchable technology-tag catalog for submission tech-stack autocomplete — `GET /meta/technology-tags`. */
export function useTechnologyTags(q?: string) {
  return useCursorList<TechnologyTagEntry>(
    ["meta", "technology-tags", { q }],
    "/meta/technology-tags",
    { limit: 50, q },
    { staleTime: 60 * 60_000 },
  );
}

export function useUpdateSkills() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { skillIds: string[]; customNames: string[] }) => apiPut("/me/skills", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export interface AccountDeletionRequest {
  id: string;
  status: "PENDING" | "CANCELLED" | "COMPLETED";
  requestedAt: string;
  eligibleAt: string;
}

export function useAccountDeletionRequest() {
  return useQuery({
    queryKey: ["me", "account-deletion-request"],
    queryFn: () =>
      apiGet<{ request: AccountDeletionRequest | null }>("/me/account-deletion-request").then(
        (response) => response.request,
      ),
  });
}

export function useRequestAccountDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      apiPost<AccountDeletionRequest>(
        "/me/account-deletion-request",
        reason ? { reason } : {},
        { headers: { "idempotency-key": newIdempotencyKey() } },
      ),
    onSuccess: (request) => queryClient.setQueryData(["me", "account-deletion-request"], request),
  });
}

export function useCancelAccountDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete("/me/account-deletion-request"),
    onSuccess: () => queryClient.setQueryData(["me", "account-deletion-request"], null),
  });
}
