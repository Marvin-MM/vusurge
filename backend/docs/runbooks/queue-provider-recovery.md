# Queue and provider outage recovery runbook

External effects are at-least-once durable obligations. Never “fix” an outage by
deleting outbox, email-delivery, integration-delivery, scan, or cleanup rows.

## Queue Redis outage or loss

1. Keep API writes available only while PostgreSQL is healthy; committed
   outbox rows preserve required effects. Alert on outbox age and depth.
2. Restore a queue Redis configured with `noeviction`. Do not point BullMQ at
   cache Redis.
3. Start one worker replica first. The reconciler returns stale `ENQUEUED` rows
   to `PENDING`; deterministic outbox IDs and delivery source keys suppress
   duplicate obligations.
4. Increase worker capacity gradually while observing database pool waiters,
   per-tenant fairness, provider rate limits, and dead-letter/final failures.
5. Compare source transitions to delivery obligations and run authoritative
   reminder/analytics repair jobs before closing the incident.

## Provider outage

- Leave obligations pending and preserve provider IDs/errors. Retry only calls
  classified as safely repeatable and respect bounded backoff/circuit state.
- For email, reconcile local delivery rows with signed, deduplicated,
  event-time-ordered webhooks. A provider success followed by a local ack
  failure is treated as possible duplicate delivery, not proof of failure.
- For storage/media, keep objects quarantined or tombstoned until inspection,
  scan, or deletion succeeds. Never issue a private download for an unknown or
  failed scan state.
- For Slack/Discord, retain the validated provider host, disallow redirects,
  and never relax SSRF controls to work around an outage.

Close the incident only after backlog age returns to normal, final failures are
owned, and reconciliation finds no missing source-to-delivery obligations.

