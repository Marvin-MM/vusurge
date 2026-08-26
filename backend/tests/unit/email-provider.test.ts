import { describe, expect, test } from 'bun:test'
import { EmailCategory, ResendEmailProvider } from '../../src/shared/email'
import { createLogger } from '../../src/shared/logging'
import { loadTestConfig } from '../helpers/test-config'

describe('Resend provider transport', () => {
  test('passes the timeout AbortSignal to the actual HTTP request', async () => {
    const config = loadTestConfig({
      EMAIL_ENABLED: 'true',
      RESEND_API_KEY: 're_test_only',
      EMAIL_REQUEST_TIMEOUT_MS: '100',
      EMAIL_MAX_ATTEMPTS: '1',
    })
    let observedSignal: AbortSignal | undefined
    const request = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      observedSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('request timed out', 'AbortError')),
          { once: true },
        )
      })
    }
    const provider = new ResendEmailProvider(config, createLogger(config), request)

    const startedAt = Date.now()
    await expect(
      provider.send({
        to: 'timeout@example.org',
        category: EmailCategory.Verification,
        subject: 'Timeout test',
        text: 'This request must be aborted.',
        idempotencyKey: 'resend-timeout-test',
        disableTracking: true,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(observedSignal).toBeDefined()
    expect(observedSignal?.aborted).toBe(true)
    // Wall-clock guard: not a precision assertion. The AbortController fires at
    // ~100ms (EMAIL_REQUEST_TIMEOUT_MS); this bound just proves the test didn't
    // hang. Raised from 1_000 to 3_000 so loaded CI runners don't flake on the
    // async abort-event → promise-rejection roundtrip overhead.
    expect(Date.now() - startedAt).toBeLessThan(3_000)
  })
})
