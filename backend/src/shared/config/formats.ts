import { FormatRegistry } from '@sinclair/typebox'

/**
 * String formats used by configuration validation and DTO schemas.
 *
 * TypeBox ships no format validators: `format: 'uri'` is inert unless a checker
 * is registered. Elysia registers its own set when it is imported, which made
 * configuration validation quietly depend on module import order — a config
 * error would be caught in the API process (which imports Elysia) but not in a
 * worker or a test that does not. Registering them here removes that
 * dependency, and importing this module is idempotent.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/

function register(name: string, check: (value: string) => boolean): void {
  if (!FormatRegistry.Has(name)) {
    FormatRegistry.Set(name, check)
  }
}

register('uri', (value) => {
  try {
    // Absolute URLs only: a relative reference in a base URL or trusted origin
    // would silently produce the wrong links and CORS decisions.
    const parsed = new URL(value)
    return parsed.protocol !== ''
  } catch {
    return false
  }
})

register('email', (value) => value.length <= 254 && EMAIL_PATTERN.test(value))
register('uuid', (value) => UUID_PATTERN.test(value))
register('date-time', (value) => DATE_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value)))

/** Imported for its side effect; exported so the import cannot be tree-shaken. */
export const REGISTERED_FORMATS = ['uri', 'email', 'uuid', 'date-time'] as const
