import { ErrorCode } from './error-codes'

/** A validation problem attached to a specific request field. */
export interface FieldError {
  readonly field: string
  readonly code: string
  readonly message: string
}

export interface AppErrorOptions {
  /** Machine-readable, stable across releases. */
  readonly code: ErrorCode
  /** Safe for display. Never contains SQL, secrets, or provider payloads. */
  readonly message: string
  readonly status: number
  readonly fieldErrors?: readonly FieldError[]
  /** Structured, already-safe extras merged into the problem document. */
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>
  /** Retained server-side for logs only. Never serialized to the client. */
  readonly cause?: unknown
  /** Seconds until the client may retry; emitted as Retry-After. */
  readonly retryAfterSeconds?: number
}

/**
 * The single error type services and controllers throw.
 *
 * Anything that is not an AppError is treated as an unexpected internal fault:
 * it is logged with full detail and reported to the client as a bare 500 with
 * only a request ID, so implementation details can never leak.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly fieldErrors?: readonly FieldError[]
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>
  readonly retryAfterSeconds?: number

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AppError'
    this.code = options.code
    this.status = options.status
    this.fieldErrors = options.fieldErrors
    this.meta = options.meta
    this.retryAfterSeconds = options.retryAfterSeconds
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError
  }
}

type Extra = Pick<AppErrorOptions, 'meta' | 'cause' | 'fieldErrors'>

/**
 * Constructors for the common shapes. Using these keeps status-code choices
 * consistent with the contract in section 35 of the master prompt.
 */

/** 400 — the request itself is malformed. */
export function badRequest(message: string, extra: Extra = {}): AppError {
  return new AppError({ code: ErrorCode.MALFORMED_REQUEST, message, status: 400, ...extra })
}

/** 422 — well-formed but semantically invalid payload. */
export function validationFailed(
  message: string,
  fieldErrors: readonly FieldError[],
  extra: Omit<Extra, 'fieldErrors'> = {},
): AppError {
  return new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message,
    status: 422,
    fieldErrors,
    ...extra,
  })
}

/** 401 — no usable credentials. */
export function unauthenticated(
  message = 'Authentication is required.',
  code: ErrorCode = ErrorCode.UNAUTHENTICATED,
  extra: Extra = {},
): AppError {
  return new AppError({ code, message, status: 401, ...extra })
}

/** 403 — authenticated, but the action is not permitted. */
export function forbidden(
  message = 'You do not have permission to perform this action.',
  code: ErrorCode = ErrorCode.FORBIDDEN,
  extra: Extra = {},
): AppError {
  return new AppError({ code, message, status: 403, ...extra })
}

/**
 * 404 — the resource does not exist *within the caller's allowed scope*.
 *
 * Deliberately identical whether the resource is absent or belongs to another
 * tenant, so responses cannot be used to probe cross-tenant existence.
 */
export function notFound(
  message = 'The requested resource was not found.',
  code: ErrorCode = ErrorCode.NOT_FOUND,
  extra: Extra = {},
): AppError {
  return new AppError({ code, message, status: 404, ...extra })
}

/** 409 — the request conflicts with current state or an invariant. */
export function conflict(code: ErrorCode, message: string, extra: Extra = {}): AppError {
  return new AppError({ code, message, status: 409, ...extra })
}

/** 422 — domain rule violated by an otherwise well-formed request. */
export function unprocessable(code: ErrorCode, message: string, extra: Extra = {}): AppError {
  return new AppError({ code, message, status: 422, ...extra })
}

/** 429 — rate limited. */
export function rateLimited(
  message: string,
  retryAfterSeconds: number,
  extra: Extra = {},
): AppError {
  return new AppError({
    code: ErrorCode.RATE_LIMITED,
    message,
    status: 429,
    retryAfterSeconds,
    ...extra,
  })
}

/** 503 — a required dependency is unavailable. */
export function dependencyUnavailable(message: string, extra: Extra = {}): AppError {
  return new AppError({
    code: ErrorCode.DEPENDENCY_UNAVAILABLE,
    message,
    status: 503,
    ...extra,
  })
}

/** 503 — the capability exists but is switched off in this deployment. */
export function featureDisabled(feature: string): AppError {
  return new AppError({
    code: ErrorCode.FEATURE_DISABLED,
    message: `The ${feature} capability is not enabled in this deployment.`,
    status: 503,
  })
}

/** 500 — an unexpected internal fault. Detail is retained for logs only. */
export function internalError(
  message = 'An unexpected error occurred.',
  cause?: unknown,
): AppError {
  return new AppError({ code: ErrorCode.INTERNAL_ERROR, message, status: 500, cause })
}
