# ADR 0006 — Transactional outbox for asynchronous side effects

Status: Accepted
Date: 2026-08-16

## Context

Many business operations owe an asynchronous effect: approving an organization
application sends email, extending a deadline notifies participants, publishing
results triggers fan-out and analytics.

The naive implementations both lose correctness:

- **Commit, then enqueue.** If the process dies between the two, the change is
  durable and the effect is lost. Nobody is notified that their deadline moved.
- **Enqueue, then commit.** If the transaction rolls back, the effect fires for
  a change that never happened. Participants are told about a deadline
  extension that does not exist.

Neither can be fixed with retries, because the failure is the absence of a
record that anything was owed.

## Decision

The business change, its audit record, and an `outbox_event` row are written in
**one PostgreSQL transaction**. The outbox row is the durable statement that an
effect is owed.

After commit, a dispatcher in the worker process:

1. Claims a bounded batch with `select ... for update skip locked`, so several
   dispatcher replicas share the backlog without blocking each other and without
   any two claiming the same row.
2. Publishes each event to BullMQ using **the outbox row's own ID as the job
   ID**, so a redelivery of the same obligation collapses into one job.
3. Claims the row as `ENQUEUED` atomically in PostgreSQL, then publishes the
   job after the claim transaction commits.

That ordering is chosen deliberately. If the process stops after claiming but
before publishing, the stale-claim reconciler returns the leased row to
`PENDING`; if it stops after publishing, the stable BullMQ job ID collapses the
retry. Handlers still tolerate at-least-once delivery.

States are `PENDING → ENQUEUED → PROCESSED`, with `FAILED` as a terminal state
for operator attention. A reconciler returns rows stuck in `ENQUEUED` past a
configurable window back to `PENDING`, and marks rows that exhaust their attempt
budget `FAILED` so they stop consuming dispatch capacity while staying visible.

An optional `dedupe_key` with a unique index collapses a logically identical
obligation produced by two code paths into one row.

Nine logical queues exist (`email`, `notification-fanout`, `reminders`,
`integrations`, `analytics`, `exports`, `media-cleanup`, `cache-maintenance`,
`outbox-dispatch`), each with its own worker concurrency budget. The split is
for priority and bulkheading only — so a burst of exports cannot starve
transactional security email — not one queue per event type.

## Consequences

- **Every handler must be idempotent.** At-least-once delivery is the contract,
  not an edge case.
- Redis losing the queue delays effects; it cannot lose them. The backlog is
  observable (`oldest pending outbox age` is a metric) and replayable.
- Handlers re-read authoritative state from PostgreSQL rather than trusting the
  payload, which carries identifiers and safe scalars only. A payload that
  embedded business state would eventually act on a stale copy of it.
- The outbox table is append-heavy and needs periodic pruning of `PROCESSED`
  rows, which the retention job owns.
