/**
 * CSRF token lifecycle, kept entirely out of feature query hooks.
 *
 * The backend requires an `x-csrf-token` header (HMAC-bound to the session)
 * on every unsafe request once a session cookie exists — see
 * backend/docs/env-reference.md's CSRF note. This module fetches it from
 * `GET /me/csrf-token`, caches it in memory only (never localStorage, since
 * it is session-bound and must not outlive the tab/session), and dedupes
 * concurrent fetches with a single in-flight promise.
 */

const metaEnv = (import.meta as any).env || {};
const apiBaseUrl: string = metaEnv.VITE_API_BASE_URL || "/api/v1";

let cachedToken: string | null = null;
let inFlight: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/me/csrf-token`, {
    method: "GET",
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to obtain a CSRF token (status ${response.status}).`);
  }
  const body: { csrfToken: string } = await response.json();
  return body.csrfToken;
}

/** Returns the cached token, or fetches (and caches) a fresh one. */
export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (!inFlight) {
    inFlight = fetchCsrfToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Forces the next `getCsrfToken()` call to fetch a new token. */
export function invalidateCsrfToken(): void {
  cachedToken = null;
}

/** Called on logout/session-expiry: the cached token is no longer valid for anything. */
export function clearCsrfToken(): void {
  cachedToken = null;
  inFlight = null;
}
