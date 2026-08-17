import { badRequest } from '../errors'

/**
 * Cursor (keyset) pagination.
 *
 * Large feeds — challenges, audit, notifications, submissions, tickets — use
 * keyset pagination rather than OFFSET. OFFSET re-scans and skips every earlier
 * row, so page 500 costs 500 pages of work, and a row inserted mid-traversal
 * shifts every subsequent page (master prompt section 33).
 *
 * The cursor is an opaque base64 encoding of the sort key. It is opaque so
 * clients cannot craft one to reach rows outside their scope: the tenant filter
 * is always applied server-side regardless of cursor contents.
 */

export interface CursorPayload {
  /** Primary sort value; almost always a timestamp. */
  readonly at: string
  /** Tie-breaker, so the ordering is total and therefore stable. */
  readonly id: string
}

export interface PageRequest {
  readonly limit: number
  readonly cursor?: CursorPayload
}

export interface Page<T> {
  // Not `readonly T[]`: Elysia's response-schema type inference expects a
  // plain mutable array at the handler boundary, and a readonly array is not
  // assignable to it even though nothing here ever mutates the value.
  readonly items: T[]
  readonly nextCursor: string | null
  readonly hasMore: boolean
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeCursor(raw: string): CursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as CursorPayload).at !== 'string' ||
      typeof (parsed as CursorPayload).id !== 'string'
    ) {
      throw new Error('malformed')
    }
    return parsed as CursorPayload
  } catch {
    throw badRequest('The supplied pagination cursor is not valid.')
  }
}

export interface PaginationLimits {
  readonly defaultPageSize: number
  readonly maxPageSize: number
}

/** Clamp a client-supplied page size and decode the cursor. */
export function toPageRequest(
  input: { limit?: number; cursor?: string },
  limits: PaginationLimits,
): PageRequest {
  const requested = input.limit ?? limits.defaultPageSize
  if (requested < 1) {
    throw badRequest('The page size must be at least 1.')
  }

  return {
    // Capped rather than rejected: a client asking for too much gets the
    // maximum, which keeps a tenant from requesting a whole table in one call.
    limit: Math.min(requested, limits.maxPageSize),
    ...(input.cursor !== undefined ? { cursor: decodeCursor(input.cursor) } : {}),
  }
}

/**
 * Build a page from rows fetched with `limit + 1`.
 *
 * Fetching one extra row is how `hasMore` is determined without a second
 * COUNT query over the whole filtered set.
 */
export function buildPage<T>(
  rows: readonly T[],
  request: PageRequest,
  toCursor: (row: T) => CursorPayload,
): Page<T> {
  const hasMore = rows.length > request.limit
  // Always a fresh slice, even when nothing was trimmed: the caller may hold
  // a readonly array, and Page.items must be a plain mutable array.
  const items = hasMore ? rows.slice(0, request.limit) : rows.slice()
  const last = items[items.length - 1]

  return {
    items,
    hasMore,
    nextCursor: hasMore && last !== undefined ? encodeCursor(toCursor(last)) : null,
  }
}

/**
 * Validate a client-supplied sort field against an allowlist.
 *
 * Client field names never reach SQL directly; they are mapped to a column the
 * server chose (master prompt section 33).
 */
export function resolveSortField<T extends string>(
  requested: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (requested === undefined) return fallback
  if ((allowed as readonly string[]).includes(requested)) return requested as T
  throw badRequest(`Sorting by "${requested}" is not supported. Allowed: ${allowed.join(', ')}.`)
}

export function resolveSortDirection(requested: string | undefined): 'asc' | 'desc' {
  if (requested === undefined) return 'desc'
  if (requested === 'asc' || requested === 'desc') return requested
  throw badRequest('The sort direction must be "asc" or "desc".')
}
