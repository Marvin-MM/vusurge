# ADR 0017 — No circuit breaker in front of PostgreSQL

Status: Accepted
Date: 2026-08-16

## Context

A circuit breaker is a good pattern for an **optional** dependency: it stops a
caller from queueing behind a dead service and lets it degrade to a fallback.
Applying the same pattern to the authoritative database is a category error.
There is no fallback for "the source of truth is unreachable". A breaker there
converts a clear, retryable failure into a confusing one, and tempts the code
into serving stale cached state as though it were authoritative.

## Decision

PostgreSQL is a hard dependency. There is no breaker, no degraded write mode,
and no cache-backed substitute for an authoritative read. If the database is
unavailable, business operations fail clearly with `503` and a
`DEPENDENCY_UNAVAILABLE` code.

Resilience comes from the mechanisms that actually help:

- a bounded connection pool sized by configuration;
- explicit connection, statement, transaction, and lock timeouts, set on the
  role so they survive pooling;
- retries for **retryable failures only** — serialization failures (`40001`) and
  deadlocks (`40P01`), with bounded attempts and jittered backoff. Constraint
  violations, permission errors, and connectivity failures are never retried,
  because retrying them just repeats the same failure while holding capacity;
- a readiness endpoint that reports PostgreSQL as a required dependency, so an
  unhealthy replica is removed from rotation rather than serving errors;
- slow-query logging above a configurable threshold, with query templates but
  never parameters, which can contain personal data and tenant content;
- pool saturation exposed as a metric.

Circuit breakers **are** used, but only where a fallback genuinely exists: the
cache (fall back to PostgreSQL) and outbound third-party providers (fail the
delivery, record it, retry later).

## Consequences

- A database outage is a visible outage. That is the correct behaviour: the
  alternative is silently accepting a submission after a deadline because a
  cached challenge record said the window was open.
- The retry classifier must understand how the driver reports SQLSTATE. Prisma 7
  with the pg adapter surfaces its own `P2010` and nests the real SQLSTATE at
  `meta.driverAdapterError.cause.originalCode`; reading only the top level would
  silently disable the retry path. This is covered by a regression test.
- Callers see a stable, documented failure mode rather than a breaker's
  half-open flapping.
