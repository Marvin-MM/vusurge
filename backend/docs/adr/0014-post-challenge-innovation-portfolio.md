# ADR 0014 — Post-challenge innovation portfolio

Status: Accepted
Date: 2026-08-16

## Context

A challenge's lifecycle ends at results publication, but an organization's
interest in a promising submission doesn't — it needs to track the idea
through validation, prototyping, and scaling, potentially years later, by
which point the originating challenge and submission are historical
context, not the object being managed. Modeling that as more fields on
`Challenge`/`Submission` would conflate two lifecycles with different shapes,
different audiences, and different retention needs. Master prompt section 26
also explicitly forbids an arbitrary workflow designer — the stage set must
be fixed, not organization-configurable.

## Decision

`Innovation` is its own tenant-scoped entity, related to its origin only
loosely: `sourceChallengeId`/`sourceSubmissionId` are optional
composite-FK references (`onDelete: SetNull`), never a hard dependency —
an innovation item outlives the challenge it came from, and one can also be
created directly for continuous ideation with no challenge at all.

**One promotion per submission by default**, enforced by
`@@unique([sourceSubmissionId])` at the database level — a second
`promote-to-innovation` call for the same submission is rejected by the
unique constraint's conflict, not by a race-prone "check then insert" in
service code.

**A fixed eight-value stage enum** (`DISCOVERY` through `CLOSED`, plus
`PAUSED`), and stage transitions go through exactly one action —
`transition-stage` — never a direct `PATCH` on the stage field. Every
transition writes an append-only `InnovationStageHistoryEntry` (previous
stage, new stage, decision, decision-maker, evidence references, next review
date) in the same transaction that moves the stage, so the portfolio's
history is reconstructible from the audit trail alone, not inferred from
`updatedAt` timestamps. Any stage may move to any other stage — the master
prompt fixes the stage *set*, not a restricted transition graph between
them, unlike submission status.

**Milestones, evidence, and metrics/measurements are child collections**,
each independently CRUD-able and each carrying its own `organizationId` for
RLS, rather than JSON blobs on the innovation row — an evidence attachment
or a metric measurement needs its own audit trail and its own delete
lifecycle, which a JSON column can't give it.

**Public visibility is opt-in and separate from internal fields.**
`publicVisible` defaults to `false`; the public projection
(`public_innovation_view`) exposes only the fields explicit in master prompt
34.3 ("organization-approved... items/metrics") and never the owner, resource
notes, next review date, or source linkage.

## Consequences

- Deleting or archiving the originating challenge never cascades into
  deleting an innovation item that came from it — the `SetNull` FK means the
  linkage becomes historical metadata, not a hard dependency that would
  force keeping challenges around indefinitely.
- Portfolio analytics (`GET .../analytics/portfolio`) can compute a genuine
  conversion rate — promoted innovations over finalized submissions — because
  the promotion linkage is a real, queryable foreign key, not a
  free-text reference.
- A future "public project results" view (also section 34.3, not yet built)
  can follow the exact same pattern this ADR establishes: a curated view,
  an opt-in visibility flag on the source row, minimal public-safe columns.
