# ADR 0008 — S3-compatible private object storage for exports and documents

Status: Accepted
Date: 2026-08-16

## Context

Two features need genuinely private file storage that is not appropriate for
Cloudinary's image-oriented delivery model: CSV data exports (master prompt
section 24.1 — organization member/submission/participation/results data,
potentially sensitive) and, if `FEATURE_DOCUMENT_UPLOADS` is enabled, private
non-image participant documents. Neither is an image, and both must never be
reachable by a guessable or permanent URL.

## Decision

`shared/storage` defines an `ObjectStorage` interface with two
implementations (`S3ObjectStorage`, `NullObjectStorage`, selected by
`OBJECT_STORAGE_ENABLED`), the same provider-boundary shape as
`EmailProvider`/`ImageProvider`. `S3ObjectStorage` wraps `@aws-sdk/client-s3`
+ `@aws-sdk/s3-request-presigner` against any S3-compatible endpoint
(`S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true` for MinIO in local development;
unset for real AWS S3).

Three operations only:

- `putObject(key, body, contentType)` — used by the `export.requested` job
  handler to upload a generated CSV.
- `presignDownloadUrl(key, ttlSeconds)` — a short-lived (`downloadUrlTtlSeconds`,
  default 300s) signed GET URL, minted per request. The bucket itself has no
  public-read policy; a signed URL is the only way to read an object back.
- `deleteObject(key)` — used by the export DELETE endpoint and the retention
  sweep's expired-export cleanup.

Storage keys are deterministic
(`exports/{organizationId}/{exportId}.csv`), so a retried export job
overwrites the same object instead of accumulating duplicates — upload
idempotency falls out of the key scheme rather than needing separate
dedupe logic.

## Consequences

- Local development and the test suite run against a real local MinIO
  instance (the same "real infrastructure over fakes" approach used for
  PostgreSQL and Redis) rather than a mocked S3 client — `tests/e2e/exports.test.ts`
  performs a real upload, a real presigned download, and asserts on the
  actual downloaded bytes.
- A misconfigured deployment with object storage disabled fails loudly:
  `NullObjectStorage` throws `featureDisabled('exports')` on write rather than
  silently pretending to store a file.
- Presigned URLs are minted fresh per download request, never cached or
  stored — a leaked historical URL expires on its own schedule and cannot be
  refreshed without re-authenticating through the API.
