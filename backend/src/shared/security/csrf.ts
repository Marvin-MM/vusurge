import { createHmac, timingSafeEqual } from 'node:crypto'
import { ErrorCode, forbidden } from '../errors'

/**
 * CSRF protection for cookie-authenticated requests.
 *
 * Sessions are cookie-based, so an unsafe request arriving from another origin
 * would otherwise carry the victim's credentials automatically. Defence is
 * layered (master prompt section 7):
 *
 *   1. SameSite cookies, configured on the Better Auth session cookie.
 *   2. Strict Origin/Referer validation against the trusted origin list — the
 *      check implemented here.
 *   3. No state-changing GET routes, so a bare <img> or link cannot mutate.
 *
 * A same-site deployment (API and web client on one origin) is preferred; the
 * trusted origin list exists for deployments that cannot achieve that.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase())
}

/** Compare origins by scheme, host, and port; ignore path and trailing slash. */
function sameOrigin(a: string, b: string): boolean {
  try {
    const left = new URL(a)
    const right = new URL(b)
    return (
      left.protocol === right.protocol &&
      left.hostname === right.hostname &&
      left.port === right.port
    )
  } catch {
    return false
  }
}

export interface CsrfCheckInput {
  readonly method: string
  readonly originHeader: string | null
  readonly refererHeader: string | null
  /** True when the request actually carries a session cookie. */
  readonly hasSessionCookie: boolean
  readonly trustedOrigins: readonly string[]
  readonly publicBaseUrl: string
}

/**
 * Throw unless an unsafe, cookie-authenticated request came from a trusted
 * origin.
 *
 * Requests without a session cookie are left alone: they carry no ambient
 * authority, so there is nothing for a cross-site request to abuse. Webhook and
 * signature-authenticated routes are therefore unaffected.
 */
export function assertCsrfSafe(input: CsrfCheckInput): void {
  if (isSafeMethod(input.method)) return
  if (!input.hasSessionCookie) return

  const allowed = [input.publicBaseUrl, ...input.trustedOrigins]

  // Origin is sent by every browser on unsafe cross-origin requests and cannot
  // be forged by page script.
  if (input.originHeader !== null && input.originHeader !== 'null') {
    if (allowed.some((origin) => sameOrigin(origin, input.originHeader as string))) return
    throw forbidden(
      'This request was rejected because it did not originate from a trusted origin.',
      ErrorCode.CSRF_VALIDATION_FAILED,
    )
  }

  // Referer is the fallback for the rare client that omits Origin.
  if (input.refererHeader !== null) {
    if (allowed.some((origin) => sameOrigin(origin, input.refererHeader as string))) return
    throw forbidden(
      'This request was rejected because its referrer is not a trusted origin.',
      ErrorCode.CSRF_VALIDATION_FAILED,
    )
  }

  // A cookie-authenticated unsafe request with neither header is not something
  // a browser produces. Fail closed.
  throw forbidden(
    'This request was rejected because it did not identify its origin.',
    ErrorCode.CSRF_VALIDATION_FAILED,
  )
}

function csrfBinding(sessionId: string, mfaVerifiedAt: Date | null): string {
  return `csrf:v1:${sessionId}:${mfaVerifiedAt?.getTime() ?? 0}`
}

/** Create a stateless token bound to one durable session and MFA generation. */
export function createCsrfToken(
  secret: string,
  sessionId: string,
  mfaVerifiedAt: Date | null,
): string {
  return createHmac('sha256', secret)
    .update(csrfBinding(sessionId, mfaVerifiedAt), 'utf8')
    .digest('base64url')
}

export function assertCsrfToken(provided: string | null, expected: string): void {
  if (provided === null) {
    throw forbidden('A CSRF token is required for this request.', ErrorCode.CSRF_VALIDATION_FAILED)
  }
  const left = Buffer.from(provided, 'utf8')
  const right = Buffer.from(expected, 'utf8')
  if (left.length === right.length && timingSafeEqual(left, right)) return
  throw forbidden('The CSRF token is invalid for this session.', ErrorCode.CSRF_VALIDATION_FAILED)
}
