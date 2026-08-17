# Backup, PITR, and restore-validation runbook

PostgreSQL backup/PITR and object-storage versioning are infrastructure-owner
responsibilities. Do not advertise an RPO or RTO until operators have measured
both on representative data.

## Required controls

- Managed PostgreSQL automated backups, encrypted storage, PITR, and HA where
  available; backups must be isolated from application credentials.
- Versioning/retention for the private object bucket and a documented mapping
  between database recovery time and recoverable object generations.
- Queue Redis persistence appropriate to BullMQ. Cache Redis is disposable;
  PostgreSQL outbox rows remain the source for required asynchronous effects.

## Restore drill

1. Restore into an isolated account/network and database name using a chosen
   recovery timestamp. Never overwrite the production database for a drill.
2. Bootstrap the migration/runtime/public-view roles, then confirm migration
   history and schema drift without applying unreviewed changes.
3. Connect as the runtime role and run the database privilege/RLS tests. Verify
   it is `NOBYPASSRLS`, owns no tables, cannot assume `ip_public_views`, and
   sees no tenant rows without transaction context.
4. Reconcile object metadata against the private bucket. Missing objects stay
   unavailable and alert; they are never silently marked clean.
5. Start workers with provider delivery disabled, inspect pending/enqueued
   outbox and delivery rows, and establish the duplicate-delivery boundary.
6. Start the API, run critical read-only workflows, then allow worker delivery
   and follow `queue-provider-recovery.md`.
7. Record recovered timestamp, data-loss window, total recovery time, failed
   checks, and owners/actions. Securely destroy the drill environment.

Legal holds and append-only audit/consent records must survive restoration and
must not be removed by application retention jobs.

