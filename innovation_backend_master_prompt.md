# BUILD PROMPT

Use the complete contents of the master prompt below as the canonical implementation instruction.

Do not reduce it to a high-level feature list. Treat its architecture decisions, security constraints, endpoint contract, data-isolation rules, lifecycle rules, non-goals, testing requirements, and Definition of Done as binding requirements.

Before implementation, inspect the repository and current official documentation for the selected stack. Then implement the backend phase-by-phase until the complete scoped system is functional, migration-backed, tested, documented, and production-ready. Do not stop at scaffolding, pseudocode, TODOs, mocked core workflows, or partially wired modules.

Where the repository and prompt disagree, preserve existing work only when it satisfies or exceeds the prompt's correctness, security, tenancy, and maintainability requirements. Where a current stable library has materially changed since the architecture research baseline, use the current stable production-ready API while preserving the architectural intent and document any significant deviation in an ADR.

Do not build a frontend.


# Master Implementation Prompt — Production Backend for a Multi-Tenant Innovation Management Platform

## 0. Your role and mission

You are the principal backend engineer and implementation agent responsible for building the complete production-grade backend for a multi-tenant Innovation Management Platform.

Build the backend only. Do not build a frontend, web UI, mobile UI, in-platform chat UI, or unrelated client application.

This prompt is the implementation contract. Treat every requirement marked REQUIRED, MUST, MUST NOT, or NON-NEGOTIABLE as binding. Where a low-level implementation detail is not explicitly specified, choose the simplest production-safe option that is consistent with this contract, current official documentation, the selected technology stack, and the existing repository.

Do not stop at scaffolding. Do not leave core flows as TODOs, placeholders, mocks, fake implementations, commented stubs, or “future work” if they are in the defined scope. The result must be runnable, testable, documented, migration-backed, and ready to deploy after environment-specific secrets and infrastructure are supplied.

If the repository already contains code:
- inspect it before changing anything;
- preserve sound existing work that matches this contract;
- refactor only where required to meet the architecture;
- do not delete unrelated files or rewrite the entire repository merely for stylistic reasons;
- do not introduce a frontend;
- do not silently change public contracts without updating OpenAPI, tests, and documentation.

If the repository is empty:
- initialize the backend as a single Bun package;
- create one codebase with two production process entry points: HTTP API and BullMQ worker;
- keep the backend a modular monolith.

Before installing dependencies, verify current stable releases and Bun compatibility using official documentation. Pin tested versions in the lockfile and deployment environment. Do not choose alpha, beta, RC, nightly, or “next” releases for core production dependencies unless no stable supported version exists and the tradeoff is explicitly documented in an ADR. In particular, use the current stable Elysia and Prisma releases that are production-ready at implementation time rather than blindly following an old version number.

Do not ask for product clarification when this prompt already specifies the behavior. Make reasonable implementation decisions and record meaningful architecture decisions in ADRs.

---

# 1. Product definition

Build a multi-tenant innovation management platform used by university clubs, communities, companies, NGOs, accelerators, innovation hubs, and similar organizations.

The initial product is challenge-centric but the backend must also support the post-challenge innovation lifecycle:

1. organization application and governance;
2. membership and access control;
3. challenge/opportunity definition;
4. participant registration and screening;
5. team formation and matchmaking;
6. innovation/project submission;
7. judging and evaluation;
8. finalist/winner publication;
9. post-challenge promotion into an innovation portfolio;
10. milestones, stage-gates, evidence, metrics, and outcome tracking;
11. analytics, exports, support, moderation, notifications, and audit.

A user may have zero, one, or many organization memberships simultaneously.

A user account is global. A tenant is an organization. Tenant-owned records are stored in shared PostgreSQL tables and isolated by `organization_id`.

The platform has four logical surfaces, but this task builds only the backend APIs that serve them:

- Public surface: unauthenticated public organizations, public challenges, public announcements/FAQs, published results, approved public project/innovation data, and approved public aggregate metrics.
- Authenticated participant/member surface: profile, organizations, invitations, join codes, challenge participation, teams, submissions, notifications, support tickets, and released feedback.
- Organization administration surface: members, invitations, join requests, challenges, forms, participant screening, teams, submissions, judges, rubrics, announcements, integrations, analytics, exports, audit, and innovation portfolio.
- Platform administration surface: organization application review, organization activation/suspension, moderation, support, platform limits/flags where needed, security/audit investigation, and aggregate operational administration.

---

# 2. Non-negotiable architecture

## 2.1 Architecture style

Use a modular monolith. Do not split this system into microservices.

Run the same codebase as:
- an API process; and
- one or more worker processes.

The API must remain horizontally stateless except for durable state in PostgreSQL and explicitly non-authoritative caches.

Do not introduce Kafka, RabbitMQ, NATS, Elasticsearch/OpenSearch, a service mesh, or distributed microservices.

## 2.2 Required module layering

For every business module, preserve this exact logical flow:

DTO → Repository → Service → Controller → Route

Use filenames in this convention:

- `<module>.dto.ts`
- `<module>.repository.ts`
- `<module>.service.ts`
- `<module>.controller.ts`
- `<module>.route.ts`

Do not replace this with Clean Architecture folders, hexagonal ports/adapters folders per module, CQRS command/query folders, “use-case” folders, generic base repositories, or deep feature nesting.

Responsibilities are strict:

DTO:
- Elysia request/response schemas;
- validation contracts;
- normalization definitions;
- safe public response models;
- no database access;
- no authorization decisions;
- no business workflows.

Repository:
- Prisma, TypedSQL, and carefully parameterized raw SQL only;
- tenant-scoped persistence and queries;
- no HTTP objects;
- no Elysia context;
- no email, Cloudinary, BullMQ, or third-party integrations;
- no business authorization policy beyond predicates supplied by services.

Service:
- business rules;
- permission checks;
- transaction boundaries;
- lifecycle transitions;
- concurrency handling;
- audit and outbox writes;
- coordination across repositories and infrastructure abstractions.

Controller:
- convert validated HTTP context to a service call;
- map domain/application errors to the common error system;
- no direct Prisma access;
- no business rules.

Route:
- register Elysia routes;
- compose authentication/authorization middleware;
- attach validation schemas;
- bind controllers;
- provide OpenAPI metadata.

Keep `shared` for infrastructure concerns only. Do not turn it into a dumping ground for business logic.

Use explicit constructor/manual dependency injection assembled in a composition root. Do not introduce a large DI container.

## 2.3 Target source organization

The business module set must include at least:

- identity
- users
- organizations
- memberships
- invitations
- organization-applications
- challenges
- forms
- participation
- teams
- matchmaking
- submissions
- judging
- announcements
- notifications
- media
- analytics
- integrations
- innovation-portfolio
- support
- audit
- moderation
- platform-admin

Add a narrowly scoped `search` module if needed for search/discovery. Add a narrowly scoped `exports` module only if separating export orchestration from analytics materially improves clarity.

Infrastructure belongs under `shared`, including:
- database
- auth
- authorization
- cache
- queue
- email
- object storage
- image storage
- observability
- logging
- security
- rate limiting
- time
- IDs
- configuration
- errors
- idempotency
- encryption

Tests may live in a separate `tests` hierarchy. Do not violate the five-file business-module convention merely to co-locate tests.

---

# 3. Required technology stack

Use:

- Bun, latest tested stable release at implementation time, pinned.
- TypeScript in strict mode.
- Elysia, current tested stable release compatible with selected Bun.
- PostgreSQL as the authoritative relational database.
- Prisma ORM for normal schema, migrations, transactions, and CRUD.
- Prisma TypedSQL for complex, performance-sensitive, or PostgreSQL-specific queries where appropriate.
- Parameterized raw SQL only when Prisma/TypedSQL cannot correctly express required PostgreSQL capabilities such as some RLS policies, views, advanced indexes, or administrative operations.
- Better Auth for identity/authentication.
- Better Auth Elysia integration.
- Better Auth Prisma adapter.
- Better Auth 2FA capability for platform-superadmin MFA and optional user MFA where supported.
- Cookie-based sessions.
- Redis for cache, rate limiting, and other non-authoritative ephemeral state.
- A separate Redis deployment/instance for BullMQ in production where feasible.
- BullMQ for async/retryable work.
- ioredis for BullMQ and any integration that requires it. Avoid mixing Redis clients without a clear operational reason.
- Resend for transactional email.
- Cloudinary for image storage only.
- S3-compatible private object storage for generated exports and, when enabled, non-image uploaded documents. Use a production provider via the S3 API and MinIO or equivalent only for local development.
- OpenTelemetry for traces and metrics, exported through OTLP or a compatible collector/backend.
- Elysia OpenAPI integration for generated API documentation.
- Elysia validation for static DTOs.
- AJV or another mature JSON Schema validator for organizer-defined dynamic forms.
- Biome, or an equally strict single formatter/linter if there is a compatibility reason not to use Biome.
- TypeScript compiler type-checking using `tsc --noEmit`.
- Bun’s test runner for unit/integration/E2E tests unless a specific unsupported testing need requires another runner.
- A Bun-compatible structured JSON logger. Prefer a mature logger such as Pino only after verifying Bun compatibility; otherwise implement the smallest reliable structured logging adapter without losing correlation IDs or levels.

Do not add a package simply because it is fashionable. Every production dependency increases security and upgrade surface.

---

# 4. Explicit replacements of weak design choices

These rules override any earlier informal idea that conflicts with them.

## 4.1 Authentication sessions

Do not make Redis the sole authoritative session store.

Use durable database-backed Better Auth sessions in PostgreSQL. A short cookie/session cache or Redis acceleration may be used only if the selected Better Auth version safely supports it without making Redis the only durable source.

Cookie sessions must be opaque, HttpOnly, Secure in production, and configured with a conservative SameSite policy compatible with OAuth.

Never place browser-readable long-lived access tokens in localStorage.

## 4.2 Email

Use Resend as the initial production transactional provider.

Do not implement Gmail SMTP or Nodemailer-over-Gmail as a fallback.

Place Resend behind a small `EmailProvider` abstraction so a real second transactional provider can be added later if contractual redundancy is required.

## 4.3 PostgreSQL resilience

Do not put PostgreSQL behind a generic circuit breaker.

Use:
- managed HA PostgreSQL;
- bounded connection pools;
- connection timeout;
- statement timeout;
- transaction timeout where appropriate;
- safe retry for retryable connectivity/serialization failures only;
- readiness checks;
- slow query monitoring;
- overload protection.

If PostgreSQL is unavailable, authoritative business operations should fail clearly rather than pretending to continue with invalid cached state.

## 4.4 Redis resilience

A circuit breaker/fail-fast path is appropriate for optional cache access.

Cache failure must degrade to PostgreSQL reads where safe.

BullMQ Redis must follow BullMQ’s production connection and persistence guidance; do not hide queue semantics behind a generic cache-style breaker.

## 4.5 Redis topology

Production should use:
- Queue Redis for BullMQ with `maxmemory-policy=noeviction`.
- Cache/rate-limit Redis with a TTL-friendly eviction policy appropriate to the deployment.

Do not rely on different Redis logical database numbers for resource or memory-policy isolation.

## 4.6 WebSockets

Do not implement WebSockets in the initial backend.

Use ordinary HTTP for application operations.

Use normal polling for dashboards and unread counts by default.

Implement SSE only for one-way notification/dashboard streaming if it is enabled by configuration and the endpoint is useful; polling must remain a valid fallback.

## 4.7 Cloudinary image format

Do not force every original image to be permanently stored only as WebP.

Use secure original/authenticated assets and Cloudinary transformation/delivery optimization. Prefer automatic browser-appropriate formats and quality at delivery time.

If a canonical optimized derivative is useful for cost control, it may be generated, but the system must not lose private-delivery capability or future reprocessing flexibility.

## 4.8 Leaderboards

Do not expose a continuously updating leaderboard while judging is in progress.

Scores stay private until judging is finalized and an organizer explicitly publishes results.

## 4.9 Important lifecycle changes

Do not use a generic “PATCH status” endpoint for sensitive state changes such as publish, deadline extension, reopen, cancellation, judging finalization, scorecard reopen, or result publication.

Use explicit action endpoints with explicit authorization, reasons where required, audit events, and transactional outbox events.

## 4.10 Innovation scope

Do not model the platform as only “hackathons + submissions.”

