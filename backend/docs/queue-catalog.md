# Queue catalog

Nine fixed logical BullMQ queues (`src/shared/queue/queue-names.ts`), each on
its own bulkhead of worker concurrency so a burst of heavy work can never
starve urgent transactional work. Deliberately coarse — a queue per event
type would multiply Redis keys, worker connections, and dashboards without
improving isolation.

Every job is dispatched from the transactional outbox
(`src/shared/outbox/`): a business change, its `AuditEvent`, and an
`OutboxEvent` row are written in one PostgreSQL transaction; a separate
dispatch loop in the worker process (`src/workers/worker-runtime.ts`) polls
`OutboxEvent` with `FOR UPDATE SKIP LOCKED`, publishes due rows to BullMQ
using the outbox row's own ID as the BullMQ job ID (so redelivery is safe —
never a duplicate side effect), and reconciles rows stuck `ENQUEUED` past
`OUTBOX_STALE_ENQUEUED_AFTER_MS`. **No queue job is ever authoritative for
challenge opening, submission deadline enforcement, or judging state** —
every such check reads the database directly at the moment it matters.

## Queues

| Queue | Purpose | Default concurrency (env var) |
|---|---|---|
| `email` | Transactional and security email. Highest priority; never starved. | 10 (`WORKER_CONCURRENCY_EMAIL`) |
| `notification-fanout` | In-app notification fan-out and preference-aware channel dispatch. | 8 (`WORKER_CONCURRENCY_NOTIFICATION_FANOUT`) |
| `reminders` | Deadline, judging, and portfolio review reminders. | 4 (`WORKER_CONCURRENCY_REMINDERS`) |
| `integrations` | Outbound Slack/Discord webhook delivery. | 4 (`WORKER_CONCURRENCY_INTEGRATIONS`) |
| `analytics` | Rollup computation and repair. Heavy; isolated from urgent work. | 2 (`WORKER_CONCURRENCY_ANALYTICS`) |
| `exports` | CSV generation and upload to private object storage. Heavy. | 2 (`WORKER_CONCURRENCY_EXPORTS`) |
| `media-cleanup` | Orphaned Cloudinary assets and abandoned object uploads. | 2 (`WORKER_CONCURRENCY_MEDIA_CLEANUP`) |
| `cache-maintenance` | Cache warming/invalidation driven by domain events. | 2 (`WORKER_CONCURRENCY_CACHE_MAINTENANCE`) |
| `outbox-dispatch` | Reserved for outbox dispatch/reconciliation/retention-sweep job types, if ever queued as jobs themselves (currently the dispatch loop runs in-process on a timer, not as a BullMQ job). | 1 (`WORKER_CONCURRENCY_OUTBOX_DISPATCH`) |

`QUEUE_REDIS_URL` **must** be a separate Redis deployment from
`CACHE_REDIS_URL` in production, configured with `maxmemory-policy=noeviction`
and AOF persistence — BullMQ's data structures are not a cache and must
never be evicted under memory pressure. Config validation refuses to boot in
production if the two URLs are identical. See ADR-0005.

## Event type → handler registry

Every outbox event type is declared in the typed
`src/shared/outbox/event-catalog.ts` catalogue and has exactly one handler in
`src/workers/register-handlers.ts`. Startup and CI compare the two sets and
fail on a missing or undeclared handler; queue selection is also checked by the
outbox writer, so this table is evidence rather than a hand-maintained source
of truth.

