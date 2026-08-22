import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/api/client/axiosClient";

interface DeliveryResponse {
  url: string;
  expiresAt: string | null;
}

/**
 * Every image the backend stores (challenge covers, org/sponsor logos) is
 * referenced by an opaque asset id, never a direct URL — the actual,
 * time-limited delivery URL has to be resolved via its own endpoint
 * (backend/docs/openapi.json: `GET /media/images/:id/delivery` or the
 * `/public/...` equivalent for unauthenticated pages). `scope: "public"`
 * must be used on `PublicShell` pages — the authenticated endpoint 401s
 * for anonymous visitors.
 */
export function useAssetUrl(
  assetId: string | null | undefined,
  scope: "public" | "authenticated" = "authenticated",
  options?: { enabled?: boolean }
): { url: string | undefined; isLoading: boolean } {
  const path =
    scope === "public" ? `/public/media/images/${assetId}/delivery` : `/media/images/${assetId}/delivery`;

  const query = useQuery({
    queryKey: ["asset-url", scope, assetId],
    queryFn: () => apiGet<DeliveryResponse>(path),
    enabled: Boolean(assetId) && (options?.enabled ?? true),
    // Delivery URLs are time-limited signed links; refetch periodically
    // rather than caching for the query's normal lifetime.
    staleTime: 4 * 60 * 1000,
  });

  return { url: query.data?.url, isLoading: query.isLoading };
}
