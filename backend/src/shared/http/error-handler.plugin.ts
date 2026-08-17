import { Elysia } from 'elysia'
import type { AppConfig } from '../config/config.schema'
import {
  AppError,
  buildProblem,
  ErrorCode,
  type FieldError,
  PROBLEM_CONTENT_TYPE,
  problemResponse,
  toProblem,
} from '../errors'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'

/**
 * The single place an error becomes an HTTP response.
 *
 * Guarantees, in order of importance:
 *   1. Nothing unexpected leaks. An error that is not an AppError becomes an
 *      opaque 500 carrying only a request ID; its message, stack, SQL fragment,
 *      or provider payload stays in the logs.
 *   2. Every failure is an RFC 9457 problem document with a stable code.
 *   3. Framework-level failures (validation, parse, 404, body limit) are mapped
 *      to the same contract rather than Elysia's defaults.
 */

interface ElysiaValidationDetail {
  readonly path?: string
  readonly message?: string
  readonly schema?: { readonly errorMessage?: string }
}

function toFieldErrors(error: unknown): FieldError[] {
  const candidate = error as { all?: readonly ElysiaValidationDetail[] }
  if (!Array.isArray(candidate.all)) return []

  return candidate.all
    .filter((detail) => typeof detail.path === 'string')
    .slice(0, 50)
    .map((detail) => ({
      // Elysia reports JSON-pointer style paths; trim the leading slash.
      field: (detail.path ?? '').replace(/^\//, '') || '(root)',
      code: 'invalid',
      message: detail.schema?.errorMessage ?? detail.message ?? 'Invalid value.',
    }))
}

export function errorHandlerPlugin(config: AppConfig, logger: Logger) {
  const metrics = appMetrics()
  const isProduction = config.app.environment === 'production'

  return new Elysia({ name: 'error-handler' })
    .onError({ as: 'global' }, ({ code, error, request, route, set }) => {
      const requestId =
        (typeof set.headers['x-request-id'] === 'string' ? set.headers['x-request-id'] : null) ??
        request.headers.get('x-request-id') ??
        'unknown'

      // --- Framework-level failures, mapped onto the application contract ---
      if (code === 'VALIDATION') {
        const fieldErrors = toFieldErrors(error)
        const appError = new AppError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'The request payload failed validation.',
          status: 422,
          fieldErrors,
        })
        set.headers['content-type'] = PROBLEM_CONTENT_TYPE
        set.status = 422
        return buildProblem(appError, requestId)
      }

      if (code === 'NOT_FOUND') {
        const appError = new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'The requested resource was not found.',
          status: 404,
        })
        set.headers['content-type'] = PROBLEM_CONTENT_TYPE
        set.status = 404
        return buildProblem(appError, requestId)
      }

      if (code === 'PARSE') {
        const appError = new AppError({
          code: ErrorCode.MALFORMED_REQUEST,
          message: 'The request body could not be parsed.',
          status: 400,
        })
        set.headers['content-type'] = PROBLEM_CONTENT_TYPE
        set.status = 400
        return buildProblem(appError, requestId)
      }

      // --- Application errors ------------------------------------------------
      const { problem, appError, unexpected } = toProblem(error, requestId)

      if (unexpected) {
        // Full detail to logs, nothing to the client.
        logger.error(
          {
            requestId,
            route: route ?? request.url,
            method: request.method,
            err: describeError(error),
          },
          'Unhandled error while processing a request',
        )
      } else if (appError.status >= 500) {
        logger.error(
          { requestId, code: appError.code, err: describeError(error) },
          appError.message,
        )
      } else if (appError.status === 401 || appError.status === 403) {
        metrics.authFailures.add(1, { code: appError.code, route: route ?? 'unmatched' })
        logger.warn(
          { requestId, code: appError.code, route: route ?? request.url },
          'Request denied',
        )
      } else {
        logger.debug({ requestId, code: appError.code }, 'Request rejected')
      }

      if (appError.retryAfterSeconds !== undefined) {
        set.headers['retry-after'] = String(Math.ceil(appError.retryAfterSeconds))
      }
      set.headers['content-type'] = PROBLEM_CONTENT_TYPE
      set.status = problem.status

      // Never expose internals, even when a non-production deployment is more
      // permissive elsewhere.
      void isProduction
      return problem
    })
    .as('global')
}

/** Build a problem response outside the Elysia error pipeline (e.g. webhooks). */
export function standaloneProblemResponse(error: unknown, requestId: string): Response {
  const { problem, appError } = toProblem(error, requestId)
  return problemResponse(problem, appError.retryAfterSeconds)
}
