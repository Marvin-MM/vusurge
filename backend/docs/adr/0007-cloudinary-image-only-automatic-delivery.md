# ADR 0007 — Cloudinary for images only, automatic delivery format

Status: Accepted
Date: 2026-08-16

## Context

The platform needs organizer/participant image uploads (avatars, organization
logos, challenge covers, sponsor logos, submission screenshots, portfolio
evidence) without the backend ever proxying raw upload bytes through its own
process, and without shipping a bespoke image-resizing pipeline. Master prompt
section 22 scopes Cloudinary specifically to images and requires that delivery
never depend on a client guessing the right format/quality parameters.

## Decision

`shared/images` defines an `ImageProvider` interface with two implementations
(`CloudinaryImageProvider`, `NullImageProvider`, selected by
`CLOUDINARY_ENABLED`), mirroring the `EmailProvider` boundary (ADR 0016). The
provider is scoped narrowly:

- **Images only.** Every accepted MIME type is a raster image format
  (`uploads.allowedImageMimeTypes`); nothing else is routed through Cloudinary.
  Non-image private files (documents, if `FEATURE_DOCUMENT_UPLOADS` is
  enabled) go through S3 (ADR 0008) instead, never Cloudinary.
- **Signed, narrow upload authorization.** `createUploadAuthorization` signs
  only `timestamp`, `public_id`, `folder`, and `type` — the client uploads
  directly to Cloudinary and the backend never sees the bytes — and the
  result is verified against Cloudinary's own Admin API before any domain
  record is allowed to reference it (`media` module's confirm step).
- **Automatic delivery format, always.** Every delivery URL Cloudinary issues
  for a confirmed asset is built with `fetch_format: 'auto', quality: 'auto'`.
  A client never chooses format/quality parameters, and the backend never
  hand-picks one per asset — Cloudinary negotiates WebP/AVIF/JPEG and
  compression level from the requesting client's own `Accept` header. This
  removes an entire class of "this image was uploaded as a 12MB PNG and is
  served as one" support burden without any code on either side making that
  decision per-request.
- **Two delivery types**, matching `MediaAsset.deliveryType`: `UPLOAD` (public
  once confirmed — logos, covers) and `AUTHENTICATED` (private, signed URL
  with `privateDeliveryTtlSeconds`, for organizer-only content).

## Consequences

- Adding a second image host (a self-hosted image proxy, a different CDN)
  is a second `ImageProvider` implementation; no call site changes, exactly
  as designed for `EmailProvider`.
- The backend holds no image-processing code of its own — no resize
  libraries, no format-detection logic — because Cloudinary's `f_auto`/`q_auto`
  already solves the problem the code would otherwise reimplement.
- A pending (unconfirmed) upload authorization is a genuine orphan risk if
  the client never completes the upload; `media_asset.expiresAt` plus the
  retention sweep (`shared/retention`) is what reaps those, not Cloudinary.
