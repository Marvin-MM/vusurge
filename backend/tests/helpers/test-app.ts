import { createApp } from '../../src/app'
import { withRequestScope } from '../../src/shared/http'
import { createTestInfrastructure, type TestInfrastructure } from './test-infrastructure'

/**
 * An in-process HTTP client for end-to-end tests.
 *
 * Requests go through `withRequestScope` and `app.handle`, which is exactly the
 * pipeline the running server uses — the only difference is that no socket is
 * opened. Middleware, validation, authorization, error mapping, and request
 * correlation all behave as they do in production.
 */

export interface TestClientResponse<T = unknown> {
  readonly status: number
  readonly headers: Headers
  readonly body: T
  readonly raw: Response
}

export interface TestApp {
  readonly infrastructure: TestInfrastructure
  request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown
      headers?: Record<string, string>
      /** Cookie header value, for authenticated requests. */
      cookies?: string
      /** Set false only when a test intentionally exercises missing-CSRF behavior. */
      csrf?: boolean
    },
  ): Promise<TestClientResponse<T>>
  get<T = unknown>(path: string, headers?: Record<string, string>): Promise<TestClientResponse<T>>
  /** Raw in-process fetch for streaming responses that must not be buffered. */
  handle(request: Request): Promise<Response>
  dispose(): Promise<void>
}

export async function createTestApp(
  overrides: Partial<Record<string, string>> = {},
): Promise<TestApp> {
  const infrastructure = await createTestInfrastructure(overrides)
  const app = createApp({ infrastructure })
  const handle = withRequestScope((request) => app.handle(request))
  const origin = infrastructure.config.app.publicBaseUrl

  async function request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown
      headers?: Record<string, string>
      cookies?: string
      csrf?: boolean
    } = {},
  ): Promise<TestClientResponse<T>> {
    const headers = new Headers(options.headers)
    if (options.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    if (options.cookies !== undefined) {
      headers.set('cookie', options.cookies)
    }
    if (
      options.cookies !== undefined &&
      options.csrf !== false &&
      !headers.has('x-csrf-token') &&
      !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
    ) {
      const tokenResponse = await request<{ csrfToken: string }>('GET', '/api/v1/me/csrf-token', {
        cookies: options.cookies,
        csrf: false,
      })
      if (tokenResponse.status === 200) {
        headers.set('x-csrf-token', tokenResponse.body.csrfToken)
      }
    }
    // Unsafe cookie-authenticated requests need a trusted Origin, exactly as a
    // browser would send. Tests that assert CSRF rejection override this.
    if (!headers.has('origin') && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      headers.set('origin', origin)
    }

    const raw = await handle(
      new Request(`${origin}${path}`, {
        method,
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      }),
    )

    const text = await raw.text()
    let body: unknown = text
    if (text.length > 0 && (raw.headers.get('content-type') ?? '').includes('json')) {
      body = JSON.parse(text) as unknown
    }

    return { status: raw.status, headers: raw.headers, body: body as T, raw }
  }

  return {
    infrastructure,
    request,
    get: (path, headers) => request('GET', path, { headers: headers ?? {} }),
    handle: async (rawRequest) => handle(rawRequest),
    dispose: () => infrastructure.dispose(),
  }
}
