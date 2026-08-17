# ADR 0004 — Durable PostgreSQL sessions, not Redis-only

Status: Accepted
Date: 2026-08-16

## Context

A session is the credential that stands between a cookie and every action a
user takes. If it lived only in Redis — a store this system deliberately
treats as disposable (ADR 0005, ADR 0017) — a cache flush, an eviction under
memory pressure, or an operator restart would silently sign out every active
user simultaneously. That is an availability failure masquerading as a
security one.

## Decision

Better Auth's session table (`session`) lives in PostgreSQL, the same
authoritative database as everything else. `session.cookieCache` is enabled
with a short (60 second) TTL purely as a read-latency optimisation on top of
the durable store — it is never the only copy of a session, and losing it
costs a cache-miss database read, not a forced re-login.

The session cookie itself is opaque, HttpOnly, and `Secure` in production
(`advanced.useSecureCookies`), with a host-only scope unless
`AUTH_COOKIE_DOMAIN` is explicitly configured for a genuine cross-subdomain
deployment. It is never placed in `localStorage` or made readable to page
script.

## Consequences

- Session validity survives a Redis restart, flush, or outage. The cache
  Redis being explicitly non-authoritative (ADR 0005) extends cleanly to
  sessions rather than needing a special case.
- Every authenticated request pays one indexed PostgreSQL lookup (or a cache
  hit inside the 60-second window) — a deliberate, small cost for not making
  authentication depend on a store this system otherwise treats as disposable.
- Session revocation (sign-out, "sign out everywhere") is a straightforward
  delete against the authoritative table, with no cache-invalidation race to
  reason about.
