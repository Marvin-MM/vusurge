import { useQuery } from "@tanstack/react-query";
import { apiGet, apiArray } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { Organization, PublicInnovation, PublicProject, AuditEvent, Membership } from "@/types";

/** Public directory of organizations — `GET /public/organizations` (anonymous-safe). */
export function usePublicOrganizations(filters?: { q?: string }) {
  return useCursorList<Organization>(["public", "organizations", "list"], "/public/organizations", filters);
}

/** Public single-org profile by slug — `GET /public/organizations/:slug`. */
export function usePublicOrganization(orgSlug: string) {
  return useQuery({
    queryKey: ["public", "organizations", "detail", orgSlug],
    queryFn: () => apiGet<Organization>(`/public/organizations/${orgSlug}`),
    enabled: Boolean(orgSlug),
  });
}

/** Public innovation-portfolio showcase for an org — `GET /public/organizations/:slug/innovations`. */
export function usePublicOrganizationInnovations(orgSlug: string) {
  return useCursorList<PublicInnovation>(
    ["public", "organizations", orgSlug, "innovations"],
    `/public/organizations/${orgSlug}/innovations`,
    undefined,
    { enabled: Boolean(orgSlug) }
  );
}

/** Public showcase of published challenge submissions — `GET /public/organizations/:slug/projects`. */
export function usePublicOrganizationProjects(orgSlug: string) {
  return useCursorList<PublicProject>(
    ["public", "organizations", orgSlug, "projects"],
    `/public/organizations/${orgSlug}/projects`,
    undefined,
    { enabled: Boolean(orgSlug) }
  );
}

// --- Authenticated (org-admin / member) hooks below ------------------------

export function useOrganization(organizationId: string) {
  return useQuery({
    queryKey: ["organizations", "detail", organizationId],
    queryFn: () => apiGet<Organization>(`/organizations/${organizationId}`),
    enabled: Boolean(organizationId),
  });
}

export function useOrganizationAuditEvents(organizationId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "audit-events"],
    queryFn: () => apiGet<{ items: AuditEvent[]; hasMore: boolean; nextCursor: string | null }>(
      `/organizations/${organizationId}/audit`
    ),
    enabled: Boolean(organizationId),
  });
}

export function useOrganizationMembers(organizationId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "members"],
    queryFn: () => apiArray<Membership>(`/organizations/${organizationId}/members`),
    enabled: Boolean(organizationId),
  });
}

export const useOrganizationBySlug = usePublicOrganization;
