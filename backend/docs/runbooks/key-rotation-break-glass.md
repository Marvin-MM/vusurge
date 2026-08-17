# Key rotation and break-glass administration runbook

## Application encryption-key rotation

Ciphertext stores its key version and is bound to the owning row by authenticated
additional data. The running process currently loads one key version at a time,
so rotation is an explicit maintenance operation, not a blind environment-value
swap.

1. Inventory encrypted integration, OAuth, and pending email-delivery records;
   take a protected backup and suspend writes that create new ciphertext.
2. Run a reviewed one-off re-encryption command in an isolated maintenance job
   that can read the old key and writes each row with the new key/version. Never
   print plaintext or either key. Verify row counts and decrypt samples in the
   maintenance transaction.
3. Deploy the new key and incremented `ENCRYPTION_KEY_VERSION`, then resume
   writes. Keep the old key in the secrets manager only for the approved
   rollback window; remove it after verification.
4. Audit the operator, reason, affected versions/counts, and completion. Rotate
   immediately after suspected disclosure and invalidate provider credentials
   whose plaintext may have been exposed.

## Platform break-glass role change

- There is no public platform-role mutation API. Use
  `bun run bootstrap:superadmin -- --email ... --reason ...` only from an
  approved administrative environment holding `MIGRATION_DATABASE_URL`.
- The target must already have verified email and enrolled MFA. The command
  refuses a runtime `NOBYPASSRLS` connection and commits the role plus
  append-only audit event atomically.
- Use two-person approval, a time-bounded incident ticket, and an independent
  review of the resulting audit event. Revoke emergency access with a reviewed
  operator command/migration and append a revocation audit event; never update
  or delete audit history.

