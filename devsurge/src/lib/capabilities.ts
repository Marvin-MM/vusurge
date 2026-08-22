import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/client/axiosClient";

/** Read-only, unauthenticated feature-flag surface — `GET /meta/capabilities`.
 * The backend's only mechanism for clients to detect optional capabilities
 * (e.g. SSE notifications, document uploads) that may be disabled per
 * environment; there is no admin-facing management UI for these anywhere in
 * the backend, only this read endpoint. */
export interface PlatformCapabilities {
  sseNotifications: boolean;
  documentUploads: boolean;
  slackIntegration: boolean;
  discordIntegration: boolean;
  unlistedChallenges: boolean;
  openAuthenticatedParticipation: boolean;
  mentorRole: boolean;
  directInnovationIntake: boolean;
}

export function useCapabilities() {
  return useQuery({
    queryKey: ["meta", "capabilities"],
    queryFn: () => apiGet<PlatformCapabilities>("/meta/capabilities"),
    staleTime: 5 * 60_000,
  });
}