Implement the post-challenge innovation portfolio seam described in this prompt.

---

# 5. Core domain actors and authorization model

## 5.1 Actors

Support:
- anonymous visitor;
- authenticated platform user with no organization;
- organization member;
- challenge participant;
- team captain;
- organization admin;
- organization owner;
- challenge manager;
- judge;
- mentor;
- platform support agent capability if platform staff separation is implemented;
- platform superadmin;
- system/worker actor.

## 5.2 Roles

Global:
- PLATFORM_SUPERADMIN.

Organization:
- ORG_OWNER;
- ORG_ADMIN;
- CHALLENGE_MANAGER;
- MEMBER.

Challenge-scoped:
- JUDGE;
- MENTOR.

Do not implement arbitrary organization-defined role builders in this release.

Do not treat platform superadmin as an ordinary organization member.

Platform-admin access to private tenant data must be purpose-based, explicitly authorized by platform routes, logged, and auditable. Do not create a casual “view everything” bypass.

## 5.3 Permission system

Implement explicit named permissions and a central authorization policy layer. Examples include:
- organization.view_private
- organization.manage_settings
- organization.manage_members
- organization.manage_roles
- organization.manage_integrations
- organization.view_audit
- challenge.create
- challenge.edit
- challenge.publish
- challenge.change_schedule
- challenge.manage_participants
- challenge.manage_judges
- challenge.manage_rubric
- challenge.publish_results
- submission.create
- submission.edit_own
- submission.submit
- submission.view_all
- submission.disqualify
- judging.view_assigned
- judging.score_assigned
- judging.finalize
- analytics.view_org
- analytics.export_sensitive

Use deny-by-default behavior.

Every authorization decision for a tenant object must check:
- authenticated actor where required;
- organization status;
- tenant membership/role or explicit challenge assignment;
- resource belongs to route organization;
- action-specific lifecycle/state rules.

Do not trust IDs, hidden fields, client-supplied active organization, or UUID unpredictability as authorization.

---

# 6. Multi-tenancy and PostgreSQL isolation

## 6.1 Tenant model

`organization_id` is the tenant key.

Every organization-owned table must carry a non-null `organization_id` even when the organization could be inferred through another relation.

This includes, at minimum:
- challenge;
- challenge track;
- challenge schedule change;
- challenge forms;
- challenge participation;
- team;
- team membership;
- team invitations;
- matchmaking posts;
- submission;
- submission versions/assets where practical;
- judging assignments and scorecards;
- announcements;
- FAQs;
- organization notifications/events;
- integrations;
- analytics rollups;
- innovation portfolio objects;
- organization-specific audit events.

## 6.2 Composite same-tenant integrity

Use composite unique keys and composite foreign keys for important tenant-owned relations so PostgreSQL rejects cross-tenant references even if application code is wrong.

Apply this to relationships such as:
- submission → challenge;
- submission → team;
- track → challenge;
- team → challenge;
- participation → challenge;
- judge assignment → challenge/submission;
- scorecard → judge assignment/submission;
- forms attached to a challenge;
- portfolio item → source submission;
- any other relation whose IDs could otherwise be mixed across organizations.

## 6.3 Row-Level Security

Use PostgreSQL RLS as defense in depth on sensitive tenant tables.

The ordinary runtime DB role:
- must not own tenant tables;
- must not be superuser;
- must not have BYPASSRLS;
- should have least privilege.

The migration/owner role is separate.

Tenant context must be set transaction-locally inside the same transaction as tenant-scoped reads/writes. Never use a connection-global tenant setting that can leak through a pool.

Because Prisma may use pooled connections, never assume a tenant session variable survives safely outside the explicit transaction that set it.

Build a narrow shared tenant-transaction helper so services can:
- open a transaction;
- set the organization context transaction-locally;
- execute repositories through the same transaction client;
- commit/rollback atomically.

Application authorization remains mandatory even when RLS exists.

## 6.4 Public projections

Do not serialize tenant base tables directly from public routes.

Create curated public-safe SQL views or equivalent projection tables for:
- public organizations;
- public challenges;
- published results/public projects;
- approved public aggregate metrics where needed.

Public projections must include only safe fields and must automatically exclude:
- inactive/suspended/private organizations;
- unpublished/private challenges;
- private submissions;
- judge identities/comments unless explicitly public;
- private member data;
- private media;
- support data;
- audit data.

If using database views over RLS-protected tables, configure view security semantics deliberately and test them. Do not assume view behavior is safe by default.

## 6.5 Cache tenancy

Namespace tenant cache keys by `organization_id`.

Never cache an authorization-bearing value using only a resource ID when the code path may serve multiple tenants.

Never cache authoritative privilege state for long TTLs.

---

# 7. Identity, auth, sessions, and account security

Use Better Auth rather than custom authentication.

Required authentication capabilities:
- email/password signup;
- email verification;
- email/password sign-in;
- sign-out;
- password-reset request and reset;
- Google OAuth;
- GitHub OAuth;
- session listing/revocation where supported;
- optional user 2FA;
- mandatory 2FA for PLATFORM_SUPERADMIN;
- secure account linking only where provider/email verification rules make it safe.

Require a verified email before:
- organization membership can be granted through an invitation;
- join-code redemption can create membership;
- an organization application can be submitted;
- challenge-scoped staff invitation acceptance where email-bound.

Account linking:
- only trusted configured providers;
- never link accounts solely because unverified email strings match;
- do not allow an OAuth account-linking flow to become an account-takeover path.

Sensitive operations require a fresh session and, for superadmins, MFA. This includes:
- ownership transfer;
- elevated role grants;
- organization suspension/reinstatement;
- primary email changes;
- MFA reset;
- highly sensitive exports;
- platform role changes.

Do not implement admin impersonation in this release.

Cookie/auth security:
- HttpOnly;
- Secure in production;
- host-only where deployment topology permits;
- trusted origins;
- correct OAuth redirect handling;
- no state-changing GET routes;
- CSRF protection for cookie-authenticated unsafe methods using SameSite plus strict Origin/Referer validation and an additional session-bound CSRF mechanism where needed.

Expose Better Auth under a documented versioned auth base path if supported cleanly by the selected stable version. Do not reimplement Better Auth’s internal auth handlers merely to make their route names match this document.

---

# 8. Organization model and lifecycle

Organization lifecycle:
- PENDING_REVIEW application;
- ACTIVE organization after platform approval;
- REJECTED application with ability to resubmit/reapply;
- SUSPENDED organization;
- ARCHIVED organization.

Organization registration flow:
1. user is authenticated;
2. email is verified;
3. user submits organization application;
4. platform superadmin reviews;
5. approval transaction creates/activates organization, grants ORG_OWNER membership to applicant, writes audit event, writes outbox event;
6. organization is operational only after approval;
7. default organization visibility is PRIVATE unless explicitly approved/configured otherwise.

Application data should include:
- name;
- requested slug;
- organization type;
- description;
- website/social links;
- country/region;
- affiliated institution where relevant;
- requester relationship;
- requested visibility;
- accepted terms/acceptable-use version;
- optional verification evidence metadata.

Owner safeguards:
- every active organization must have at least one active owner;
- last owner cannot be removed or demoted;
- ownership transfer is explicit, transactional, fresh-auth protected, and audited;
- org owner cannot override platform suspension.

Separate organization visibility from join policy.

Organization visibility:
- PRIVATE;
- PUBLIC.

Default PRIVATE.

PUBLIC means the organization may be discoverable. It does not mean anyone may join.

Organization join policies in scope:
- INVITE_ONLY;
- CODE_OR_INVITE;
- REQUEST_TO_JOIN.

Do not enable completely OPEN membership in this release. If the schema reserves the enum for future use, it must not be activatable through production APIs yet.

Support organization settings and organization profile independently from platform application state.

---

# 9. Invitations, join codes, and organization join requests

## 9.1 Direct organization invitations

Invitation requirements:
- organization;
- optional email binding;
- role to grant;
- cryptographically secure random token;
- only token hash stored;
- expiry;
- created by;
- accepted/revoked timestamps;
- single-use by default.

Do not store reusable plaintext invitation tokens.

Invitation acceptance must transactionally:
- verify invitation state and expiry;
- verify active organization;
- verify target email when bound;
- require verified email;
- prevent duplicate/conflicting membership;
- create membership;
- mark invitation accepted;
- write audit event;
- write outbox event.

## 9.2 Human join codes

Join codes must be high-entropy and rate-limited. Do not use guessable values like institution name plus year.

Store only a secure hash plus:
- organization;
- role granted, normally MEMBER only;
- expiry;
- usage limit;
- usage count;
- revocation state;
- optional email-domain restriction;
- creator;
- last-used metadata.

Redemption must be atomic. Enforce usage limit in the same transaction that creates membership.

## 9.3 Optional onboarding code

A newly authenticated user may enter a join code during onboarding, but code entry is optional.

A valid user may exist indefinitely with zero organizations.

## 9.4 Join requests

For organizations using REQUEST_TO_JOIN:
- authenticated verified users may submit a join request;
- an organization may optionally attach a versioned application form to the join process;
- org admins/owners can review;
- approval transaction creates membership, records decision, audit, and outbox;
- rejection has internal and user-visible reason fields where appropriate;
- duplicate active requests must be prevented.

---

# 10. Challenge domain

## 10.1 Challenge core fields

Model at least:
- id;
- organization_id;
- title;
- slug;
- summary;
- Markdown description;
- cover-image asset reference;
- visibility;
- administrative lifecycle status;
- publication timestamp;
- registration open/close timestamps;
- submission open timestamp;
- submission deadline timestamp;
- judging start/end timestamps;
- results publication timestamp;
- IANA display timezone;
- min/max team size;
- solo participation setting;
- screening requirement;
- participation policy;
- submission requirements;
- terms/IP/confidentiality version;
- public project publication policy;
- judging policy;
- created/updated actor metadata;
- version/concurrency metadata where useful.

Use PostgreSQL `timestamptz` for instants. Store the configured IANA timezone separately for display/scheduling context.

## 10.2 Challenge visibility

Support:
- ORG_MEMBERS;
- PUBLIC;
- UNLISTED.

UNLISTED means a challenge is not included in public discovery/listing but can be accessed by its permitted direct public route when the organization and challenge publication/privacy rules allow it. Never let UNLISTED bypass participation or submission authorization.

A challenge is effectively public only when:
- organization is ACTIVE;
- organization visibility is PUBLIC;
- challenge is published;
- challenge visibility permits public access.

Changing an organization from PUBLIC to PRIVATE must remove its challenges from public projections immediately.

## 10.3 Participation policy

Support:
- ORG_MEMBERS_ONLY;
- APPROVED_CHALLENGE_PARTICIPANTS;
- OPEN_AUTHENTICATED.

Default ORG_MEMBERS_ONLY.

OPEN_AUTHENTICATED allows an authenticated verified user to register for that challenge without organization membership only when an authorized organizer explicitly configures it. It must not grant organization membership.

## 10.4 Lifecycle

Support:
- DRAFT;
- SCHEDULED;
- OPEN;
- CLOSED;
- JUDGING;
- RESULTS_READY;
- RESULTS_PUBLISHED;
- ARCHIVED;
- CANCELLED.

The displayed/admin state may be persisted or derived, but security-critical eligibility must use authoritative timestamps and database/server time rather than trusting a delayed worker update.

Do not make a queue job authoritative for challenge opening or submission deadline enforcement.

## 10.5 Publishing and schedule changes

Publishing is explicit.

Deadline/schedule changes are high-value events. Record:
- actor;
- previous values;
- new values;
- reason;
- timestamp;
- request ID;
- organization/challenge;
- audit event;
- domain schedule-change record;
- outbox event.

Authorized challenge managers/admins/owners may extend deadlines.

Shortening a deadline after participant registration is blocked by default. If a higher-privilege override is implemented, require explicit reason, fresh confirmation semantics in the request contract, audit, and participant notifications.

Reopening after deadline requires explicit reopen action.

Affected participants receive notifications asynchronously.

Reminder jobs are deterministically rescheduled.

## 10.6 Tracks, prizes, sponsors

A challenge may have zero or more tracks.

Default one primary track per submission. Multi-track submission should only be enabled through an explicit challenge setting if implemented.

Prizes/bounties are informational records. Do not build payments, wallets, transfers, payouts, escrow, or billing.

