# ADR 0002 — A modular monolith, not microservices

Status: Accepted
Date: 2026-08-16

## Context

The domain spans identity, organizations, challenges, teams, submissions,
judging, notifications, analytics, support, moderation, and an innovation
portfolio. That breadth invites a service-per-domain split.

The invariants tell a different story. A final submission must atomically check
the organization is active, the challenge still accepts submissions according to
database time, the actor is an approved participant on the owning team, the team
satisfies its size constraints, every required field exists, and the required
terms are accepted — then write an immutable version, an audit record, and an
outbox event. Split across services, that single transaction becomes a
distributed saga with compensating actions, and the deadline check becomes
advisory. The correctness cost is severe and the scaling benefit is speculative.

## Decision

Build one deployable codebase, run as two process roles:

- **API** — serves HTTP, horizontally stateless apart from PostgreSQL and
  explicitly non-authoritative caches.
- **Worker** — runs the outbox dispatcher and BullMQ consumers.

Internal structure is enforced by a strict, uniform module layering:

```
DTO → Repository → Service → Controller → Route
```

with fixed filenames per module (`<module>.dto.ts`, `.repository.ts`,
`.service.ts`, `.controller.ts`, `.route.ts`). Responsibilities are strict:
repositories never call an external provider, controllers never touch Prisma,
services own transaction boundaries and permission checks.

Dependencies are wired by explicit constructor injection assembled in a single
composition root (`src/container.ts`, `src/app.ts`). There is no DI container:
the dependency graph is a value that can be read top to bottom, and a test can
substitute any single edge.

Explicitly excluded: Kafka, RabbitMQ, NATS, Elasticsearch/OpenSearch, a service
mesh, and per-module Clean Architecture / hexagonal / CQRS folder hierarchies.

## Consequences

- Transactional invariants stay in one PostgreSQL transaction, which is what
  makes the deadline, team-capacity, join-code, and last-owner guarantees
  achievable at all.
- Scaling is done by adding API replicas and worker replicas, then by indexes,
  rollups, and read replicas — in that order (see the performance ordering in
  the master prompt, section 52).
- The uniform layering is what keeps a monolith from becoming a ball of mud: a
  reviewer can open any module and know where authorization lives.
- If a genuine independent-scaling boundary emerges later, the module layering
  gives a clean seam to extract along. Nothing here forecloses that; it just
  refuses to pay for it upfront.
