import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCapabilities } from "@/lib/capabilities";

const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL || "/api/v1";

/**
 * Upgrades notification freshness from the 60s unread-count poll to
 * near-real-time via `GET /me/notifications/stream` (Server-Sent Events) —
 * see `backend/docs/openapi.json`. Only connects when the backend advertises
 * the capability (`/meta/capabilities.sseNotifications` — this is an
 * environment-toggleable feature flag, disabled in some deployments) and the
 * caller is authenticated. Falls back to nothing (pure polling continues to
 * work unmodified) when the capability is off, matching the backend's own
 * documented "polling remains supported" design.
 */
export function useNotificationStream(enabled: boolean) {
  const queryClient = useQueryClient();
  const { data: capabilities } = useCapabilities();

  React.useEffect(() => {
    if (!enabled || !capabilities?.sseNotifications) return;

    const source = new EventSource(`${API_BASE_URL}/me/notifications/stream`, { withCredentials: true });

    source.addEventListener("notification", () => {
      queryClient.invalidateQueries({ queryKey: ["me", "notifications"] });
    });

    // Deliberately no onerror-triggered reconnect loop: EventSource already
    // auto-reconnects on transient drops per the `retry:` field the backend
    // sends, and the browser tab losing focus/network is exactly when
    // hammering the server-capped `maxConnectionsPerUser` would be worst.
    return () => source.close();
  }, [enabled, capabilities?.sseNotifications, queryClient]);
}