Sponsors have public-safe fields and image assets.

Sponsor judging access must be granted through normal challenge-scoped judge authorization, not inferred from sponsor status.

---

# 11. Dynamic forms and screening

Build versioned dynamic forms:
- form definition;
- immutable form version;
- form response.

Supported field types:
- short text;
- long text;
- number;
- boolean;
- single select;
- multi-select;
- URL;
- date;
- consent checkbox;
- image/file reference only for explicitly supported upload purposes.

The form schema must be validated by AJV or an equivalent mature JSON-Schema implementation.

Do not allow executable scripts, arbitrary HTML, eval-like expressions, custom JS validators, or a workflow DSL in organizer-defined forms.

Use immutable versions so historical responses remain interpretable.

Forms may be used for:
- organization join request;
- challenge participation application;
- mentor/judge application where configured;
- post-event survey;
- portfolio stage-gate evidence collection.

Material changes require a new form version.

---

# 12. Challenge participation

Organization membership and challenge participation are distinct.

Participation states:
- PENDING;
- APPROVED;
- REJECTED;
- WITHDRAWN;
- DISQUALIFIED.

If a challenge does not require screening, successful eligible registration may immediately create APPROVED participation.

Registration must enforce:
- active organization/challenge;
- participation policy;
- membership when required;
- verified email;
- registration window;
- terms version acceptance;
- current application form version when screening is required;
- no duplicate active participation.

Admin decisions are audited.

Rejection should support:
- internal reason;
- safe participant-visible reason.

Demographic data is optional unless explicitly required and must be access-restricted. Do not include demographic data in public projections.

---

# 13. User profiles and skills

Global user profile should support:
- display name;
- avatar image;
- bio;
- optional location;
- skills;
- GitHub URL;
- LinkedIn URL;
- Discord handle or profile reference where appropriate;
- portfolio URL;
- profile visibility controls.

Use a normalized skill catalogue plus controlled custom skill values rather than a single unstructured skills string.

Never expose:
- account email by default;
- private memberships;
- demographic responses;
- support history;
- auth provider secrets/tokens.

Support a safe public/user profile projection respecting profile visibility.

---

# 14. Team formation

Teams are challenge-scoped.

Do not implement long-lived platform-global teams in this release.

Solo participation:
- normalize a solo submission to an implicit one-person challenge team so submissions and judging have one ownership model.

Team rules:
- one organization and one challenge;
- captain must be eligible participant;
- members must be eligible participants;
- min/max team size enforced transactionally;
- one active team per challenge per participant by default;
- team invitation is explicit and revocable;
- captain transfer has explicit rules;
- team changes after final deadline are locked unless authorized organizer exception with reason and audit;
- prevent cross-tenant or cross-challenge membership.

Concurrency:
- team-capacity checks must lock/serialize correctly;
- two users must not both take the last available slot.

## 14.1 Matchmaking

Build a challenge-scoped matchmaking board.

Post fields:
- user or team;
- skills offered;
- roles sought;
- short message;
- availability;
- contact preference;
- open/closed state.

Do not expose private email/phone details.

Use in-platform interest/invitation actions or user-approved public profile links.

Do not build machine-learning matching.

---

# 15. Submissions

## 15.1 Ownership

A submission belongs to:
- one organization;
- one challenge;
- one challenge team;
- optional primary track;
- one logical innovation/project.

By default, one logical submission per team per challenge.

## 15.2 Submission fields

Challenge-configurable requirements can include:
- project title;
- tagline/summary;
- problem statement;
- solution description;
- impact/beneficiaries;
- technology tags / Built With;
- repository URL;
- demo URL;
- pitch video URL;
- presentation URL or private uploaded file when document uploads are enabled;
- up to four screenshots;
- supporting links;
- publication consent;
- declarations;
- terms acceptance references.

External URLs:
- HTTPS only except specifically approved schemes;
- validate URL length and structure;
- allowlist embed providers when embedding is relevant to downstream clients;
- never accept arbitrary HTML;
- if metadata fetching is added, protect against SSRF, private/loopback/link-local ranges, DNS rebinding, excessive redirects, huge responses, and slow hosts.

GitHub OAuth login does not grant private repository access. Do not request private repository scopes in this release.

## 15.3 Versioning

Use:
- submission as logical identity;
- submission version as saved immutable snapshot;
- current draft version pointer;
- final submitted version pointer.

Judges always evaluate the immutable finalized version, not a mutable draft.

Allow controlled resubmission before deadline by producing another immutable finalized version and updating the final pointer if challenge policy allows it.

## 15.4 Finalization

Final submission must be a synchronous authoritative PostgreSQL transaction.

Inside that transaction verify:
- organization ACTIVE;
- challenge currently accepts final submissions based on database/server time;
- actor is approved/eligible participant;
- actor belongs to the owning team;
- team meets constraints;
- all required fields/assets exist;
- required terms are accepted;
- current database time is not after deadline;
- no duplicate finalization race violates policy;
- immutable version is stored;
- final pointer/status is updated;
- audit record is written;
- outbox event is written.

Do not return success merely because a queue job was accepted.

Use Idempotency-Key support on finalization.

## 15.5 Screenshots

Maximum four submission screenshots.

Enforce the limit:
- in DTO/service validation;
- in database structure using a bounded slot or equivalent invariant;
- with uniqueness per submission/version slot.

Private submissions use authenticated/private Cloudinary delivery.

---

# 16. Intellectual property, terms, and confidentiality

Treat challenge terms as first-class versioned records.

Terms can cover:
- pre-existing IP;
- ownership/licensing of submission IP;
- confidentiality;
- public publication permission;
- sponsor/organizer review rights;
- warranties/declarations;
- embargo/publication date;
- NDA/confidentiality acceptance.

Safe default:
- submission private to team plus authorized organizers/judges;
- screenshots private;
- public project gallery disabled unless organizer configuration and participant consent permit publication;
- no automatic public indexing of submissions.

Store consent records with:
- user;
- organization/challenge;
- terms version;
- accepted timestamp;
- context/source.

Do not mutate accepted terms in place.

A material terms change creates a new immutable version and requires appropriate re-acceptance.

---

# 17. Judging and evaluation

## 17.1 Rubrics

Rubric versions include:
- version;
- criteria;
- criterion description;
- min/max score range;
- weight;
- optional scoring anchors;
- judge-comment rules;
- tie-break policy.

Store criterion-level scores and compute weighted totals server-side.

Do not accept a client-computed total as authoritative.

Use exact numeric/decimal database arithmetic for weighted scores, not floating-point approximations that can change rankings.

Rubric version becomes immutable once judging starts or any scorecard is submitted.

Changes after that require a new explicit rubric version/workflow and must never silently reinterpret old scorecards.

## 17.2 Judges and mentors

Support challenge-scoped JUDGE and MENTOR access.

External judges/mentors must not be forced into broad organization membership.

Implement challenge staff invitations with:
- secure, expiring, hashed tokens;
- optional email binding;
- role;
- challenge and organization;
- accepted/revoked status;
- audit.

Judges can access only assigned challenge/submission data required for judging.

Support:
- judge-to-submission assignment;
- workload balancing;
- optional blind judging;
- conflict-of-interest declaration;
- recusal;
- audited reassignment.

Blind judging must use a judge-safe submission projection and avoid leaking team/member identity where the configured mode says it should be hidden.

## 17.3 Scorecards

Scorecard lifecycle:
- DRAFT;
- SUBMITTED;
- LOCKED.

Judges may save drafts for assigned submissions.

Submitting validates all required criteria, computes score, records timestamps, and locks as configured.

Reopening a locked/submitted scorecard requires organizer authorization, explicit reason, and audit.

## 17.4 Judging finalization and results

Workflow:
1. judges score independently;
2. organizers monitor completion;
3. judging is explicitly closed/finalized;
4. organizers resolve ties, recusals, disqualifications, or policy decisions;
5. result set is finalized;
6. organizers explicitly publish results.

Do not reveal live aggregate ranking to participants or judges while scoring is in progress by default.

Support finalist/winner/rank/result records without assuming every challenge uses a strict numeric rank.

Feedback release is an explicit organizer action/policy.

Public results expose only publication-safe data.

---

# 18. Announcements, FAQ, and engagement

Announcements:
- organization or challenge scope;
- title;
- Markdown body;
- audience;
- priority;
- publish time;
- optional expiry;
- in-app/email/integration delivery flags.

FAQ:
- organization/challenge association;
- ordered question/answer entries;
- Markdown source;
- publication state.

Do not build in-platform chat.

Slack/Discord integration in this release is outbound only:
- organizer-configured webhook/channel destination;
- announcement delivery;
- selected reminders/notifications.

Store webhook credentials encrypted at rest.

Never log integration secrets.

Do not implement two-way Slack/Discord synchronization in this release.

---

# 19. Notifications

Channels:
- in-app;
- email;
- optional Slack/Discord organization integration for configured organizer broadcasts.

Events should cover at least:
- organization invitation received;
- invitation accepted;
- join request decision;
- organization application decision;
- challenge registration decision;
- team invitation;
- team membership change;
- submission finalized;
- deadline changed/reopened;
- deadline reminder;
- announcement;
- judge/staff assignment;
- judging reminders;
- results published;
- judge feedback released;
- support ticket update;
- portfolio milestone/stage review where useful.

Users may disable non-essential engagement notifications.

Users must not be able to disable security-critical/authentication/legal notifications required for requested operations.

Unread count can use HTTP polling. If SSE is enabled, provide a one-way authenticated notification stream; it must not become a bidirectional chat system.

---

# 20. Transactional outbox and BullMQ

Critical business state and async side effects must never depend on a fragile “commit DB then queue” two-step.

For any operation that changes durable business state and needs async effects:
- business change;
- audit event;
- outbox event

must be written in the same PostgreSQL transaction.

After commit, an outbox dispatcher publishes deterministic jobs to BullMQ.

Outbox states:
- PENDING;
- ENQUEUED;
- PROCESSED;
- FAILED.

Implement reconciliation for stale ENQUEUED/PENDING records.

Use PostgreSQL locking patterns such as bounded batches with skip-locked semantics for concurrent outbox dispatchers.

Required logical queues:
- email;
- notification-fanout;
- analytics;
- exports;
- integrations;
- media-cleanup;
- reminders;
- cache-maintenance;
- outbox-dispatch/reconciliation where useful.

Do not create a queue per tiny event type.

Every worker handler must be idempotent.

Use:
- deterministic job IDs;
- deduplication where useful;
- bounded retries;
- exponential backoff with jitter;
- timeouts;
- failed-job visibility;
- dead-letter/operational handling;
- queue metrics and alerts.

The outbox is the recovery record that a side effect was required; Redis queue state is not the only source of that requirement.

Priority/bulkhead principle:
- transactional/security email must not be starved by large exports;
- heavy analytics/export workloads must have separate worker concurrency controls from urgent notification work.

Graceful worker shutdown must stop accepting new work and finish/return active jobs safely within a bounded shutdown period.

---

# 21. Email

Use Resend through an EmailProvider abstraction.

Production deliverability requirements:
- dedicated transactional sending subdomain;
- SPF;
- DKIM;
- DMARC;
- meaningful From/Reply-To policy;
- no open/click tracking on authentication/security email;
- idempotency keys;
- bounce/complaint tracking;
- suppression of repeatedly bouncing/complaining recipients;
- no secrets in logs.

Required email categories:
- verification;
- password reset;
- organization invite;
- challenge staff invite;
- organization application decision;
- join request/participation decision;
- team invitation;
- deadline reminder/change;
- submission confirmation;
- judging assignment/reminder;
- results publication;
- support ticket update.

Resend webhook:
- verify webhook signature using the provider’s current documented method;
- persist webhook event idempotently;
- return quickly;
- process heavy consequences asynchronously;
- track delivery/bounce/complaint state.

No Gmail SMTP fallback.

---

# 22. Image and object storage

## 22.1 Cloudinary images

Cloudinary is image-only.

Use backend-issued short-lived signed upload authorization.

Flow:
1. authenticated client asks API for upload authorization specifying purpose and target context;
2. API validates tenant, permission, MIME class, file size/dimensions policy, and asset purpose;
3. API issues narrowly scoped signed Cloudinary parameters;
4. client uploads directly;
5. client confirms returned asset ID/metadata to API;
6. API verifies expected metadata before associating asset with domain record.

