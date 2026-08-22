import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPut } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";

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
  return useCursorList<SkillCatalogEntry>(["meta", "skills"], "/meta/skills", { limit: 100 });
}

export interface TechnologyTagEntry {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

/** Searchable technology-tag catalog for submission tech-stack autocomplete — `GET /meta/technology-tags`. */
export function useTechnologyTags(q?: string) {
  return useCursorList<TechnologyTagEntry>(["meta", "technology-tags", { q }], "/meta/technology-tags", { limit: 50, q });
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
