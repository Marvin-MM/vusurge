# ADR 0011 — Immutable submission versions

Status: Accepted
Date: 2026-08-16

## Context

A submission is edited repeatedly before a deadline, then judged after it.
If judging read the same mutable row a participant could still edit, two
problems follow: a judge might score content the participant changes a
moment later, and there is no durable record of what was actually submitted
at finalize time — which matters both for fairness disputes and for the
"deadline authority reads `now()` inside the finalizing transaction" rule
(master prompt section 7).

## Decision

`Submission` is a logical identity only — `id`, `challengeId`, `teamId`,
`status`, and two pointers (`draftVersionId`, `finalVersionId`). It holds no
content fields itself. Every edit, including the finalize action, creates a
new, immutable `SubmissionVersion` row (`versionNumber` incrementing,
`isFinal` set exactly once). Nothing in this codebase ever `UPDATE`s a
`SubmissionVersion`'s content columns after insert.

`finalize` is a **synchronous transaction** guarded by an `Idempotency-Key`:
it re-reads the challenge's deadline from PostgreSQL inside the same
transaction that creates the final version and flips `Submission.status`, so
"was this before the deadline" is answered by the database transaction that
also commits the version — never by a queued job that could run late and
retroactively accept a race-losing submission.

Screenshots are bounded (`≤4`) both in the DTO validation and by a database
constraint (a bounded slot column plus a unique index) — not DTO validation
alone, which a direct-to-database path or a future code change could bypass.

## Consequences

- A judge's scorecard always references `finalVersionId`, a value that is
  physically incapable of changing after finalize — reopening a submission
  for correction creates a new version and a new `finalVersionId`, it never
  mutates the one a scorecard already points at.
- Draft autosave is cheap to reason about: every autosave is "create a new
  version, repoint `draftVersionId`," never "find and patch the existing
  row," so there is no lost-update race between two browser tabs editing the
  same draft.
- Storage grows with edit history (every draft save is a permanent row).
  Nothing in this release prunes old non-final versions — they are small
  text rows, and the retention policy for them is left as an explicit
  operator decision (master prompt section 42's "do not invent legal
  retention durations in code") rather than an assumed default.