Do not let clients freely choose arbitrary folders, public IDs, delivery types, or access modes.

Use authenticated/restricted delivery for private images.

Create pending/unclaimed asset records and cleanup jobs for orphan uploads.

Allowed image purposes include at least:
- user avatar;
- organization logo;
- challenge cover;
- sponsor logo;
- submission screenshots;
- support-ticket screenshots;
- portfolio evidence images where allowed.

Validate purpose-specific size/count constraints.

## 22.2 S3-compatible object storage

Use private S3-compatible storage for:
- generated exports;
- optional uploaded presentation decks/PDFs/data files if document uploads are enabled;
- other non-image private artifacts explicitly allowed by product policy.

Use:
- presigned direct upload/download;
- allowlisted MIME and extensions;
- strict size limits;
- encrypted-at-rest bucket configuration;
- private-by-default objects;
- short-lived downloads;
- metadata linking tenant/resource;
- malware scanning hook/workflow for user-uploaded documents before they become available to other users.

If malware scanning infrastructure is not available locally, implement a provider interface and quarantine state so unsafe files are never treated as trusted. Do not fake a “scan passed” result.

Exports generated by the server may bypass user-upload malware scanning but remain private and expiring.

---

# 23. Caching

Use cache-aside.

Good cache candidates:
- public organization listings/profiles;
- public challenge lists/details;
- public aggregate counts;
- organization dashboard summaries;
- short-lived membership/permission summaries;
- rate-limit counters.

Never use cache as authority for:
- deadline acceptance;
- final submission;
- final score submission;
- ownership;
- security role changes;
- legal consent;
- session durability.

Use TTLs and event-driven/versioned invalidation.

On optional cache failure:
- use short timeouts;
- fail fast;
- record degraded-mode metrics;
- fall back to PostgreSQL when safe.

Prevent cache stampedes for high-traffic public keys using a simple lock/coalescing strategy if load tests show it is needed. Do not add distributed complexity prematurely.

---

# 24. Analytics and reporting

Organization metrics should include at least:
- members;
- registrations;
- approved participants;
- active teams;
- submissions started;
- final submissions;
- completion/conversion rate;
- submissions per track;
- judging completion;
- scoring turnaround;
- top technology tags;
- finalists/winners;
- portfolio conversion;
- innovation stage progression;
- outcome/impact metrics.

Public metrics:
- only organization-approved aggregate values;
- no personal demographics;
- no private member/team lists;
- no unpublished scores;
- no private applications;
- no judge private notes;
- no support information.

Do not run expensive full aggregates on every dashboard refresh.

Use:
- optimized SQL/TypedSQL;
- daily or incremental rollup tables/materialized views where beneficial;
- Redis for short-lived dashboard summaries;
- event/outbox-driven invalidation/refresh;
- scheduled recomputation as a correction mechanism.

## 24.1 Exports

Sensitive exports:
- permission checked;
- audited;
- generated asynchronously;
- idempotent;
- scoped to explicit organization/challenge;
- store only authorized requested fields;
- written to private object storage;
- expire automatically;
- return short-lived signed downloads.

CSV is REQUIRED.

Do not build XLSX unless a testable business requirement is already present in the repository. Keep exporter abstraction open for it later.

---

# 25. Support tickets and feature requests

Users must be able to submit platform support requests.

Categories:
- BUG;
- ACCESS_OR_ACCOUNT;
- ORGANIZATION_ISSUE;
- CHALLENGE_ISSUE;
- ABUSE_OR_SAFETY;
- FEATURE_REQUEST;
- OTHER.

Lifecycle:
- OPEN;
- TRIAGED;
- IN_PROGRESS;
- WAITING_USER;
- RESOLVED;
- CLOSED;
- RESOLVED can be reopened to IN_PROGRESS.

Fields:
- user;
- optional organization/challenge context;
- category;
- subject;
- description;
- priority controlled by platform staff, not normal user;
- status;
- user-visible comments;
- internal staff notes stored separately;
- optional private screenshots;
- timestamps;
- resolution summary.

Do not expose internal staff notes through participant endpoints.

Feature requests may be internally deduplicated/linked, but do not build a public roadmap/voting product.

---

# 26. Innovation portfolio

The backend must support post-challenge innovation management.

An innovation item can:
- originate from a submission; or
- be created directly by an authorized organization user for continuous ideation.

Fields should support:
- source challenge/submission when applicable;
- opportunity/problem;
- innovation thesis;
- owner/team;
- strategic themes;
- expected impact;
- risk level;
- beneficiaries/customers;
- current stage;
- milestones;
- evidence;
- resource/funding notes;
- KPI/outcome metrics;
- stage history;
- next review date.

Fixed initial stages:
- DISCOVERY;
- VALIDATION;
- PROTOTYPE;
- PILOT;
- INCUBATION;
- SCALE;
- PAUSED;
- CLOSED.

Do not build an arbitrary workflow designer.

Stage transition must record:
- previous stage;
- next stage;
- decision;
- decision maker;
- evidence references;
- notes;
- date;
- next review date;
- milestone requirements where relevant;
- audit;
- outbox/notifications where relevant.

Support:
- promote finalized submission into portfolio;
- direct innovation-item creation;
- milestone CRUD/status;
- evidence attachments/links;
- metric definitions and metric measurements;
- stage-gate history;
- portfolio analytics.

Prevent the same submission from being accidentally promoted twice unless the model explicitly supports multiple portfolio items and the organizer intentionally requests it. Default to one promotion per submission.

---

# 27. Search and discovery

V1 search uses PostgreSQL only.

Use:
- PostgreSQL full-text search;
- pg_trgm for fuzzy/name/title search where appropriate;
- skills/technology/theme tags;
- filters by organization, challenge state, dates, track/theme.

Do not add Elasticsearch/OpenSearch.

Public search must query only public-safe projections.

Internal organization search must remain tenant-scoped and authorization checked.

Do not create a global private-data search index.

---

# 28. Moderation and abuse

Because public content exists, implement explicit moderation primitives rather than treating all abuse as generic support.

Users can report:
- organization;
- public challenge;
- public project/result/innovation content where applicable.

Report fields:
- reporter;
- target type/id;
- category;
- description;
- evidence/optional private screenshot;
- status;
- assigned/review metadata.

Platform staff can:
- review;
- dismiss;
- temporarily hide public content;
- suspend organization where authorized;
- restore content;
- record reason;
- audit all actions.

Do not build automated ML moderation in this release.

---

# 29. Audit logging

Audit trail and application logs are separate systems.

Audit all high-value business/security changes, including:
- organization application decisions;
- org visibility changes;
- org suspension/reinstatement;
- membership/role changes;
- ownership transfer;
- invitation/join-code creation/revocation/redemption;
- challenge publication/cancellation;
- schedule/deadline changes/reopen;
- terms version changes;
- participant decisions/disqualification;
- team exceptions after deadline;
- submission disqualification/reopen;
- rubric version changes;
- challenge staff/judge assignment changes;
- scorecard reopen;
- judging/result finalization/publication/retraction if supported;
- sensitive exports;
- integration credential changes;
- portfolio stage changes;
- moderation actions;
- platform feature/limit changes;
- support staff actions where sensitive.

Audit event fields:
- id;
- organization_id nullable for platform-global events;
- actor type USER/SYSTEM/PLATFORM_ADMIN;
- actor user ID when applicable;
- action;
- resource type/id;
- safe summary;
- redacted before/after data where useful;
- reason;
- request/correlation ID;
- optional IP/user-agent metadata subject to privacy policy;
- created timestamp.

Never put secrets or highly sensitive content into audit payloads.

The ordinary application runtime role must not have normal UPDATE/DELETE permissions on audit rows.

Use append-only semantics.

---

# 30. Database model requirements

At minimum implement tables/entities equivalent to the following. Naming may follow a consistent Prisma convention, but semantics must remain.

Identity/global:
- user;
- auth_account;
- auth_session;
- auth_verification;
- user_profile;
- skill;
- user_skill;
- platform_role_assignment;
- organization_application.

Organization:
- organization;
- organization_settings;
- organization_membership;
- organization_invitation;
- organization_join_code;
- organization_join_request.

Challenge:
- challenge;
- challenge_schedule_change;
- challenge_track;
- challenge_prize;
- challenge_sponsor;
- challenge_terms_version;
- consent_record.

Forms/participation:
- form_definition;
- form_version;
- form_response;
- challenge_participation.

Teams/matchmaking:
- challenge_team;
- challenge_team_member;
- team_invitation;
- matchmaking_post.

Submission:
- submission;
- submission_version;
- submission_asset;
- submission_technology;
- technology_tag.

Judging:
- rubric;
- rubric_version;
- rubric_criterion;
- challenge_staff_invitation;
- challenge_staff_assignment;
- judge_assignment;
- scorecard;
- criterion_score;
- result.

Communication:
- announcement;
- faq_entry;
- notification;
- notification_preference.

Media/integration:
- media_asset;
- stored_object or file_asset for non-image object storage;
- external_integration;
- integration_delivery.

Analytics/export:
- analytics_daily_rollup or equivalent rollup;
- export_request;
- email_delivery.

Innovation portfolio:
- innovation_item;
- innovation_stage_change;
- innovation_milestone;
- innovation_metric;
- innovation_metric_measurement;
- innovation_evidence.

Support/moderation/audit:
- support_ticket;
- support_ticket_comment;
- support_ticket_internal_note or an explicit field/model that cannot leak through user APIs;
- content_report;
- audit_event;
- outbox_event.

Infrastructure consistency:
- idempotency_record;
- webhook_event or provider-specific idempotent webhook receipt table;
- email_suppression or equivalent state;
- minimal platform_feature_flag/platform_setting only if required for gated optional capabilities;
- organization_limit/quota record only if needed to enforce platform resource limits cleanly.

Do not use a single giant JSON blob where relational constraints are important.

Use JSONB where shape is legitimately dynamic, such as immutable dynamic form responses or redacted audit before/after fragments.

Use timestamps with time zones for instants.

Use soft deletion only where product/history requirements justify it; do not reflexively add `deletedAt` to every table.

---

# 31. Database constraints and indexes

The database must enforce invariants, not merely application code.

Use:
- primary keys;
- foreign keys;
- composite same-tenant foreign keys;
- unique constraints;
- partial unique indexes;
- check constraints;
- RLS;
- transactions;
- locks/serializable isolation where races matter.

Important uniqueness/indexing expectations include:

Membership:
- unique active membership by organization + user;
- user + status index;
- organization + role + status index.

Organizations:
- case-insensitive unique slug;
- status + visibility for public directory.

Challenges:
- unique organization + slug;
- organization + status;
- organization + submission deadline;
- public visibility/publication/deadline query path;
- partial index for active public published challenges if query plans justify it.

Participation:
- unique challenge + user;
- organization + challenge + status.

Teams:
- unique challenge-scoped normalized slug/name as appropriate;
- challenge lookup;
- member user + challenge lookup;
- enforce one active team per participant/challenge.

Submissions:
- one logical submission per team/challenge by default;
- organization + challenge + status;
- challenge + final submission timestamp.

Judging:
- unique submission + judge assignment as required;
- judge + status;
- challenge + status;
- unique criterion score per scorecard + criterion.

Audit:
- organization + created time descending;
- actor + created time;
- resource type + resource ID + created time.

Notifications:
- user + read state + created time.

Outbox:
- state + available/created time;
- deterministic event ID uniqueness.

Idempotency:
- actor/operation/key uniqueness plus expiration.

Search:
- trigram/full-text indexes based on measured query paths.

Do not index every column.

For performance work, inspect real PostgreSQL plans with EXPLAIN ANALYZE/BUFFERS in development/staging when practical.

---

# 32. Transactions, ACID, and concurrency

Use transactions for:
- invitation acceptance;
- join-code redemption;
- join-request approval;
- organization activation;
- ownership transfer / last-owner changes;
- challenge publication and schedule changes;
- team join/captain transfer;
- final submission;
- scorecard submission/reopen;
- judging finalization;
- result finalization/publication;
- promotion into innovation portfolio;
- sensitive quota updates when races matter.

Use explicit row locks or SERIALIZABLE transactions for check-then-write invariants that can race.

