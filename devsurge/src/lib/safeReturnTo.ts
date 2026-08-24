/**
 * Accept only application-local navigation targets. Authentication links are
 * attacker-controlled input, so passing a raw `returnTo` to the router would
 * otherwise create an open-redirect/phishing primitive through `//host` or an
 * absolute URL.
 */
export function safeReturnTo(value: string | null | undefined, fallback = "/app"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const base = "https://local.invalid";
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
