# Architecture Decision Records

Each record states the context that forced a decision, the decision itself, and
the consequences the team accepted. They are written when the decision is made
and the code that embodies it exists — an ADR here never describes behaviour
that has not been implemented.

## Accepted

| ADR | Decision | Phase |
|---|---|---|
| [0001](0001-shared-schema-organization-id-tenancy.md) | Shared-schema multi-tenancy keyed on `organization_id` | 0 |
| [0002](0002-modular-monolith-over-microservices.md) | A modular monolith, not microservices | 0 |
| [0003](0003-better-auth-custom-domain-authorization.md) | Better Auth for identity, custom domain authorization | 1 |
| [0004](0004-durable-postgresql-sessions.md) | Durable PostgreSQL sessions rather than Redis-only sessions | 1 |
| [0005](0005-redis-separation-cache-vs-queue.md) | Separate Redis deployments for cache and BullMQ | 0 |
| [0006](0006-transactional-outbox.md) | Transactional outbox for asynchronous side effects | 0 |
| [0007](0007-cloudinary-image-only-automatic-delivery.md) | Cloudinary for images only, automatic delivery format | 2 |
| [0008](0008-s3-private-object-storage.md) | S3-compatible private object storage for exports and documents | 5 |
| [0009](0009-http-polling-before-sse-no-websockets.md) | HTTP and polling before SSE, and never WebSockets | 5 |
| [0010](0010-challenge-scoped-teams.md) | Challenge-scoped teams | 3 |
| [0011](0011-immutable-submission-versions.md) | Immutable submission versions | 3 |
| [0012](0012-versioned-rubrics-no-live-leaderboard.md) | Versioned rubrics and no live judging leaderboard | 4 |
| [0013](0013-public-projection-views.md) | Curated SQL views for every public projection | 1 |
| [0014](0014-post-challenge-innovation-portfolio.md) | Post-challenge innovation portfolio | 6 |
| [0015](0015-runtime-db-role-and-rls.md) | Least-privilege runtime role, RLS, transaction-local tenancy | 0 |
| [0016](0016-no-gmail-smtp-fallback.md) | Resend only; no Gmail SMTP fallback | 1 |
| [0017](0017-no-generic-postgresql-circuit-breaker.md) | No circuit breaker in front of PostgreSQL | 0 |
| [0018](0018-typescript-7-toolchain.md) | TypeScript 7 as the typechecker | 0 |
| [0019](0019-prisma-7-generated-client-and-typedsql.md) | Prisma 7 driver adapter, committed client, TypedSQL scope | 0 |
| [0020](0020-tenant-transaction-access-modes.md) | Four tenant-transaction access modes, not one RLS bypass | 1 |

All ADRs required by master prompt section 56 are now written; nothing is
outstanding.
