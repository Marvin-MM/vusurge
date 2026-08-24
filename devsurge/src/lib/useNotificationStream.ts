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

    let source: EventSource | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;
    let failedConnections = 0;
    let openedAt = 0;

    const scheduleReconnect = () => {
      if (disposed || document.visibilityState === "hidden") return;
      const exponentialDelay = Math.min(1_000 * 2 ** failedConnections, 30_000);
      const jitter = Math.floor(Math.random() * 500);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, exponentialDelay + jitter);
    };

    const connect = () => {
      if (disposed || document.visibilityState === "hidden") return;
      source?.close();
      source = new EventSource(`${API_BASE_URL}/me/notifications/stream`, { withCredentials: true });
      openedAt = Date.now();

      source.addEventListener("notification", () => {
        queryClient.invalidateQueries({ queryKey: ["me", "notifications"] });
      });
      source.addEventListener("unavailable", () => {
        queryClient.invalidateQueries({ queryKey: ["me", "notifications"] });
      });
      source.onerror = () => {
        source?.close();
        source = null;
        // A connection that survived normal proxy idle windows was healthy;
        // otherwise increase backoff so a broken development proxy or an
        // unavailable dependency cannot create a rapid reconnect loop.
        failedConnections = Date.now() - openedAt >= 30_000 ? 0 : Math.min(failedConnections + 1, 5);
        scheduleReconnect();
      };
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        source?.close();
        source = null;
      } else if (!source && reconnectTimer === undefined) {
        failedConnections = 0;
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [enabled, capabilities?.sseNotifications, queryClient]);
}
