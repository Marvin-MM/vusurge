# ADR 0005 — Separate Redis deployments for cache and for BullMQ

Status: Accepted
Date: 2026-08-16

## Context

Two workloads want Redis, and they want opposite things from it.

The **cache** holds public listings, dashboard summaries, and rate-limit
counters. Every entry is reconstructible from PostgreSQL. Losing it costs
latency. It wants a bounded memory limit and a TTL-friendly eviction policy such
as `allkeys-lru`.

**BullMQ** stores job hashes, wait lists, and delayed-job sorted sets. These are
not a cache: evicting a job hash under memory pressure silently destroys work
that the outbox believes is in flight. BullMQ's own production guidance requires
`maxmemory-policy=noeviction`.

Using two logical database numbers on one server does **not** resolve this.
`maxmemory` and `maxmemory-policy` are configured per server, not per database,
so both workloads would share whichever policy is set — either the cache never
evicts and the server fills, or the queue evicts and silently loses jobs.

## Decision

Run two physically separate Redis deployments in production:

| Deployment | Policy | Persistence | On loss |
|---|---|---|---|
| Cache / rate limit | `allkeys-lru`, bounded `maxmemory` | none needed | degrade to PostgreSQL |
| Queue (BullMQ) | `noeviction` | AOF `everysec` | jobs replayed from the outbox |

Configuration validation rejects a production deployment where
`CACHE_REDIS_URL` and `QUEUE_REDIS_URL` are the same, and the queue connection
verifies `maxmemory-policy` at startup — refusing to start in production and
logging a warning elsewhere. Managed providers that disable `CONFIG GET` fall
back to a warning, with the responsibility documented for operators.

The two connections also differ in client configuration. BullMQ requires
`maxRetriesPerRequest: null` because it blocks on connections for long periods;
the cache client uses a small bound and a short command timeout so a failing
command fails fast instead of stalling a request.

## Consequences

- Two Redis instances to operate. The local development stack runs both
  (ports 56380 and 56381) so the separation is exercised, not just documented.
- CI runs two Redis services for the same reason: testing against one server
  would hide precisely the misconfiguration this ADR exists to prevent.
- Cache loss is survivable by design: the cache sits behind a circuit breaker
  that fails fast and falls back to PostgreSQL, recording degraded-mode metrics.
- Queue loss is survivable because the durable record of every required side
  effect is the PostgreSQL outbox, not Redis. See ADR 0006.
