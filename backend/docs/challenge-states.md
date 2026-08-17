# Challenge state transitions

`Challenge.status` (`prisma/schema/challenge.prisma`) is one of:

```
DRAFT → SCHEDULED → OPEN → JUDGING → RESULTS_READY → RESULTS_PUBLISHED → ARCHIVED
                       ↓
                   CANCELLED
```

Master prompt section 10.4: *"the displayed/admin state may be persisted or
derived, but security-critical eligibility must use authoritative timestamps
and database/server time rather than trusting a delayed worker update."*
This codebase takes the derived option for `CLOSED`/`JUDGING`: **no code path
ever writes those two values to the database.** They exist in the fixed enum
for API consumers, but every place that needs to know "is the submission
window actually closed" or "has judging actually started" reads the
authoritative fields directly (`submissionDeadline` vs. database `now()`,
`judgingFinalizedAt`, the existence of `JudgeAssignment`/`Scorecard` rows) —
never the cached `status` string. **No queue job is ever authoritative for
opening a challenge or enforcing its submission deadline.**

## Persisted transitions

| From | Action | To | Guard | Code |
|---|---|---|---|---|
| `DRAFT` | `POST .../publish` | `OPEN` (or `SCHEDULED` if `registrationOpenAt` is in the future) | `submissionDeadline` must be set | `challenges.service.ts#publish` |
| `SCHEDULED` | *(none — registration opening is a read-time projection, not a transition)* | | | |
| `OPEN` (deadline elapsed) | `POST .../reopen` | `OPEN` (new deadline) | Effectively-closed check: `status === 'OPEN' AND submissionDeadline <= now()` (database time), or literal `status === 'CLOSED'` defensively; new deadline must be in the future | `challenges.service.ts#reopen` |
| any except `ARCHIVED`/`CANCELLED` | `POST .../cancel` | `CANCELLED` | reason required | `challenges.service.ts#cancel` |
| any except `ARCHIVED` | `POST .../archive` | `ARCHIVED` | reason required | `challenges.service.ts#archive` |
| — (judging finalized) | `POST .../results/finalize` | `RESULTS_READY` | `judgingFinalizedAt` must already be set (via `POST .../judging/finalize`, which does **not** itself change `status`) | `judging.service.ts#finalizeResults` |
| `RESULTS_READY` | `POST .../results/publish` | `RESULTS_PUBLISHED` | at least one `SubmissionResult` row must exist | `judging.service.ts#publishResults` |
| `RESULTS_PUBLISHED` | `POST .../results/retract` | **`status` unchanged** — only `resultsPublishedAt` is cleared and `resultsRetractedAt` is set | fresh session, reason required | `judging.service.ts#retractResults` |

Retraction is deliberately not a status rollback to `RESULTS_READY`: the
`SubmissionResult` rows themselves are untouched, so a re-`publish` after
fixing a mistake does not need to re-finalize.

## Derived (never persisted) values

- **`CLOSED`** — `status === 'OPEN'` and `submissionDeadline` has passed.
  Read directly wherever it matters: submission finalize
  (`submissions.service.ts`), team invitation acceptance/creation
  (`teams.service.ts`'s `isLocked`), and the `reopen` precondition above.
- **`JUDGING`** — informational only; nothing in this codebase gates on it.
  What is actually authoritative during this period is the presence of an
  active `RubricVersion`, `JudgeAssignment` rows, and `Scorecard` progress —
  queried directly by the judging endpoints, never inferred from `status`.

## Reversibility

| Transition | Reversible? |
|---|---|
| `DRAFT → OPEN/SCHEDULED` (publish) | No explicit "unpublish"; a published challenge can only move forward (reopen/cancel/archive), never back to `DRAFT`. |
| Deadline extension/reopen | Not itself reversible, but produces a `ChallengeScheduleChange` history row (previous value, new value, actor, reason, timestamp) so the prior deadline is always recoverable from history. |
| `CANCELLED` | Terminal. No un-cancel action exists. |
| `ARCHIVED` | Terminal. No un-archive action exists. |
| `RESULTS_PUBLISHED → (retracted)` | Yes — `results/publish` may be called again after `results/retract`; the underlying `SubmissionResult` rows are preserved. |

## Structural vs. cosmetic edits

Once a challenge leaves `DRAFT`, `PATCH .../challenges/:id` rejects
**structural** field changes (`minTeamSize`, `maxTeamSize`,
`participationPolicy`, `visibility`, and other fields that change program
mechanics after people may have already registered) with `409`, while
**cosmetic** fields (`summary`, `description`, and similar copy) remain
editable for the life of the challenge. Deadline changes go through the
dedicated `reschedule`/`extend-deadline`/`reopen` actions, never the generic
`PATCH`.

## Deadline-shortening protection

`reschedule` may shorten the submission deadline freely while the challenge
has zero participants. Once at least one participant has registered,
shortening is blocked by default (master prompt section 10.5) — only
`extend-deadline` (strictly later) remains available, and every
deadline/schedule change writes a `ChallengeScheduleChange` row plus an audit
event plus an outbox notification event, regardless of direction.

## Audit and notification side effects

Every explicit transition above writes an `AuditEvent` in the same
transaction as the status change (see `docs/audit-events.md` for the exact
action names) and, where a participant-facing effect exists (publish,
reschedule, deadline-extend, reopen, cancel, results-published), an outbox
event on the `notification-fanout` queue (see `docs/queue-catalog.md`).
