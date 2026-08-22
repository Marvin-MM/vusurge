import { t } from 'elysia'
import { Uuid } from '../../shared/http'

const MediaAssetPurpose = t.Union([
  t.Literal('USER_AVATAR'),
  t.Literal('ORGANIZATION_LOGO'),
  t.Literal('CHALLENGE_COVER'),
  t.Literal('SPONSOR_LOGO'),
  t.Literal('SUBMISSION_SCREENSHOT'),
  t.Literal('SUPPORT_TICKET_SCREENSHOT'),
  t.Literal('PORTFOLIO_EVIDENCE'),
])

export const UploadAuthorizationBody = t.Object({
  purpose: MediaAssetPurpose,
  organizationId: t.Optional(Uuid),
  challengeId: t.Optional(Uuid),
  resourceId: t.Optional(
    t.String({
      format: 'uuid',
      description:
        'Required for sponsor-logo and submission-screenshot purposes; rejected for implicitly bound purposes.',
    }),
  ),
  mimeType: t.String({ minLength: 1, maxLength: 100 }),
})

export const UploadAuthorizationResponse = t.Object({
  assetId: Uuid,
  uploadUrl: t.String(),
  cloudName: t.String(),
  apiKey: t.String(),
  timestamp: t.Integer(),
  signature: t.String(),
  folder: t.String(),
  publicId: t.String(),
  // Cloudinary's own delivery `type` ('upload' | 'authenticated') — this is
  // signed into `signature` server-side, so the client MUST echo it back
  // verbatim as a form field on the direct-to-Cloudinary upload POST, or
  // Cloudinary recomputes a different signature and rejects with 401.
  type: t.Union([t.Literal('upload'), t.Literal('authenticated')]),
  expiresAt: t.String(),
})

export const ConfirmUploadBody = t.Object({ assetId: Uuid })

export const MediaAssetResponse = t.Object({
  id: Uuid,
  purpose: MediaAssetPurpose,
  status: t.Union([
    t.Literal('PENDING'),
    t.Literal('CONFIRMED'),
    t.Literal('PENDING_DELETION'),
    t.Literal('DELETED'),
  ]),
  format: t.Union([t.String(), t.Null()]),
  bytes: t.Union([t.Integer(), t.Null()]),
  width: t.Union([t.Integer(), t.Null()]),
  height: t.Union([t.Integer(), t.Null()]),
  createdAt: t.String(),
})

export const DeliveryUrlResponse = t.Object({
  url: t.String(),
  expiresAt: t.Union([t.String(), t.Null()]),
})
