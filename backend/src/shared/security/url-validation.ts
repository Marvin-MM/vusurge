import { isIP } from 'node:net'
import { ErrorCode, unprocessable } from '../errors'

/**
 * Validation for participant- and organizer-supplied URLs.
 *
 * Two distinct concerns:
 *
 *   Storage  — repository links, demo links, video links, portfolio links. These
 *              are stored and later rendered by a client. HTTPS only, bounded
 *              length, no credentials embedded, no javascript:/data: schemes.
 *
 *   Fetching — if the server ever dereferences a user-supplied URL, it becomes
 *              an SSRF vector into the deployment's private network. The guard
 *              below rejects private, loopback, link-local, and metadata
 *              addresses (master prompt sections 15.2, 37).
 *
 * The platform does not currently fetch link metadata. `assertSafeToFetch` is
 * here so that if a future feature does, it starts from a safe default rather
 * than reinventing this check.
 */

const MAX_URL_LENGTH = 2048

/** Schemes that may be stored. Anything else is a rendering or injection risk. */
const ALLOWED_SCHEMES = new Set(['https:'])

/**
 * Embed providers permitted for pitch videos and demos.
 *
 * An allowlist rather than a blocklist: downstream clients embed these in an
 * iframe, and an arbitrary host would let a participant frame anything.
 */
export const ALLOWED_EMBED_HOSTS: readonly string[] = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
  'loom.com',
  'www.loom.com',
]

export interface UrlValidationOptions {
  /** Field name reported in the validation error. */
  readonly field: string
  /** Permit http:// as well. Off by default and only for local development. */
  readonly allowInsecure?: boolean
  /** Restrict to the embed allowlist. */
  readonly requireEmbedHost?: boolean
}

/**
 * Parse and validate a stored URL, returning its normalized form.
 *
 * Throws a domain error rather than returning null so call sites cannot forget
 * to check the result.
 */
export function validateExternalUrl(raw: string, options: UrlValidationOptions): string {
  const trimmed = raw.trim()

  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw unprocessable(
      ErrorCode.INVALID_EXTERNAL_URL,
      `${options.field} must be between 1 and ${MAX_URL_LENGTH} characters.`,
    )
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw unprocessable(ErrorCode.INVALID_EXTERNAL_URL, `${options.field} is not a valid URL.`)
  }

  const allowedSchemes = options.allowInsecure
    ? new Set([...ALLOWED_SCHEMES, 'http:'])
    : ALLOWED_SCHEMES

  if (!allowedSchemes.has(parsed.protocol)) {
    throw unprocessable(
      ErrorCode.INVALID_EXTERNAL_URL,
      `${options.field} must use https. Received "${parsed.protocol.replace(':', '')}".`,
    )
  }

  // Credentials in a URL end up in logs, referrers, and audit records.
  if (parsed.username !== '' || parsed.password !== '') {
    throw unprocessable(
      ErrorCode.INVALID_EXTERNAL_URL,
      `${options.field} must not embed credentials.`,
    )
  }

  if (parsed.hostname === '') {
    throw unprocessable(ErrorCode.INVALID_EXTERNAL_URL, `${options.field} must include a host.`)
  }

  if (options.requireEmbedHost === true) {
    const host = parsed.hostname.toLowerCase()
    if (!ALLOWED_EMBED_HOSTS.includes(host)) {
      throw unprocessable(
        ErrorCode.INVALID_EXTERNAL_URL,
        `${options.field} must point at a supported provider: ${ALLOWED_EMBED_HOSTS.join(', ')}.`,
      )
    }
  }

  return parsed.toString()
}

/**
 * Reject addresses that must never be reachable from a server-side fetch.
 *
 * Covers loopback, RFC 1918 private ranges, link-local (including the cloud
 * metadata endpoint at 169.254.169.254), carrier-grade NAT, and the IPv6
 * equivalents.
 */
export function isBlockedAddress(address: string): boolean {
  const version = isIP(address)

  if (version === 4) {
    const octets = address.split('.').map(Number)
    const [a = 0, b = 0] = octets
    if (a === 0) return true // "this network"
    if (a === 10) return true // private
    if (a === 127) return true // loopback
    if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 192 && b === 168) return true // private
    if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
    if (a >= 224) return true // multicast and reserved
    return false
  }

  if (version === 6) {
    const normalized = address.toLowerCase()
    if (normalized === '::' || normalized === '::1') return true
    if (normalized.startsWith('fe80')) return true // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique local
    if (normalized.startsWith('::ffff:')) {
      // IPv4-mapped: evaluate the embedded address rather than trusting it.
      return isBlockedAddress(normalized.slice('::ffff:'.length))
    }
    return false
  }

  return false
}

/**
 * Guard for any future server-side dereference of a user-supplied URL.
 *
 * Resolves the hostname and rejects the request if any resolved address is
 * private. Callers must additionally pin the resolved address for the actual
 * connection, cap redirects, cap the response size, and set a short timeout;
 * DNS can return a different answer on the second lookup (DNS rebinding).
 */
export async function assertSafeToFetch(rawUrl: string, field: string): Promise<URL> {
  const normalized = validateExternalUrl(rawUrl, { field })
  const parsed = new URL(normalized)

  const literal = isIP(parsed.hostname)
  if (literal !== 0) {
    if (isBlockedAddress(parsed.hostname)) {
      throw unprocessable(
        ErrorCode.INVALID_EXTERNAL_URL,
        `${field} must not point at a private or reserved address.`,
      )
    }
    return parsed
  }

  const { lookup } = await import('node:dns/promises')
  const resolved = await lookup(parsed.hostname, { all: true })

  if (resolved.length === 0) {
    throw unprocessable(ErrorCode.INVALID_EXTERNAL_URL, `${field} could not be resolved.`)
  }

  for (const entry of resolved) {
    if (isBlockedAddress(entry.address)) {
      throw unprocessable(
        ErrorCode.INVALID_EXTERNAL_URL,
        `${field} resolves to a private or reserved address.`,
      )
    }
  }

  return parsed
}