If SERIALIZABLE is used, implement bounded retries only for serialization failures.

Concurrency tests must prove:
- two people cannot take the same last team slot;
- join-code usage cannot exceed max uses;
- two requests cannot demote/remove the last owner;
- duplicate finalization cannot create inconsistent submissions;
- a deadline change and finalization race is deterministic;
- scorecard submission is not double-applied;
- outbox dispatch remains idempotent.

Never trust an earlier read outside the transaction for a critical invariant.

---

# 33. API conventions

Base path for domain APIs:
- `/api/v1`

Use nouns for resources and explicit action endpoints for meaningful state transitions.

Use JSON for normal APIs.

Use `application/problem+json`-style structured errors based on current HTTP Problem Details semantics.

Every error response should expose only safe data and include:
- stable application error code;
- human-readable message;
- request ID;
- optional field validation errors.

Never return stack traces, SQL, secrets, or provider payloads to clients.

Pagination:
- cursor/keyset for large feeds such as challenges, audit, notifications, submissions, tickets;
- offset pagination acceptable only for small admin lookup/configuration lists;
- define default and maximum page sizes;
- stable deterministic sort order.

Filtering/sorting:
- allowlist fields;
- do not pass arbitrary client field names directly into raw SQL;
- normalize search input.

Idempotency-Key:
REQUIRED for high-value retryable POST operations such as:
- organization application creation;
- invitation creation;
- final submission;
- export request;
- result publication;
- other externally side-effecting operations where client retries are likely.

Persist bounded idempotency records keyed by actor + operation + idempotency key.

OpenAPI:
- every route documented;
- auth requirements shown;
- request/response schema generated from DTOs where possible;
- error schemas documented;
- tags organized by module;
- examples safe and synthetic;
- no secret values.

In production, OpenAPI UI may be disabled or admin-protected while the specification remains buildable/exportable.

---

# 34. Complete required endpoint surface

The exact internal controller/service names may vary, but the backend must expose the following functional surface unless the capability is explicitly delegated to Better Auth. Do not invent large unrelated endpoint families beyond this scope.

Use explicit organization IDs in tenant-admin paths. Do not make a cookie-selected “active organization” the only tenant identifier.

## 34.1 Platform health and metadata

- GET `/health/live` — process liveness; no dependency-heavy checks.
- GET `/health/ready` — readiness for required dependencies such as PostgreSQL; include queue/cache dependency readiness according to process role without leaking credentials.
- GET `/api/v1/meta/skills` — searchable/paginated allowed skill catalogue.
- GET `/api/v1/meta/technology-tags` — searchable/paginated technology tags.
- GET `/api/v1/meta/capabilities` — safe client-visible enabled product capabilities/feature flags only, never secret operational configuration.

Operational metrics endpoint may exist outside the public API namespace and must be network/auth restricted.

## 34.2 Authentication

Mount Better Auth under the configured auth base path and provide its stable official handlers for:
- email signup;
- email verification;
- email sign-in;
- sign-out;
- password reset request;
- password reset;
- Google OAuth;
- GitHub OAuth;
- session retrieval;
- session revocation;
- 2FA enrollment/challenge/recovery where enabled.

Do not duplicate these with custom password/session controllers.

## 34.3 Public organizations and challenges

- GET `/api/v1/public/organizations`
- GET `/api/v1/public/organizations/:orgSlug`
- GET `/api/v1/public/organizations/:orgSlug/challenges`
- GET `/api/v1/public/organizations/:orgSlug/challenges/:challengeSlug`
- GET `/api/v1/public/organizations/:orgSlug/challenges/:challengeSlug/tracks`
- GET `/api/v1/public/organizations/:orgSlug/challenges/:challengeSlug/announcements`
- GET `/api/v1/public/organizations/:orgSlug/challenges/:challengeSlug/faqs`
- GET `/api/v1/public/organizations/:orgSlug/challenges/:challengeSlug/results`
- GET `/api/v1/public/organizations/:orgSlug/projects` — only explicitly published/consented project results.
- GET `/api/v1/public/organizations/:orgSlug/innovations` — only organization-approved public portfolio items/metrics.
- GET `/api/v1/public/challenges`
- GET `/api/v1/public/search`

All public endpoints use public projections, never unrestricted base-table serialization.

## 34.4 Current user and profile

- GET `/api/v1/me`
- PATCH `/api/v1/me/profile`
- PUT `/api/v1/me/skills`
- GET `/api/v1/me/organizations`
- GET `/api/v1/me/challenge-participations`
- GET `/api/v1/me/team-invitations`
- GET `/api/v1/me/challenge-staff-invitations`
- GET `/api/v1/me/notifications`
- POST `/api/v1/me/notifications/:notificationId/read`
- POST `/api/v1/me/notifications/read-all`
- GET `/api/v1/me/notification-preferences`
- PATCH `/api/v1/me/notification-preferences`
- GET `/api/v1/users/:userId/profile` — safe profile projection based on visibility/access.
- POST `/api/v1/me/account-deletion-request` — fresh-auth protected privacy workflow.
- DELETE `/api/v1/me/account-deletion-request` — cancel pending deletion when policy allows.

Do not hard-delete organization history or audit rows merely because an account deletion was requested. Apply configured deletion/pseudonymization policy.

## 34.5 Organization applications

Authenticated user:
- POST `/api/v1/organization-applications`
- GET `/api/v1/me/organization-applications`
- GET `/api/v1/organization-applications/:applicationId` — only applicant or platform-authorized staff.
- PATCH `/api/v1/organization-applications/:applicationId` — only while policy permits applicant edits.
- POST `/api/v1/organization-applications/:applicationId/resubmit` — rejected application re-entry where allowed.

Platform:
- GET `/api/v1/platform/organization-applications`
- GET `/api/v1/platform/organization-applications/:applicationId`
- POST `/api/v1/platform/organization-applications/:applicationId/approve`
- POST `/api/v1/platform/organization-applications/:applicationId/reject`

Approval/rejection require reason/notes as appropriate and are audited.

## 34.6 Organization profile/settings

- GET `/api/v1/organizations/:organizationId`
- GET `/api/v1/organizations/:organizationId/settings`
- PATCH `/api/v1/organizations/:organizationId/profile`
- PATCH `/api/v1/organizations/:organizationId/settings`
- POST `/api/v1/organizations/:organizationId/transfer-ownership`
- POST `/api/v1/organizations/:organizationId/archive`

Do not permit changing platform lifecycle state, ownership, or high-value security state through the generic profile/settings PATCH.

## 34.7 Memberships

- GET `/api/v1/organizations/:organizationId/members`
- GET `/api/v1/organizations/:organizationId/members/:userId`
- POST `/api/v1/organizations/:organizationId/members/:userId/change-role`
- POST `/api/v1/organizations/:organizationId/members/:userId/remove`
- POST `/api/v1/organizations/:organizationId/members/:userId/reactivate` — only if membership model supports retained inactive membership.

Role changes and removals enforce last-owner protection.

## 34.8 Organization invitations

Admin:
- GET `/api/v1/organizations/:organizationId/invitations`
- POST `/api/v1/organizations/:organizationId/invitations`
- GET `/api/v1/organizations/:organizationId/invitations/:invitationId`
- POST `/api/v1/organizations/:organizationId/invitations/:invitationId/revoke`
- POST `/api/v1/organizations/:organizationId/invitations/:invitationId/resend`

Recipient:
- POST `/api/v1/invitations/:token/accept`
- POST `/api/v1/invitations/:token/decline` — if decline state is retained; otherwise safe no-op/expiration behavior may be documented.

Never expose token hashes through API responses.

## 34.9 Join codes

Admin:
- GET `/api/v1/organizations/:organizationId/join-codes`
- POST `/api/v1/organizations/:organizationId/join-codes`
- POST `/api/v1/organizations/:organizationId/join-codes/:joinCodeId/revoke`

User:
- POST `/api/v1/join-codes/redeem`

Do not provide an endpoint that reveals stored plaintext codes after creation. A newly generated plaintext code may be returned exactly once at creation if that is the chosen UX.

## 34.10 Organization join requests

User:
- POST `/api/v1/organizations/:organizationId/join-requests`
- GET `/api/v1/me/organization-join-requests`
- POST `/api/v1/organizations/:organizationId/join-requests/:requestId/withdraw`

Admin:
- GET `/api/v1/organizations/:organizationId/join-requests`
- GET `/api/v1/organizations/:organizationId/join-requests/:requestId`
- POST `/api/v1/organizations/:organizationId/join-requests/:requestId/approve`
- POST `/api/v1/organizations/:organizationId/join-requests/:requestId/reject`

## 34.11 Forms

Organization admins/challenge managers:
- GET `/api/v1/organizations/:organizationId/forms`
- POST `/api/v1/organizations/:organizationId/forms`
- GET `/api/v1/organizations/:organizationId/forms/:formId`
- PATCH `/api/v1/organizations/:organizationId/forms/:formId` — metadata only.
- GET `/api/v1/organizations/:organizationId/forms/:formId/versions`
- POST `/api/v1/organizations/:organizationId/forms/:formId/versions`
- GET `/api/v1/organizations/:organizationId/forms/:formId/versions/:versionId`
- POST `/api/v1/organizations/:organizationId/forms/:formId/versions/:versionId/publish`

Published/used versions become immutable.

Form responses should normally be created through the owning workflow endpoint (join request, participation, survey, stage gate) rather than an unrestricted generic “submit any form” route.

## 34.12 Challenges

- GET `/api/v1/organizations/:organizationId/challenges`
- POST `/api/v1/organizations/:organizationId/challenges`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId` — editable descriptive/configuration fields only, subject to lifecycle rules.
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/publish`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/reschedule`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/extend-deadline`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/reopen`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/cancel`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/archive`

All schedule/lifecycle actions require appropriate authorization and audit. Reschedule/extend/reopen/cancel require a reason when material.

## 34.13 Challenge tracks

- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/tracks`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/tracks`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/tracks/:trackId`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId/tracks/:trackId`
- DELETE `/api/v1/organizations/:organizationId/challenges/:challengeId/tracks/:trackId`

Deletion must be blocked or converted to safe archival once referenced by finalized submissions.

## 34.14 Prizes and sponsors

Prizes:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/prizes`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/prizes`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId/prizes/:prizeId`
- DELETE `/api/v1/organizations/:organizationId/challenges/:challengeId/prizes/:prizeId`

Sponsors:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/sponsors`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/sponsors`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId/sponsors/:sponsorId`
- DELETE `/api/v1/organizations/:organizationId/challenges/:challengeId/sponsors/:sponsorId`

No payment endpoints.

## 34.15 Challenge terms and consent

Admin:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/terms`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/terms/versions`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/terms/versions/:versionId`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/terms/versions/:versionId/activate`

Participant:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/terms/current`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/terms/:versionId/accept`

Do not mutate an accepted version.

## 34.16 Participation/application

Participant:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/participation/me`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/participation/register`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId/participation/application` — save/update application while allowed.
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/participation/submit-application` — when screening form is used.
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/participation/withdraw`

Organizer:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/participants`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/participants/:participantId`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/participants/:participantId/approve`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/participants/:participantId/reject`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/participants/:participantId/disqualify`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/participants/:participantId/reinstate` — only if policy permits and with audit.

Avoid a generic status PATCH.

## 34.17 Challenge teams

- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/teams`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/teams`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId` — safe metadata only.
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId/invitations`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId/invitations`
- POST `/api/v1/team-invitations/:token/accept`
- POST `/api/v1/team-invitations/:token/decline`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId/invitations/:invitationId/revoke`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId/leave`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId/transfer-captain`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId/members/:userId/remove`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/teams/:teamId/organizer-exception` — organizer-only post-deadline correction with reason/audit; narrowly define supported corrections.

Do not expose private contact details in team listing.

## 34.18 Matchmaking

- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/matchmaking`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/matchmaking`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId/close`
- DELETE `/api/v1/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/matchmaking/:postId/interest`

Interest should create an in-platform notification or safe team invitation path, not disclose hidden email/phone data.

## 34.19 Submissions

Participant/team:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/me`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId`
- PATCH `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/draft`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/versions`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/versions/:versionId`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/finalize`

