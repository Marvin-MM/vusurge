# ADR 0010 — Challenge-scoped teams

Status: Accepted
Date: 2026-08-16

## Context

A participant needs a team to submit, but "team" in this platform is not an
organization-wide concept — the same person can be solo in one challenge and
on a three-person team in another, and a team's roster, captain, and capacity
rules only make sense in the context of one specific challenge's
`minTeamSize`/`maxTeamSize`.

## Decision

`ChallengeTeam` belongs to exactly one `(organizationId, challengeId)` pair,
never to an organization at large. Every approved participant is normalized
into a team the moment they're approved — solo participation creates an
implicit one-member team (`isSolo = true`) rather than leaving submissions
without a team owner, so the submission model (ADR 0011) never needs a
nullable-team special case.

Two correctness rules are enforced at the database level, not just in
service code:

- **One active team per participant per challenge.** A participant cannot be
  on two teams for the same challenge simultaneously — checked under the
  same row lock that governs capacity, not a separate uniqueness constraint
  that a race could still slip past.
- **Capacity is a genuine concurrent-insert problem, not a lost-update
  problem.** Two people accepting a team invitation for the last open slot
  at the same instant is `SELECT ... FOR UPDATE` on the team row, not an
  optimistic-concurrency `version` check alone (`ChallengeTeam.version`
  exists as a secondary guard, but the row lock is what actually serializes
  the race — proven in `tests/concurrency/team-capacity.test.ts`).

An **organizer exception path** exists for cases the ordinary flow can't
reach cleanly — reassigning a participant across teams, correcting a
capacity violation after the fact — recorded as its own audited action
(`team.organizer_exception`) rather than silently mutating team membership
through the same code path a participant uses.

## Consequences

- Team identity, capacity, and invitations are always resolved against one
  challenge's rules; there is no cross-challenge "my team" concept to keep
  consistent.
- The implicit solo-team normalization means `Submission.teamId` is never
  optional — every submission has exactly one owning team, solo or not,
  which simplifies every downstream query (judging, results, analytics) that
  joins through it.
- A challenge's `minTeamSize`/`maxTeamSize` change after teams already exist
  is a policy question the service layer must handle explicitly (existing
  teams are grandfathered, not retroactively invalidated) — documented at
  the challenge-update call site, not silently ignored.
