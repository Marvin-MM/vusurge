# ADR 0009 — HTTP and polling before SSE, and never WebSockets

Status: Accepted
Date: 2026-08-16

## Context

In-app notifications (master prompt section 19) need a delivery path to the
client. The obvious "real-time" options range from plain polling through
Server-Sent Events to a full WebSocket connection. Master prompt section
34.38 explicitly frames SSE as optional ("If enabled") and section 2's
non-goals rule out WebSockets and in-app chat entirely.

## Decision

The notifications module (`GET /api/v1/me/notifications`,
`GET /api/v1/me/notifications/unread-count`) is built as an ordinary
polled REST resource — cursor-paginated, filterable by `unreadOnly` — and
that is the only delivery path actually implemented. `config.features.sseNotifications`
exists as a startup flag (default `false`) precisely so a future SSE stream
at `GET /api/v1/me/notifications/stream` can be added later without a
breaking change, but no route currently exists behind it: turning the flag on
today would gate nothing, so it stays off until the stream is built.

No WebSocket server exists anywhere in this codebase, and none is planned —
notifications are the only case that would plausibly want push delivery, and
polling already satisfies it at the scale this platform targets.

## Consequences

- Every client integration works today against plain polling; nothing is
  blocked on an unimplemented real-time transport.
- Adding SSE later is additive: a new route, a new outbox-event-to-stream
  bridge, gated by the flag that already exists — not a redesign of the
  notifications module's data model or REST surface, both of which are
  already correct independent of transport.
- The backend never holds a long-lived per-client connection today, which
  keeps worker/API process scaling simple (stateless HTTP request/response
  only) and sidesteps the operational cost of WebSocket connection draining
  during deploys.