Organizer:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/reopen`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/disqualify`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/reinstate` — if policy allows.

Judge access must use judging endpoints/projections, not broad organizer submission endpoints.

## 34.20 Media images

- POST `/api/v1/media/images/upload-authorization`
- POST `/api/v1/media/images/confirm`
- GET `/api/v1/media/images/:assetId/delivery` — only when backend-generated signed/authenticated delivery is required.
- DELETE `/api/v1/media/images/:assetId`

All requests carry a purpose and relevant tenant/resource context that the service verifies.

## 34.21 Private files/object storage

When object uploads are enabled:
- POST `/api/v1/files/upload-authorization`
- POST `/api/v1/files/confirm`
- GET `/api/v1/files/:fileId/download`
- DELETE `/api/v1/files/:fileId`

Do not expose raw permanent object-store URLs.

## 34.22 Challenge staff invitations and assignments

Admin:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/staff`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/staff-invitations`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/staff-invitations`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/staff-invitations/:invitationId/revoke`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/staff/:staffAssignmentId/remove`

Recipient:
- POST `/api/v1/challenge-staff-invitations/:token/accept`
- POST `/api/v1/challenge-staff-invitations/:token/decline`

Roles are JUDGE or MENTOR only for this invitation type.

## 34.23 Rubrics

- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/rubrics`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/rubrics`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions/:versionId`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/rubrics/:rubricId/versions/:versionId/activate`

Do not edit an in-use immutable version.

## 34.24 Judge assignments

Organizer:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/judge-assignments`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/judge-assignments`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/judge-assignments/auto-balance` — deterministic, explainable workload balancing only; no ML.
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/judge-assignments/:assignmentId/reassign`
- DELETE `/api/v1/organizations/:organizationId/challenges/:challengeId/judge-assignments/:assignmentId`

Judge:
- GET `/api/v1/judging/assignments`
- GET `/api/v1/judging/assignments/:assignmentId`
- POST `/api/v1/judging/assignments/:assignmentId/declare-conflict`
- POST `/api/v1/judging/assignments/:assignmentId/recuse`

## 34.25 Scorecards

Judge:
- GET `/api/v1/judging/assignments/:assignmentId/scorecard`
- PATCH `/api/v1/judging/assignments/:assignmentId/scorecard`
- POST `/api/v1/judging/assignments/:assignmentId/scorecard/submit`

Organizer:
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/scorecards/:scorecardId/reopen`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/judging/progress`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/judging/finalize`

Do not expose relative live rank through judging progress.

## 34.26 Results and feedback

Organizer:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/results`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/results/finalize`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/results/publish`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/results/retract` — high privilege, explicit reason, audit, only if business rules allow correcting a mistaken publication.
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/feedback/release`

