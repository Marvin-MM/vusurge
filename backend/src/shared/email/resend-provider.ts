import { CircuitBreaker } from '../cache'
import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'
import {
  type EmailMessage,
  type EmailProvider,
  EmailProviderError,
  type EmailSendResult,
} from './email-provider'

export type EmailHttpTransport = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

/**
 * Resend-backed transactional email.
 *
 * Bounded retries apply only to genuinely transient failures (network errors,
 * 5xx, 429). A 4xx validation failure from the provider — a malformed address,
 * a rejected sender — is not retried, because retrying it just repeats the
 * same failure (master prompt section 39).
 *
 * `idempotencyKey` is forwarded as Resend's own idempotency key, so a retried
 * send at the HTTP layer cannot become a duplicate delivery at the provider.
 */
export class ResendEmailProvider implements EmailProvider {
  private readonly breaker: CircuitBreaker

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly request: EmailHttpTransport = globalThis.fetch,
  ) {
    if (config.email.resendApiKey === undefined) {
      throw new Error('ResendEmailProvider requires RESEND_API_KEY to be configured.')
    }
    this.breaker = new CircuitBreaker({
      name: 'resend',
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      onStateChange: (state) => {
        this.logger.warn({ circuit: 'resend', state }, 'Resend circuit breaker state changed')
      },
    })
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const metrics = appMetrics()

    if (!this.breaker.canAttempt()) {
      metrics.emailSends.add(1, { category: message.category, outcome: 'circuit_open' })
      throw new EmailProviderError(
        'Resend circuit is open; email send skipped for this attempt.',
        true,
      )
    }

    const maxAttempts = this.config.email.maxAttempts

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), this.config.email.requestTimeoutMs)

        try {
          const response = await this.request('https://api.resend.com/emails', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${this.config.email.resendApiKey}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': message.idempotencyKey,
            },
            body: JSON.stringify({
              from: `${this.config.email.fromName} <${this.config.email.fromAddress}>`,
              to: message.to,
              subject: message.subject,
              text: message.text,
              ...(this.config.email.replyToAddress
                ? { reply_to: this.config.email.replyToAddress }
                : {}),
              // Stable non-secret correlation. Tracking itself is disabled
              // on the dedicated authentication sending domain.
              headers:
                message.disableTracking === true
                  ? { 'X-Entity-Ref-ID': message.idempotencyKey }
                  : undefined,
            }),
          })

          const payload = (await response.json().catch(() => ({}))) as {
            id?: unknown
            name?: unknown
            message?: unknown
          }

          if (!response.ok) {
            throw new ResendApiError(
              typeof payload.message === 'string'
                ? payload.message
                : `Resend returned HTTP ${response.status}.`,
              typeof payload.name === 'string' ? payload.name : 'application_error',
              response.status,
            )
          }

          this.breaker.recordSuccess()
          metrics.emailSends.add(1, { category: message.category, outcome: 'sent' })

          return {
            providerMessageId: typeof payload.id === 'string' ? payload.id : message.idempotencyKey,
            suppressed: false,
          }
        } finally {
          clearTimeout(timeout)
        }
      } catch (error) {
        const retryable = isRetryableProviderError(error)

        if (!retryable || attempt === maxAttempts) {
          this.breaker.recordFailure()
          metrics.emailSends.add(1, { category: message.category, outcome: 'failed' })
          this.logger.error(
            { err: describeError(error), category: message.category, attempt },
            'Failed to send transactional email',
          )
          throw error
        }

        const backoffMs = Math.min(500 * 2 ** (attempt - 1), 8_000)
        const jitterMs = Math.floor(Math.random() * 250)
        await Bun.sleep(backoffMs + jitterMs)
      }
    }

    throw new Error('unreachable')
  }
}

class ResendApiError extends EmailProviderError {
  constructor(
    message: string,
    readonly providerErrorName: string,
    readonly statusCode: number,
  ) {
    super(
      message,
      !new Set([
        'validation_error',
        'missing_api_key',
        'invalid_api_key',
        'restricted_api_key',
        'invalid_from_address',
        'validation_error_invalid_parameter',
      ]).has(providerErrorName) &&
        (statusCode === 429 || statusCode >= 500),
    )
    this.name = 'ResendApiError'
  }
}

function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof ResendApiError) {
    return error.retryable
  }
  if (error instanceof DOMException && error.name === 'AbortError') return true
  return true
}
