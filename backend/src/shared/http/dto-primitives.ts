import { type TSchema, t } from 'elysia'

/**
 * Shared DTO building blocks.
 *
 * DTOs define the validation contract and the safe response projection. They
 * never reach the database and never make an authorization decision — that
 * belongs to services (master prompt section 2.2).
 *
 * These primitives exist so that a rule like "an identifier is a UUID" or "a
 * reason is required and bounded" is expressed identically everywhere, and so
 * the generated OpenAPI document is consistent.
 */

export const Uuid = t.String({
  format: 'uuid',
  description: 'UUID identifier.',
  examples: ['0193f2a5-4c3a-7c1b-9e2d-6f8a1b2c3d4e'],
})

export const Slug = t.String({
  minLength: 2,
  maxLength: 64,
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  description: 'Lowercase, hyphen-separated identifier used in public URLs.',
  examples: ['acme-innovation-lab'],
})

export const EmailAddress = t.String({
  format: 'email',
  maxLength: 254,
  description: 'RFC 5321 email address.',
  examples: ['participant@example.org'],
})

export const HttpsUrl = t.String({
  format: 'uri',
  maxLength: 2048,
  description: 'Absolute https URL.',
  examples: ['https://example.org/project'],
})

export const Timestamp = t.String({
  format: 'date-time',
  description: 'RFC 3339 instant in UTC.',
  examples: ['2026-03-01T12:00:00.000Z'],
})

export const IdempotencyKey = t.String({
  minLength: 8,
  maxLength: 255,
  description: 'Client-generated key used to replay a non-repeatable operation safely.',
  examples: ['0193f2a5-4c3a-7c1b-9e2d-6f8a1b2c3d4e'],
})

export const TimeZone = t.String({
  minLength: 1,
  maxLength: 64,
  description: 'IANA time zone name used for display and scheduling context.',
  examples: ['Europe/Berlin'],
})

/** Free text that is stored as source data and never rendered as HTML here. */
export const MarkdownText = (maxLength: number) =>
  t.String({
    maxLength,
    description:
      'Markdown source. The backend stores and returns it verbatim and never renders it to ' +
      'HTML; consumers are responsible for sanitising it at render time.',
  })

/** A justification required for high-privilege or destructive actions. */
export const ActionReason = t.String({
  minLength: 10,
  maxLength: 1000,
  description: 'Why this action is being taken. Recorded in the audit trail.',
})

export const OptionalActionReason = t.Optional(ActionReason)

export const PaginationQuery = t.Object({
  limit: t.Optional(
    t.Integer({ minimum: 1, maximum: 100, description: 'Maximum items to return.' }),
  ),
  cursor: t.Optional(
    t.String({ maxLength: 512, description: 'Opaque cursor from a previous page.' }),
  ),
})

/** Wrap an item schema in the standard page envelope. */
export function PageOf<T extends TSchema>(item: T) {
  return t.Object({
    items: t.Array(item),
    nextCursor: t.Union([t.String(), t.Null()], {
      description: 'Cursor for the next page, or null when the feed is exhausted.',
    }),
    hasMore: t.Boolean(),
  })
}

/** The problem+json body every error response uses. */
export const ProblemSchema = t.Object(
  {
    type: t.String({ description: 'Stable documentation URI for this error code.' }),
    title: t.String(),
    status: t.Integer(),
    detail: t.String({ description: 'Human-readable explanation, safe to display.' }),
    code: t.String({ description: 'Stable application error code.' }),
    requestId: t.String({ description: 'Correlation identifier for support requests.' }),
    errors: t.Optional(
      t.Array(
        t.Object({
          field: t.String(),
          code: t.String(),
          message: t.String(),
        }),
      ),
    ),
    meta: t.Optional(t.Record(t.String(), t.Any())),
  },
  { description: 'RFC 9457 problem document.' },
)

/**
 * The error responses every authenticated tenant route can produce.
 *
 * Attached to route definitions so the generated OpenAPI document describes
 * failure modes, not just the happy path.
 */
export const CommonErrorResponses = {
  400: ProblemSchema,
  401: ProblemSchema,
  403: ProblemSchema,
  404: ProblemSchema,
  409: ProblemSchema,
  422: ProblemSchema,
  429: ProblemSchema,
  500: ProblemSchema,
} as const

export const PublicErrorResponses = {
  400: ProblemSchema,
  404: ProblemSchema,
  429: ProblemSchema,
  500: ProblemSchema,
} as const
