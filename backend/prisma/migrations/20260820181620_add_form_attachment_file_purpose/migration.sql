-- AlterEnum
ALTER TYPE "FileAssetPurpose" ADD VALUE 'FORM_ATTACHMENT';

-- The DROP INDEX statements Prisma's diff proposed here for the 4 hand-written
-- pg_trgm search indexes (challenge_title_trgm_idx, organization_name_trgm_idx,
-- skill_name_trgm_idx, technology_tag_name_trgm_idx) are false positives —
-- those indexes have no declarative representation in the .prisma schema
-- files, so every diff proposes dropping them. Deliberately omitted per the
-- create-migration.ts tool's own warning; see docs/adr/0015 and 0013.

-- A newly added enum value cannot be used (even in a CHECK constraint
-- definition) within the same transaction that added it — Postgres only
-- makes it visible for use after that transaction commits. The
-- file_asset_challenge_purpose_chk update that references FORM_ATTACHMENT
-- is therefore a separate migration (see the following migration file),
-- applied in its own transaction after this one has committed.
