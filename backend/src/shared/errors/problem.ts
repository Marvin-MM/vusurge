import { AppError, type FieldError } from './app-error'
import { ErrorCode } from './error-codes'

/**
 * RFC 9457 "Problem Details for HTTP APIs" response body.
 *
 * `type` is a stable documentation URI derived from the application error code,
 * so clients can branch on either `type` or the `code` extension member.
 */
export interface ProblemDocument {
  readonly type: string
  readonly title: string
  readonly status: number
  readonly detail: string
  readonly code: string
  readonly requestId: string
  readonly errors?: readonly FieldError[]
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

const PROBLEM_TYPE_BASE = 'https://docs.innovation-platform.example/errors'

const TITLES: Partial<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

function titleFor(status: number): string {
  return TITLES[status] ?? (status >= 500 ? 'Server Error' : 'Request Error')
}

/**
 * Build the wire representation of an AppError.
 *
 * Nothing that is not already known-safe reaches this function: the `cause` is
 * dropped here, and unexpected errors are converted to a generic 500 by
 * `toProblem` before serialization.
 */
export function buildProblem(error: AppError, requestId: string): ProblemDocument {
  return {
    type: `${PROBLEM_TYPE_BASE}/${error.code}`,
    title: titleFor(error.status),
    status: error.status,
    detail: error.message,
    code: error.code,
    requestId,
    ...(error.fieldErrors && error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
    ...(error.meta ? { meta: error.meta } : {}),
  }
}

/**
 * Convert an arbitrary thrown value into a problem document.
 *
 * Only AppError instances keep their detail. Everything else becomes an opaque
 * 500 carrying nothing but the request ID, because an unexpected error's
 * message may contain SQL fragments, provider payloads, or file paths.
 */
export function toProblem(
  error: unknown,
  requestId: string,
): { problem: ProblemDocument; appError: AppError; unexpected: boolean } {
  if (AppError.isAppError(error)) {
    return { problem: buildProblem(error, requestId), appError: error, unexpected: false }
  }

  const opaque = new AppError({
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred. Quote the request ID when reporting this.',
    status: 500,
    cause: error,
  })
  return { problem: buildProblem(opaque, requestId), appError: opaque, unexpected: true }
}

/** Serialize a problem document as an HTTP response. */
export function problemResponse(problem: ProblemDocument, retryAfterSeconds?: number): Response {
  const headers: Record<string, string> = {
    'content-type': PROBLEM_CONTENT_TYPE,
    'x-request-id': problem.requestId,
    // Error bodies are never cacheable: they are request-specific.
    'cache-control': 'no-store',
  }
  if (retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(Math.max(0, Math.ceil(retryAfterSeconds)))
  }
  return new Response(JSON.stringify(problem), { status: problem.status, headers })
}
