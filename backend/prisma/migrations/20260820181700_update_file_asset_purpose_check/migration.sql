-- Extend the file_asset (purpose, resource_type) invariant CHECK constraint
-- to cover FORM_ATTACHMENT, mirroring the existing pattern for the other
-- three purposes (see prisma/migrations/20260817000000_initial_baseline).
-- Split into its own migration/transaction because it references the
-- FORM_ATTACHMENT enum value added in the immediately preceding migration —
-- Postgres does not allow a new enum value to be used until the transaction
-- that added it has committed.
ALTER TABLE "file_asset" DROP CONSTRAINT "file_asset_challenge_purpose_chk";
ALTER TABLE "file_asset" ADD CONSTRAINT "file_asset_challenge_purpose_chk" CHECK (
  (purpose = 'SUBMISSION_PRESENTATION' AND challenge_id IS NOT NULL AND resource_type = 'submission_version')
  OR (purpose = 'SUPPORT_ATTACHMENT' AND resource_type = 'support_ticket')
  OR (purpose = 'PORTFOLIO_EVIDENCE' AND resource_type = 'innovation')
  OR (purpose = 'FORM_ATTACHMENT' AND resource_type = 'form_definition')
);
