# ADR 0012 — Versioned rubrics and no live judging leaderboard

Status: Accepted
Date: 2026-08-16

## Context

A rubric organizers edit after judging has started creates two distinct
integrity problems. First, a criterion weight change mid-judging makes
already-submitted scorecards incomparable to ones submitted after the edit —
the same raw scores would mean a different weighted total depending on when
the judge happened to score. Second, exposing running rankings while judging
is in progress lets a judge see how their score would move a submission's
rank before submitting it, which is exactly the kind of anchoring the blind-
judging feature exists to prevent (master prompt section 17).

## Decision

**Rubrics are versioned and freeze automatically.** A `RubricVersion` becomes
immutable the moment judging starts for the challenge, or the moment any
scorecard against it is submitted — whichever comes first. An organizer who
needs to change criteria after that point creates a new `RubricVersion`
rather than editing the frozen one; every scorecard keeps a durable pointer
to the exact version it was scored against, so a later rubric change can
never retroactively alter what an already-submitted score means.

**Totals are server-computed, in SQL, from `numeric` columns.** A scorecard's
weighted total is never accepted from the client and never computed in
application code from floating-point intermediate values — it is derived
server-side from the criterion scores and the frozen rubric's weights at
submission time.

**No live leaderboard exists during judging.** `JudgingViewProgress` exposes
*completion* state only — how many assignments are outstanding, which judges
haven't submitted — never a ranking, a running score, or a "current position"
for any submission. Rank and aggregate score become visible only after the
organizer's explicit `results/finalize` and `results/publish` actions.

## Consequences

- A judge cannot infer standings from the progress endpoint no matter how it
  is queried — the rank/score fields simply are not in that response's shape,
  not filtered out by a permission check that a bug could weaken.
- Reopening a scorecard for correction after the fact is an explicit,
  audited organizer action (with a required reason), not an implicit
  consequence of a rubric edit — the two are deliberately separate
  operations with separate audit trails.
- Historical scorecards remain interpretable indefinitely: `RubricVersion`
  rows are never deleted while a scorecard references them, so "what did
  this score mean" is always answerable from the data itself.
