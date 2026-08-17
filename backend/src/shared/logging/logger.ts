import { type Logger as PinoLogger, pino } from 'pino'
import type { AppConfig } from '../config/config.schema'
import { getRequestContext } from './request-context'

/**
 * Structured JSON logging.
 *
 * Application logs and the audit trail are separate systems: audit records are
 * durable business evidence written inside transactions (see shared/audit),
 * while these logs are operational telemetry that may be sampled or expire.
 * Never treat a log line as proof that a business event happened.
 */

export type Logger = PinoLogger

/**
 * Keys whose values are replaced with [redacted] wherever they appear in a log
 * object. Covers credentials, tokens, cookies, and personal contact data that
 * must never reach a log aggregator.
 */
const REDACTED_PATHS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'sessionToken',
  'apiKey',
  'secret',
  'clientSecret',
  'webhookSecret',
  'signature',
  'authorization',
  'cookie',
  'setCookie',
  'plaintextCode',
  'joinCode',
  'encryptedCredential',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.accessToken',
  '*.sessionToken',
  '*.authorization',
  '*.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
]

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.observability.logLevel,
    // Bun runs pino's synchronous stdout path; worker-thread transports are not
    // used, so log delivery cannot be lost to an unflushed worker on exit.
    ...(config.observability.logPretty
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
    base: {
      service: config.app.serviceName,
      version: config.app.version,
      environment: config.app.environment,
      processRole: config.app.processRole,
    },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Attach ambient correlation identifiers to every line automatically.
    mixin() {
      const context = getRequestContext()
      if (context === undefined) return {}
      return {
        requestId: context.requestId,
        ...(context.route ? { route: context.route } : {}),
        ...(context.method ? { method: context.method } : {}),
        ...(context.userId ? { userId: context.userId } : {}),
        ...(context.organizationId ? { organizationId: context.organizationId } : {}),
        ...(context.jobId ? { jobId: context.jobId } : {}),
        ...(context.queueName ? { queueName: context.queueName } : {}),
      }
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  })
}

/**
 * Reduce an arbitrary thrown value to something safe and useful for logs.
 *
 * Stack traces stay in logs (they never reach clients). Nested causes are
 * flattened so a wrapped provider failure is still diagnosable.
 */
export function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.cause !== undefined ? { cause: describeError(error.cause) } : {}),
    }
  }
  return { name: 'NonError', message: String(error) }
}