| Event type | Queue | Handler | Effect |
|---|---|---|---|
| `organization_application.decided` | `email` | `handleOrganizationApplicationDecided` | Emails + notifies the applicant of approval/rejection. |
| `organization_invitation.created` | `email` | `handleOrganizationInvitationCreated` | Emails the invite link; notifies an existing account in-app. |
| `organization_join_request.decided` | `email` | `handleOrganizationJoinRequestDecided` | Emails + notifies the requester of approval/rejection. |
| `team.invitation_created` | `email` | `handleTeamInvitationCreated` | Emails the accept link; notifies the invitee in-app. |
| `account.deletion_requested` | `reminders` | `handleAccountDeletionRequested` | Emails a confirmation with the eligible-deletion date and a cancel link. No in-app notification (no `NotificationCategory` exists for this single, security-emailed, rare event — adding one would require a Postgres enum migration disproportionate to the benefit). |
| `account.deletion_executed` | `cache-maintenance` | `handleAccountDeletionExecuted` | Verifies the immutable completed transition and clears user-profile projections. |
| `email.delivery_requested` | `email` | `handleEmailDeliveryRequested` | Claims a locally de-duplicated encrypted delivery obligation, records its attempt, and calls the provider. |
| `challenge.published` | `notification-fanout` | `handleChallengePublished` | Notifies interested members a challenge opened. |
| `challenge.rescheduled` | `notification-fanout` | `handleChallengeRescheduled` | Notifies participants of a schedule change. |
| `challenge.deadline_extended` | `notification-fanout` | `handleChallengeDeadlineExtended` | Notifies participants of the new deadline. |
| `challenge.reopened` | `notification-fanout` | `handleChallengeReopened` | Notifies participants the challenge reopened. |
| `challenge.cancelled` | `notification-fanout` | `handleChallengeCancelled` | Notifies participants of cancellation. |
| `challenge.results_published` | `notification-fanout` | `handleResultsPublished` | Emails + notifies participants results are live. |
| `challenge.staff_invitation_created` | `email` | `handleChallengeStaffInvitationCreated` | Emails the judge/mentor invite link. |
| `judging.assignment_created` | `email` | `handleJudgeAssignmentCreated` | Emails + notifies the judge of a new assignment. |
| `judging.scorecard_submitted` | `notification-fanout` | `handleScorecardSubmitted` | Creates the organizer-facing completion notification. |
| `matchmaking.interest_expressed` | `notification-fanout` | `handleMatchmakingInterestExpressed` | Notifies the post owner in-app only — the interested party's contact details are never disclosed by this event. |
| `media.asset_deletion_requested` | `media-cleanup` | `handleMediaAssetDeletionRequested` | Deletes the provider image and advances the database tombstone idempotently. |
| `file.scan_requested` | `media-cleanup` | `handleFileScanRequested` | Streams the quarantined private object through ClamAV and records clean/infected state. |
| `file.deletion_requested` | `media-cleanup` | `handleFileDeletionRequested` | Removes the private object, retains its tombstone, and releases quota only after provider success. |
| `webhook.resend_event_received` | `email` | `handleResendWebhookEventReceived` | Processes a verified Resend delivery/bounce/complaint webhook; updates suppression state. |
| `support_ticket.updated` | `email` | `handleSupportTicketUpdated` | Emails + notifies the ticket owner of a status/comment change. |
| `submission.finalized` | `notification-fanout` | `handleSubmissionFinalized` | Creates the durable finalization notification obligation. |
| `export.requested` | `exports` | `handleExportRequested` | Generates the CSV, uploads it to private object storage at a deterministic key, marks the `DataExport` row ready. |
| `innovation.stage_changed` | `notification-fanout` | `handleInnovationStageChanged` | Notifies the innovation owner of a stage transition. |
| `integration.delivery_requested` | `integrations` | `handleIntegrationDeliveryRequested` | Claims a per-destination obligation, sends through a DNS-pinned Slack/Discord transport, and records each attempt. |

`integration.test` is the delivery's semantic source label. The HTTP endpoint
returns `202` after committing `integration.delivery_requested`; the provider
call occurs only in the integration worker.

## Handler idempotency

Every handler is written to be safely re-run. Payloads contain identifiers and
safe scalars; handlers re-read authoritative state in a tenant-scoped
transaction, use compare-and-set transitions/local delivery keys, and pass a
stable provider idempotency key where the provider supports one. Provider
idempotency is defence in depth, not the durable source of uniqueness.

## Scheduled-job catalogue

BullMQ Job Schedulers are registered idempotently at worker startup from
`src/workers/scheduled-jobs.ts`. Retention, outbox reconciliation, expired
email-lease recovery, and abandoned-upload cleanup are active scheduled jobs;
their intervals are configuration values. Per-challenge deadline/judging and
portfolio reminder rows are still tracked separately from this operational
catalogue and must use deterministic IDs when added.