Participant:
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/feedback` — only own team and only released feedback.

Public results are served through public projection endpoint already defined.

## 34.27 Announcements

Organization/challenge admin:
- GET `/api/v1/organizations/:organizationId/announcements`
- POST `/api/v1/organizations/:organizationId/announcements`
- GET `/api/v1/organizations/:organizationId/announcements/:announcementId`
- PATCH `/api/v1/organizations/:organizationId/announcements/:announcementId`
- POST `/api/v1/organizations/:organizationId/announcements/:announcementId/publish`
- POST `/api/v1/organizations/:organizationId/announcements/:announcementId/unpublish`

Challenge filter/scope is represented explicitly in the resource. If cleaner in the repository, challenge-specific aliases may exist, but do not duplicate business logic.

## 34.28 FAQs

- GET `/api/v1/organizations/:organizationId/faqs`
- POST `/api/v1/organizations/:organizationId/faqs`
- PATCH `/api/v1/organizations/:organizationId/faqs/:faqId`
- DELETE `/api/v1/organizations/:organizationId/faqs/:faqId`
- POST `/api/v1/organizations/:organizationId/faqs/reorder`

FAQ records may be organization-scoped or challenge-scoped.

## 34.29 Integrations

- GET `/api/v1/organizations/:organizationId/integrations`
- POST `/api/v1/organizations/:organizationId/integrations/slack`
- POST `/api/v1/organizations/:organizationId/integrations/discord`
- POST `/api/v1/organizations/:organizationId/integrations/:integrationId/test`
- PATCH `/api/v1/organizations/:organizationId/integrations/:integrationId`
- DELETE `/api/v1/organizations/:organizationId/integrations/:integrationId`
- GET `/api/v1/organizations/:organizationId/integrations/:integrationId/deliveries`

Do not return decrypted webhook secrets.

No inbound chat synchronization.

## 34.30 Organization analytics and exports

- GET `/api/v1/organizations/:organizationId/analytics/overview`
- GET `/api/v1/organizations/:organizationId/analytics/challenges`
- GET `/api/v1/organizations/:organizationId/challenges/:challengeId/analytics`
- GET `/api/v1/organizations/:organizationId/analytics/portfolio`
- POST `/api/v1/organizations/:organizationId/exports`
- GET `/api/v1/organizations/:organizationId/exports`
- GET `/api/v1/organizations/:organizationId/exports/:exportId`
- GET `/api/v1/organizations/:organizationId/exports/:exportId/download`
- DELETE `/api/v1/organizations/:organizationId/exports/:exportId` — revoke/delete export if policy allows.

Export request must specify a predefined export type and validated filters/field set. Do not accept arbitrary SQL-like export definitions.

## 34.31 Innovation portfolio

- GET `/api/v1/organizations/:organizationId/innovations`
- POST `/api/v1/organizations/:organizationId/innovations`
- GET `/api/v1/organizations/:organizationId/innovations/:innovationId`
- PATCH `/api/v1/organizations/:organizationId/innovations/:innovationId`
- POST `/api/v1/organizations/:organizationId/challenges/:challengeId/submissions/:submissionId/promote-to-innovation`
- POST `/api/v1/organizations/:organizationId/innovations/:innovationId/transition-stage`
- GET `/api/v1/organizations/:organizationId/innovations/:innovationId/stage-history`

Milestones:
- GET `/api/v1/organizations/:organizationId/innovations/:innovationId/milestones`
- POST `/api/v1/organizations/:organizationId/innovations/:innovationId/milestones`
- PATCH `/api/v1/organizations/:organizationId/innovations/:innovationId/milestones/:milestoneId`
- DELETE `/api/v1/organizations/:organizationId/innovations/:innovationId/milestones/:milestoneId`

Evidence:
- GET `/api/v1/organizations/:organizationId/innovations/:innovationId/evidence`
- POST `/api/v1/organizations/:organizationId/innovations/:innovationId/evidence`
- DELETE `/api/v1/organizations/:organizationId/innovations/:innovationId/evidence/:evidenceId`

Metrics:
- GET `/api/v1/organizations/:organizationId/innovations/:innovationId/metrics`
- POST `/api/v1/organizations/:organizationId/innovations/:innovationId/metrics`
- PATCH `/api/v1/organizations/:organizationId/innovations/:innovationId/metrics/:metricId`
- POST `/api/v1/organizations/:organizationId/innovations/:innovationId/metrics/:metricId/measurements`
- GET `/api/v1/organizations/:organizationId/innovations/:innovationId/metrics/:metricId/measurements`

Use explicit stage transition action, not direct stage PATCH.

## 34.32 Audit

- GET `/api/v1/organizations/:organizationId/audit`
- GET `/api/v1/organizations/:organizationId/audit/:auditEventId`

Read-only through normal APIs. No update/delete endpoint.

Platform-level audit:
- GET `/api/v1/platform/audit`
- GET `/api/v1/platform/audit/:auditEventId`

Enforce purpose/role restrictions for platform audit.

## 34.33 Support tickets

User:
- POST `/api/v1/support/tickets`
- GET `/api/v1/support/tickets`
- GET `/api/v1/support/tickets/:ticketId`
- POST `/api/v1/support/tickets/:ticketId/comments`
- POST `/api/v1/support/tickets/:ticketId/reopen`
- POST `/api/v1/support/tickets/:ticketId/close` — user-close only when state allows.

Platform staff:
- GET `/api/v1/platform/support/tickets`
- GET `/api/v1/platform/support/tickets/:ticketId`
- POST `/api/v1/platform/support/tickets/:ticketId/assign`
- POST `/api/v1/platform/support/tickets/:ticketId/change-status`
- POST `/api/v1/platform/support/tickets/:ticketId/set-priority`
- POST `/api/v1/platform/support/tickets/:ticketId/comments`
- POST `/api/v1/platform/support/tickets/:ticketId/internal-notes`
- POST `/api/v1/platform/support/tickets/:ticketId/resolve`

Internal notes must never appear in user ticket serialization.

## 34.34 Moderation/content reports

User:
- POST `/api/v1/reports`
- GET `/api/v1/reports/mine`

Platform:
- GET `/api/v1/platform/reports`
- GET `/api/v1/platform/reports/:reportId`
- POST `/api/v1/platform/reports/:reportId/dismiss`
- POST `/api/v1/platform/reports/:reportId/hide-content`
- POST `/api/v1/platform/reports/:reportId/restore-content`
- POST `/api/v1/platform/reports/:reportId/suspend-organization`

All moderation actions require reason and audit.

## 34.35 Platform organization administration

- GET `/api/v1/platform/organizations`
- GET `/api/v1/platform/organizations/:organizationId`
- POST `/api/v1/platform/organizations/:organizationId/suspend`
- POST `/api/v1/platform/organizations/:organizationId/reinstate`
- POST `/api/v1/platform/organizations/:organizationId/archive`
- PATCH `/api/v1/platform/organizations/:organizationId/limits` — only if organization quota controls are implemented.
- GET `/api/v1/platform/organizations/:organizationId/audit-summary` — safe operational summary, not an excuse to bypass normal audit access control.

Suspension/reinstatement is explicit and audited.

## 34.36 Platform feature flags/settings

If product-gated capabilities require DB-backed flags:
- GET `/api/v1/platform/feature-flags`
- PATCH `/api/v1/platform/feature-flags/:flagKey`

Only implement a small allowlisted flag registry. Do not build a general experimentation/targeting platform.

Never expose secret configuration values through these APIs.

## 34.37 Webhooks

- POST `/webhooks/resend` or a versioned equivalent suitable for provider configuration.

Webhook routes:
- are unauthenticated by cookie;
- authenticate by provider signature;
- use raw body/signature semantics required by the provider;
- are replay/idempotency protected;
- persist event receipt before asynchronous processing;
- return quickly.

Add other webhook routes only for integrations actually implemented and only with equivalent signature verification.

## 34.38 Optional SSE

If enabled:
- GET `/api/v1/me/notifications/stream`

This is one-way server-to-client event delivery only.

Use authorization, heartbeat/connection cleanup, and bounded connection resource controls.

Polling remains supported.

---

# 35. API status and behavior expectations

Use HTTP semantics consistently:
- 200 for successful reads/actions returning representation;
- 201 for created resources;
- 202 for accepted async operations such as export generation when completion is later;
- 204 for successful operations intentionally returning no body;
- 400 for malformed/invalid request semantics not better represented elsewhere;
- 401 unauthenticated;
- 403 authenticated but not authorized;
- 404 when a resource is unavailable in the caller’s allowed scope; avoid leaking cross-tenant existence;
- 409 for state/invariant conflicts;
- 412/428 only if explicit precondition semantics are adopted;
- 422 for well-formed but domain-invalid payloads when consistently used;
- 429 for rate limits;
- 503 for required dependency unavailability where appropriate.

Do not overfit status codes if the framework/auth library has a stable contract; remain internally consistent and document deviations.

---

# 36. Rate limiting and abuse controls

Rate-limit at least:
- auth attempts;
- password reset;
- email verification resend;
- join-code redemption;
- invitations;
- organization applications;
- join requests;
- public search/listing;
- upload authorization;
- support ticket submission;
- content reports;
- exports;
- integration tests/deliveries.

Use combinations of:
- IP;
- authenticated user;
- organization;
- endpoint/action.

Do not use Redis cache failure as an excuse to fail open on high-risk brute-force endpoints.

For high-risk paths, combine provider/auth built-in protections, Redis-backed distributed limiting, and a conservative local fallback or fail-safe behavior.

Add per-tenant noisy-neighbor controls:
- maximum body size;
- upload size/count;
- export concurrency;
- invitation/email fan-out;
- queue job concurrency;
- pagination caps;
- reasonable organization/challenge usage limits if configured.

Do not allow one tenant’s export or notification burst to starve others.

---

# 37. Security requirements

Follow current OWASP guidance for broken access control, IDOR/BOLA, session security, CSRF, injection, SSRF, secrets, and security logging.

Mandatory defenses:
- deny by default;
- authorize every object access;
- tenant scope every tenant object;
- DTO validation;
- parameterized SQL;
- no unrestricted raw SQL interpolation;
- safe URL parsing;
- SSRF defenses for any server-side URL fetch;
- output encoding responsibility documented for Markdown consumers;
- never accept unrestricted participant/organizer HTML;
- strict trusted CORS origins if cross-origin deployment is necessary;
- same-site deployment preferred;
- security headers at reverse proxy/API layer as applicable;
- request body limits;
- upload constraints;
- password/session/auth handled by Better Auth;
- secure random tokens from cryptographic RNG;
- token hashes at rest;
- encrypted provider/integration credentials at rest;
- secret redaction in logs;
- production secrets from environment/secret manager, never repository;
- no `.env` secrets committed;
- dependency/security scanning in CI.

Encryption for integration secrets:
- use a narrow encryption service;
- authenticated encryption;
- key version metadata to permit rotation;
- master key comes from secret management/environment;
- never log plaintext.

Do not implement home-grown cryptography where a standard runtime/library primitive exists.

---

# 38. Media privacy

A private database record cannot point to a permanently public media URL.

For private images:
- authenticated/restricted Cloudinary delivery;
- short-lived signed access where needed;
- authorization before signed delivery generation.

For public images:
- only assets explicitly associated with public projection data may use public delivery.

When an org becomes private or a challenge becomes private/unpublished:
- public projections disappear;
- media delivery policy must not continue leaking previously private assets through an unrestricted permanent URL.

Implement cleanup/reconciliation for orphaned media.

---

# 39. Resilience and dependency behavior

PostgreSQL:
- required dependency;
- no fake degraded write mode.

Cache Redis:
- optional for many reads;
- fail fast and fall back safely.

Queue Redis:
- async side effects may be delayed if unavailable;
- business transaction remains recorded with outbox;
- outbox backlog is observable and replayable.

Resend/Cloudinary/S3/Slack/Discord:
- strict timeouts;
- bounded retries only where operations are idempotent;
- jittered exponential backoff;
- circuit breaker after repeated external dependency failure;
- provider-specific idempotency where available;
- clear failed state and retry/operations visibility.

Do not retry permanent 4xx/provider validation failures blindly.

---

# 40. Observability

Implement:
- structured JSON logs;
- request/correlation ID;
- OpenTelemetry traces;
- OpenTelemetry metrics;
- propagation from API request to DB/outbox event to queue job to worker/external provider where practical;
- error/event correlation;
- environment/service/version attributes.

Metrics at minimum:
- request rate, latency, error rate by route template;
- auth failures and rate-limit events;
- PostgreSQL pool saturation;
- slow queries;
- Redis errors/latency;
- BullMQ depth, wait time, active jobs, failures, retries;
- oldest pending outbox age;
- email send/delivery/bounce/complaint rates;
- image/object upload failures;
- final submission success/failure;
- judging completion;
- export duration/failure;
- integration delivery failure;
- cache degraded-mode count.

Do not put user PII, tokens, cookies, passwords, raw private submissions, or integration secrets into trace attributes/logs.

Audit logs are not debug logs.

---

# 41. Testing requirements

Do not call the backend production-ready without the following.

## 41.1 Unit tests

Services:
- role/permission policy;
- organization lifecycle;
- invitation/join-code rules;
- challenge schedule/lifecycle;
- participation eligibility;
- team capacity;
- submission requirements;
- deadline enforcement;
- scoring calculations;
- result finalization;
- portfolio stage transitions;
- notification preference rules.

## 41.2 Real PostgreSQL integration tests

Use a real PostgreSQL test database in CI, not only Prisma mocks.

Test:
- migrations;
- foreign keys;
- same-tenant composite constraints;
- partial indexes/uniques;
- check constraints;
- RLS;
- runtime DB role permissions;
- transaction-local tenant context;
- TypedSQL/raw SQL;
- public projection safety.

## 41.3 Authorization matrix tests

For every sensitive route:
- expected role allowed;
- lower role denied;
- unrelated org user denied;
- forged resource ID from another tenant denied;
- suspended organization behavior;
- deleted/inactive membership behavior;
- external judge only sees assigned challenge/submission projection;
- public route contains only safe fields.

Cross-tenant escape tests are mandatory.

## 41.4 Concurrency/deadline tests

Prove:
- final submission just before/at/after deadline behaves deterministically;
- two simultaneous finalizations are safe;
- deadline extension racing finalization is safe;
- two users cannot overfill team;
- join-code usage limit cannot be exceeded;
- last owner cannot disappear;
- scorecards do not double-submit.

Use database time in tests where production uses database time.

## 41.5 Queue/outbox tests

Test:
- duplicate job delivery;
- provider timeout then retry;
- worker crash after provider side effect but before acknowledgment;
- Redis interruption;
- stale outbox reconciliation;
- deterministic job IDs;
- no duplicate email where idempotency is expected;
- queue unavailable after DB commit does not lose required side effect.

## 41.6 E2E critical workflows

At minimum:
1. signup → verify → accept organization invitation;
2. signup → optional join-code onboarding;
3. user with zero organizations remains valid;
4. apply for organization → platform approval → owner membership;
5. admin configures organization and challenge → publishes;
6. member registers/applies → organizer approves;
7. create/join team;
8. save submission → finalize before deadline;
9. finalization after deadline is rejected;
10. deadline extension generates audit/outbox/notification;
11. invite external judge → assign submission → score → submit;
12. organizer finalizes judging/results → publishes;
13. participant sees released feedback only after release;
14. submission promoted to portfolio → stage transition/milestone/metric;
15. support ticket create/comment/resolve;
16. moderation report and platform action;
17. private organization/challenge data never appears in public search.

## 41.7 Security tests

Include regression coverage for:
- IDOR/BOLA;
- CSRF unsafe-method protection;
- join-code brute force/rate limits;
- invalid/expired invitation tokens;
- public media/private media separation;
- XSS-bearing Markdown strings remain source data and are never rendered unsafely by backend HTML generation;
- malicious URLs and SSRF patterns if URL metadata fetching exists;
- webhook replay/signature failure;
- privilege escalation attempts;
- account-linking edge cases where feasible.

---

# 42. Data retention, deletion, and privacy

Create explicit configurable retention policies for:
- sessions;
- invitation/join codes;
- rejected applications;
- form/application responses;
- demographics;
- private submissions;
- support tickets;
- email webhook/event data;
- exports;
- media;
- audit.

Do not invent legal retention durations in code. Provide configuration/default documentation that operators must finalize based on jurisdiction/organization policy.

Account deletion must distinguish:
- data safe to delete;
- organization/business records that must retain referential integrity;
- audit/security records that may need pseudonymization;
- consent/legal records that may require retention.

Collect only the data needed for defined purposes.

---

# 43. Database migrations and production safety

Use Prisma Migrate for ordinary schema changes.

Use reviewed migration SQL for:
- RLS;
- FORCE RLS where required;
- views/public projections;
- partial/advanced indexes;
- pg_trgm extension;
- runtime/migration DB role grants;
- append-only audit permissions;
- PostgreSQL-specific constraints Prisma cannot express directly.

Never run destructive production migration automatically at API startup.

Use expand/contract migrations for risky changes.

For large tables:
- avoid long blocking operations;
- use online-safe index creation where possible;
- separate large backfills from schema deployment.

Provide:
- migration commands;
- rollback/recovery guidance where practical;
- seed/dev data script;
- production bootstrap procedure for the first platform superadmin.

Superadmin bootstrap must be explicit and one-time/controlled. Do not continuously promote an email from an environment variable on every startup.

---

# 44. Backup and disaster recovery expectations

The application must be compatible with managed production infrastructure offering:
- PostgreSQL automated backups;
- point-in-time recovery;
- encrypted storage;
- HA/cross-zone where available;
- tested restore drills.

Treat cache Redis as disposable.

BullMQ Redis should have appropriate persistence/reliability, but the PostgreSQL outbox remains the durable recovery mechanism for required side effects.

Object/media metadata must permit reconciliation.

Do not hard-code arbitrary RPO/RTO promises. Document that operators must set and test them before launch.

---

# 45. Build/development/deployment artifacts

Deliver all backend engineering artifacts needed to operate the repository:

- Bun lockfile.
- Strict `tsconfig`.
- Biome config or equivalent.
- `.env.example` containing names and documentation only, never secrets.
- Prisma schema.
- Prisma migrations including PostgreSQL-specific SQL.
- database seed/dev fixture tooling.
- API entrypoint.
- worker entrypoint.
- graceful shutdown for both.
- OpenAPI generation.
- README with local setup, migrations, testing, worker/API launch, auth provider setup requirements, Cloudinary/Resend/Redis/S3 configuration, and production cautions.
- ADRs for major architecture decisions.
- Dockerfile(s) or one multi-target production Dockerfile suitable for API/worker images.
- local development compose stack for PostgreSQL, cache Redis, queue Redis, and S3-compatible local object storage if used.
- CI workflow if the repository uses GitHub or an equivalent CI definition appropriate to the repository.
- no production credentials embedded in compose or source.
- health/readiness endpoints.
- build/version metadata.
- test fixtures/factories that do not rely on production data.

The local compose environment is for development/testing, not a claim that running single-node Docker Compose is production deployment.

---

# 46. CI quality gate

A merge/deploy candidate must pass:
- frozen/locked dependency install;
- formatter/linter;
- strict typecheck;
- unit tests;
- integration tests against real PostgreSQL and Redis where required;
- migration from empty database;
- migration compatibility check where feasible;
- E2E critical path suite;
- dependency vulnerability scan;
- secret scan;
- build/smoke start;
- OpenAPI generation/contract check.

Do not let CI pass with `skipTests`, broad ignored failures, or disabled type checking.

---

# 47. Engineering principles

Apply SOLID pragmatically:
- clear responsibilities;
- provider abstractions only at real substitution boundaries;
- dependency inversion for external providers;
- small interfaces;
- no “interface for every class” ceremony.

DRY:
- do not create a generic BaseRepository that hides tenant scoping;
- a little repetition is safer than a magical abstraction around security-critical persistence.

YAGNI:
Do not add:
- microservices;
- Kafka;
- Elasticsearch;
- WebSockets;
- custom organization role builders;
- arbitrary workflow DSL;
- payment engine;
- in-app chat;
- AI/ML teammate recommendation;
- private GitHub repository ingestion;
- admin impersonation;
- multi-provider email failover;
- complex experimentation platform.

ACID:
- preserve transactional invariants;
- use the database to enforce correctness;
- do not move critical state into queues/caches.

Least privilege:
- application DB runtime role;
- migration role;
- provider scopes;
- platform roles;
- tenant permissions.

Observability:
- every critical async flow is traceable and measurable.

Security:
- object authorization and cross-tenant isolation are treated as release blockers.

---

# 48. Implementation sequence

Implement in this order so foundations are not retrofitted after business logic exists.

## Phase 0 — Foundation

Build:
- Bun/Elysia app skeleton;
- composition root;
- strict TypeScript;
- config validation;
- structured errors;
- request IDs;
- OpenTelemetry;
- logger;
- PostgreSQL/Prisma;
- database roles/migration strategy;
- Redis clients;
- BullMQ foundations;
- outbox primitives;
- audit primitives;
- idempotency primitives;
- OpenAPI;
- test harness;
- Docker/local services;
- CI.

Do not start challenge features until tenant transactions, errors, auth, and tests are credible.

## Phase 1 — Identity and tenancy core

Build:
- Better Auth;
- user/profile;
- skills;
- organization applications;
- platform approval;
- organizations/settings;
- memberships/roles;
- invitations;
- join codes;
- join requests;
- public org projections;
- RLS/composite tenant FKs;
- authorization matrix tests.

## Phase 2 — Challenges and participation

Build:
- challenge lifecycle;
- schedules;
- tracks/prizes/sponsors;
- terms/consent;
- dynamic forms;
- participant registration/screening;
- announcements/FAQ;
- Cloudinary media;
- deadline reminder events.

## Phase 3 — Teams and submissions

Build:
- teams;
- team invitations;
- matchmaking;
- submission drafts/versions;
- technology tags;
- screenshots;
- private files if enabled;
- finalization transaction;
- deadline race tests.

## Phase 4 — Judging/results

Build:
- staff invitations;
- judges/mentors;
- rubric versioning;
- assignments;
- conflict/recusal;
- scorecards;
- judging finalization;
- result finalization/publication;
- feedback release.

## Phase 5 — Operations/product maturity

Build:
- notification fanout/preferences;
- Resend webhooks/suppression;
- analytics rollups;
- exports;
- support;
- moderation;
- Slack/Discord outbound integrations;
- search;
- rate-limit/noisy-neighbor controls;
- retention jobs.

## Phase 6 — Innovation portfolio

Build:
- promotion from submission;
- direct innovation intake;
- stage gates;
- milestones;
- evidence;
- metrics/measurements;
- portfolio analytics.

Each phase must leave the repository passing lint, typecheck, tests, and migrations. Do not defer all integration/testing to the end.

---

# 49. Required background jobs

At minimum implement idempotent workers/jobs for:

Outbox:
- dispatch pending outbox events;
- reconcile stale/failed dispatches.

Email:
- send transactional email;
- process provider delivery/bounce/complaint consequences where async work is needed.

Notifications:
- fan out in-app notifications;
- optional email/integration fanout respecting preferences.

Reminders:
- registration/submission deadline reminders;
- judging reminders;
- portfolio next-review reminders where configured.

Analytics:
- update/recompute rollups;
- repair rollups from authoritative PostgreSQL.

Exports:
- generate CSV;
- upload to private object storage;
- mark ready/failed/expired;
- cleanup expired export files.

Integrations:
- Slack/Discord webhook delivery;
- retries and failure recording.

Media:
- cleanup orphan Cloudinary images;
- cleanup abandoned object uploads;
- reconcile missing/deleted assets where safe.

Retention:
- expire/revoke old invitations/codes;
- purge expired exports;
- apply configured data retention to ephemeral records;
- prune old idempotency records/webhook receipt data according to policy.

Cache:
- invalidate/warm selected public/dashboard caches from domain events where useful.

Do not make scheduled challenge-state jobs authoritative for security or deadline acceptance.

---

# 50. Configuration

Validate all configuration at process startup.

Define clear categories:
- application environment;
- public/canonical base URL;
- trusted origins;
- database URL/runtime role;
- migration/admin DB URL only for migration tooling, never normal app execution;
- Better Auth secrets/base URL/provider IDs/secrets;
- Google OAuth;
- GitHub OAuth;
- cache Redis URL;
- queue Redis URL;
- Resend API key/sender domain/webhook secret;
- Cloudinary credentials;
- S3 endpoint/region/bucket/credentials;
- object upload feature toggle;
- SSE feature toggle;
- OpenTelemetry exporter settings;
- logging level;
- encryption master key/version for integration secrets;
- rate-limit defaults;
- upload limits;
- retention knobs;
- environment-specific feature flags.

Fail fast on missing required secrets.

Do not dump full configuration into logs.

Do not treat optional providers as required when their associated feature is disabled.

---

# 51. Response/data projection rules

Never return raw Prisma models directly from controllers.

DTOs define safe response projections.

Specific protections:
- organization member response never includes auth account/provider tokens;
- public profile does not include email unless an explicit product requirement later allows it;
- invitation responses do not expose token hashes;
- join-code list does not reveal original code;
- integration response does not reveal encrypted/plaintext secret;
- audit response redacts sensitive before/after values;
- judge projection excludes identities under blind judging;
- public result excludes unreleased scorecards/comments;
- support user endpoint excludes internal notes;
- public challenge excludes private form responses and participant lists;
- media objects return safe delivery references, not provider secrets;
- export metadata does not expose storage credentials/permanent private URL.

---

# 52. Performance and scalability

Start by scaling the modular monolith, not by splitting services.

Optimize in this order:
1. correct indexes/query plans;
2. reduce N+1 queries;
3. project only required fields;
4. cache high-read public/aggregate data;
5. horizontal API replicas;
6. horizontal workers;
7. rollups/materialized views;
8. read replicas if justified;
9. partition very large append-only tables such as audit/notifications only when real scale justifies it.

Use bounded pagination.

Avoid loading whole organizations/challenges into memory for exports.

Stream or batch large reads.

Do not use Redis as a relational query substitute.

Set practical query/transaction timeouts and observe slow queries.

---

# 53. Optional-but-supported capabilities and feature gating

The following capabilities are within architectural scope but should be enabled only when their infrastructure/configuration is present:

- SSE notification stream;
- private non-image document upload;
- Slack outbound webhook integration;
- Discord outbound webhook integration;
- UNLISTED public challenge visibility;
- OPEN_AUTHENTICATED challenge participation;
- mentor challenge role;
- direct continuous innovation-item creation.

Implement them cleanly, but do not let them compromise secure defaults.

Defaults:
- organization PRIVATE;
- organization join INVITE_ONLY;
- challenge participation ORG_MEMBERS_ONLY;
- public project gallery off;
- private submissions;
- no live leaderboard;
- no SSE requirement;
- no WebSockets;
- no open organization membership;
- no private repository scopes.

---

# 54. Threat model to actively test

Treat these as release-blocking threat classes:

1. cross-tenant data leakage;
2. IDOR/BOLA by modified UUID/resource path;
3. role/invitation privilege escalation;
4. join-code brute force;
5. private media leakage;
6. deadline bypass via client clock or stale challenge state;
7. judging manipulation;
8. OAuth/account-linking account takeover;
9. CSRF with cookie auth;
10. SSRF from URL metadata fetching;
11. XSS from Markdown/rich content when rendered by backend/email;
12. duplicate queue side effects;
13. email abuse/reputation damage;
14. noisy tenant resource exhaustion;
15. sensitive export leakage;
16. webhook spoofing/replay;
17. stale cache granting privilege;
18. RLS bypass by runtime DB role;
19. cross-tenant object relation inserted at DB level;
20. internal support/audit notes leaking into ordinary responses.

Write tests and observability around these risks.

---

# 55. Definition of done for every security-critical module

A module is not complete until it has:
- validated DTOs;
- permission rules;
- cross-tenant negative tests;
- DB constraints;
- audit coverage;
- transactional/race behavior tested where relevant;
- consistent error mapping;
- observability;
- rate limiting if abuse-sensitive;
- data-retention classification;
- OpenAPI documentation;
- threat-model review;
- no secrets/PII leaked into logs;
- integration/E2E coverage for its main workflow.

---

# 56. ADRs that must exist

Write concise ADRs for at least:
1. shared-schema organization_id tenancy;
2. modular monolith over microservices;
3. Better Auth for identity with custom domain authorization;
4. PostgreSQL durable sessions;
5. Redis separation for cache versus BullMQ;
6. transactional outbox;
7. Cloudinary image-only policy and automatic delivery format;
8. S3-compatible private object storage for exports/documents;
9. HTTP/polling/SSE before WebSockets;
10. challenge-scoped teams;
11. immutable submission versions;
12. versioned rubrics and no live judging leaderboard;
13. public projection views;
14. post-challenge innovation portfolio;
15. runtime DB role + RLS strategy;
16. no Gmail SMTP fallback;
17. no generic PostgreSQL circuit breaker.

If a major implementation choice differs from this prompt due to a verified current dependency limitation, add an ADR explaining the limitation and preserve the product/security intent.

---

# 57. Documentation deliverables

README must explain:
- what the backend is;
- architecture style;
- module layering;
- API vs worker processes;
- local prerequisites;
- local services;
- installation;
- environment setup;
- migrations;
- seeding;
- running API;
- running workers;
- tests;
- lint/typecheck;
- auth provider configuration;
- Resend setup;
- Cloudinary setup;
- S3 setup;
- Redis topology;
- OpenTelemetry;
- OpenAPI;
- initial superadmin bootstrap;
- production migration safety;
- backup/restore operator responsibility;
- privacy/retention configuration;
- known intentionally deferred non-goals.

Also produce:
- endpoint/OpenAPI reference;
- permissions matrix documentation;
- challenge state transition documentation;
- organization state transition documentation;
- queue/job catalog;
- environment-variable reference;
- audit event catalog;
- test strategy;
- ADR directory.

Do not write documentation that claims unimplemented behavior exists.

---

# 58. Final verification before declaring completion

Before you say the backend is complete:

1. Inspect the full route registry and compare it to the endpoint contract above.
2. Ensure no core endpoint is a stub.
3. Ensure no business controller accesses Prisma directly.
4. Ensure no repository calls external providers.
5. Ensure every tenant-scoped repository query is tenant-aware.
6. Ensure sensitive tenant tables have RLS where planned and runtime role cannot bypass it.
7. Verify public routes use safe projections.
8. Verify the organization visibility setting does not change join policy.
9. Verify challenge visibility does not grant participation rights.
10. Verify an authenticated user can exist with zero organizations.
11. Verify invitation and join-code tokens are hashed and expiring.
12. Verify external judges do not receive broad org membership.
13. Verify submission finalization uses database/server time synchronously.
14. Verify deadline extension/reopen is explicit and audited.
15. Verify submission versions are immutable once finalized.
16. Verify screenshots are capped at four.
17. Verify private Cloudinary media is not publicly addressable.
18. Verify Redis loss cannot become permanent business-state loss.
19. Verify BullMQ queue Redis is configured for no eviction in production guidance.
20. Verify the transactional outbox can recover from queue downtime.
21. Verify Resend email retries are idempotent.
22. Verify no Gmail SMTP fallback exists.
23. Verify score totals are server-calculated.
24. Verify rubric versions cannot mutate after judging starts.
25. Verify no live leaderboard leaks during judging.
26. Verify results require explicit finalization/publication.
27. Verify internal support notes cannot leak.
28. Verify audit rows are append-only for runtime role.
29. Verify all high-risk cross-tenant tests pass.
30. Verify migrations work on an empty database.
31. Verify integration tests use a real PostgreSQL instance.
32. Verify lint, strict typecheck, tests, build, and OpenAPI generation pass.
33. Verify API and worker shut down gracefully.
34. Verify `.env.example` has no real secrets.
35. Verify dependency versions are stable/pinned and compatible with Bun.
36. Verify there is no frontend code added for this task.
37. Verify no microservices/Kafka/Elasticsearch/WebSockets/payment/chat/ML role engine were added.
38. Verify README/ADRs describe actual implemented behavior.
39. Produce a final implementation report mapping every phase/module to completed code, migrations, routes, tests, and any explicitly documented limitation.
40. Do not mark the project production-ready while a security-critical requirement above remains knowingly broken.

---

# 59. Expected final result

The finished repository must provide a cohesive production backend with:

- Bun + Elysia + strict TypeScript;
- PostgreSQL + Prisma + carefully used TypedSQL/raw SQL;
- shared-schema multi-tenancy enforced with organization_id, composite integrity, RLS, and service authorization;
- Better Auth cookie sessions with email/password, Google, GitHub, verification, reset, and superadmin MFA;
- organization onboarding/approval/governance;
- invitations, join codes, join requests;
- profiles and skills;
- public/private organization and challenge discovery;
- challenge lifecycle, schedules, tracks, prizes, sponsors, terms;
- dynamic application forms and participant screening;
- challenge-scoped teams and matchmaking;
- immutable-version submissions with secure image/file handling;
- deadline-safe synchronous finalization;
- challenge-scoped judges/mentors, rubric versioning, scorecards, recusals, finalization, and controlled results publication;
- announcements/FAQ/notifications;
- Resend email and provider webhooks;
- Cloudinary secure image handling;
- S3-compatible private exports/documents;
- Redis cache/rate limits plus separate BullMQ Redis;
- transactional outbox and idempotent workers;
- analytics/rollups/exports;
- support tickets and feature requests;
- moderation;
- innovation portfolio/stage gates/milestones/evidence/metrics;
- search;
- audit;
- rate limits/noisy-neighbor protections;
- OpenTelemetry;
- OpenAPI;
- migrations;
- real integration/E2E tests;
- CI quality gates;
- operational documentation;
- no frontend.

Build exactly this system. Favor correctness, tenant isolation, explicit authorization, auditability, deterministic transactions, maintainability, and recovery over shortcuts or flashy architecture.
