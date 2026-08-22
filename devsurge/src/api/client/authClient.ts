import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const metaEnv = (import.meta as any).env || {};
const apiBaseUrl: string = metaEnv.VITE_API_BASE_URL || "/api/v1";

/**
 * Better Auth is mounted on the backend as a catch-all at
 * `${AUTH_BASE_PATH}/*` (default `/api/v1/auth`) — this client talks to
 * that exact mount, not a hand-rolled auth API. Every sign-up/sign-in/
 * sign-out/session/2FA/OAuth-callback endpoint below is Better Auth's own,
 * unchanged from the backend's default routing.
 */
export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl.replace(/\/$/, "")}/auth`,
  // The backend and frontend run on different ports/origins in every
  // environment this app targets — cookies must be sent and stored
  // cross-origin explicitly, matching the backend's CORS `credentials: true`
  // + explicit origin allowlist (see backend/docs/env-reference.md).
  fetchOptions: {
    credentials: "include",
  },
  plugins: [twoFactorClient()],
});

// Re-exported for convenience at call sites; the full client (below) also
// exposes requestPasswordReset/resetPassword/changePassword/getSession and
// every other Better Auth endpoint — use `authClient.<method>` directly for
// anything not re-exported by name here.
export const { useSession, signIn, signUp, signOut, twoFactor } = authClient;
