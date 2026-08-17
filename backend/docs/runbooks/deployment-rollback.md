# Deployment and rollback runbook

This runbook is the minimum production change procedure. The deployment owner
must adapt health thresholds, approval roles, and observation windows to the
target environment.

## Before deployment

1. Run `bun install --frozen-lockfile` and `bun run release:gate` from
   `backend/`; require a clean generated-artifact diff.
2. Build both Docker targets once, identify the resulting immutable image
   digest, scan that digest, and deploy the same digest to API and worker.
3. Confirm a recent restorable database backup and record the target PITR
   timestamp. Do not continue if the restore procedure has never been drilled.
4. Review every unapplied migration. Take an application-level maintenance
   window for any rewrite/lock whose duration has not been measured on
   representative data.
5. Verify secrets, trusted proxy CIDRs, provider webhook domains, Redis
   separation, queue `noeviction`, scanner health, and capability flags.

## Deployment order

1. Stop writers only when the reviewed migration requires it; workers may be
   drained independently.
2. Run `prisma migrate deploy` once using `MIGRATION_DATABASE_URL`. API and
   workers never receive that credential.
3. Start workers, then API replicas, using the scanned image digest. Wait for
   `/health/ready`; do not treat liveness as readiness.
4. Smoke-test authentication, a tenant-scoped read, an outbox-producing write,
   queue processing, and a private download authorization.
5. Observe error rate, database pool waiters, outbox age, queue depth,
   scheduler lag, and provider failures through the agreed observation window.

## Rollback

- Roll application code back by redeploying the previous immutable image
  digest. Never run `migrate reset`, delete migration rows, or edit an applied
  migration.
- Database migrations are forward-only. If code rollback is incompatible,
  deploy a reviewed compensating migration before restoring the old image.
- If integrity cannot be repaired forward, stop all writers and follow the
  backup/PITR runbook. Record the exact recovery point and reconcile the outbox
  and external providers after restoration.
- Preserve logs, audit events, failed outbox rows, and migration output for the
  incident review.

