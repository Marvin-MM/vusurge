import { newRequestId } from '../ids'
import { runWithRequestContext } from '../logging'
import { withSpan } from '../observability'

/**
 * The request scope wrapper.
 *
 * Establishes the AsyncLocalStorage context around an ENTIRE request, so every
 * log line, audit row, and outbox event produced while serving it carries the
 * same correlation ID.
 *
 * This has to wrap the whole handler rather than run as an Elysia hook: a hook
 * returns long before the handler resolves, so a context established inside one
 * would be gone by the time the work happens.
 *
 * Both the HTTP server and the test harness call requests through this wrapper,
 * so tests exercise exactly the same correlation behaviour as production.
 */

const MAX_INBOUND_REQUEST_ID = 64
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * Accept a caller-supplied correlation ID, or mint one.
 *
 * The inbound value is bounded and character-restricted because it is written
 * to logs and echoed in a response header; an unchecked value would be a
 * log-injection and header-splitting vector.
 */
export function resolveRequestId(header: string | null): string {
  if (header === null) return newRequestId()
  const trimmed = header.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_INBOUND_REQUEST_ID) return newRequestId()
  if (!REQUEST_ID_PATTERN.test(trimmed)) return newRequestId()
  return trimmed
}

export type FetchHandler = (request: Request) => Promise<Response> | Response

/** Wrap a fetch handler so every request runs inside its own logging context. */
export function withRequestScope(handler: FetchHandler): FetchHandler {
  return (request: Request) => {
    const requestId = resolveRequestId(request.headers.get('x-request-id'))
    return withSpan(
      `HTTP ${request.method}`,
      { 'http.request.method': request.method },
      () => runWithRequestContext({ requestId, method: request.method }, () => handler(request)),
      request.headers.get('traceparent'),
    )
  }
}
