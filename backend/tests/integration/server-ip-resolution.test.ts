import { afterAll, describe, expect, test } from 'bun:test'
import type { Server } from 'bun'
import { createApp } from '../../src/app'
import { withRequestScope } from '../../src/shared/http'
import { createVerifiedUser, type TestUser } from '../helpers/auth-flow'
import type { TestApp, TestClientResponse } from '../helpers/test-app'
import { createTestInfrastructure, type TestInfrastructure } from '../helpers/test-infrastructure'

/**
 * Regression coverage for the production bootstrap in `src/index.ts`.
 *
 * `src/index.ts` deliberately does not call Elysia's `app.listen()` — it
 * opens the socket itself with `Bun.serve` so every request can be routed
 * through `withRequestScope` first (see the comment there). Elysia's Bun
 * adapter resolves `context.server` as `context.server ?? app.server`, and
 * only `.listen()` ever assigns `app.server` on its own. Skipping `.listen()`
 * without separately assigning `app.server` leaves it `null` forever, so
 * `server.requestIP(request)` is unreachable in every derive/handler and the
 * caller's IP resolves to `undefined` for the lifetime of the process.
 *
 * That silently breaks every `scope: 'ip'` rate-limit policy with
 * `riskLevel: 'high'` (see `src/shared/rate-limit/policies.ts`): those fail
 * closed on a missing identity by design (a stripped IP behind a proxy is
 * itself suspicious), so instead of rate-limiting real traffic they reject
 * 100% of it, forever. `organization.invitation_accept` is the one this test
 * exercises directly — with the bug present, no invitation can ever be
 * accepted once `RATE_LIMIT_ENABLED=true`, which is how the local dev server
 * and production both run (only `bun test` disables rate limiting).
 *
 * This can only be observed over a real socket — the rest of the e2e suite
 * calls `app.handle(request)` in-process (see `tests/helpers/test-app.ts`),
 * which never touches `Bun.serve`/`server.requestIP` at all.
 */

interface RealServerHarness extends TestApp {
  readonly origin: string
  readonly server: Server<unknown>
}

/** Boots a real Bun.serve socket the same way `src/index.ts` does. */
async function bootRealServer(wireServer: boolean): Promise<RealServerHarness> {
  // An ephemeral port in the high dynamic range — config validation rejects
  // `0` (Bun's own "pick any free port" sentinel), so a random candidate is
  // chosen instead. Collisions are astronomically unlikely for two servers
  // in one test run.
  const port = 20_000 + Math.floor(Math.random() * 20_000)
  const origin = `http://127.0.0.1:${port}`
  const infrastructure: TestInfrastructure = await createTestInfrastructure({
    RATE_LIMIT_ENABLED: 'true',
    HOST: '127.0.0.1',
    PORT: String(port),
    // Better Auth and the CSRF origin check both validate the request's host
    // against the configured base URL / trusted origins — keep them in step
    // with the actual socket this test binds, rather than the package
    // defaults (localhost:3000 / localhost:3001).
    PUBLIC_BASE_URL: origin,
    TRUSTED_ORIGINS: origin,
  })
  const app = createApp({ infrastructure })
  const handle = withRequestScope((request) => app.handle(request))

  const server = Bun.serve({
    hostname: infrastructure.config.app.host,
    port: infrastructure.config.app.port,
    fetch: handle,
  })

  // The exact line under test: production assigns this in src/index.ts.
  if (wireServer) {
    app.server = server
  }

  async function request<T = unknown>(
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
    if (!headers.has('origin') && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      headers.set('origin', origin)
    }

    // Real network round-trip — NOT `app.handle(request)` in-process. Only a
    // request that actually traverses the socket exercises `server.requestIP`.
    // `redirect: 'manual'` matches the in-process harness: `app.handle`
    // returns Better Auth's raw redirect Response (e.g. after email
    // verification) without following it, since there is no frontend
    // listening in this backend-only test process to redirect into.
    const raw = await fetch(`${origin}${path}`, {
      method,
      headers,
      redirect: 'manual',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })

    const text = await raw.text()
    let body: unknown = text
    if (text.length > 0 && (raw.headers.get('content-type') ?? '').includes('json')) {
      body = JSON.parse(text) as unknown
    }

    return { status: raw.status, headers: raw.headers, body: body as T, raw }
  }

  return {
    infrastructure,
    origin,
    server,
    request,
    get: (path, headers) => request('GET', path, { headers: headers ?? {} }),
    handle: async (rawRequest) => handle(rawRequest),
    dispose: async () => {
      await server.stop(true)
      await infrastructure.dispose()
    },
  }
}

async function authenticatedUser(app: RealServerHarness): Promise<TestUser> {
  return createVerifiedUser(app, { email: `ip-wiring-${crypto.randomUUID()}@example.org` })
}

describe('client IP resolution over a real Bun.serve socket', () => {
  const harnesses: RealServerHarness[] = []

  afterAll(async () => {
    await Promise.all(harnesses.map((harness) => harness.dispose()))
  })

  test('regression: without app.server assignment, every invitation-accept call fails closed (429) instead of reaching business logic', async () => {
    const app = await bootRealServer(false)
    harnesses.push(app)
    const user = await authenticatedUser(app)

    const response = await app.request(
      'POST',
      '/api/v1/invitations/not-a-real-token-00000000000000000/accept',
      { cookies: user.cookie },
    )

    // The bug: identity resolution finds no IP, so the high-risk
    // `organization.invitation_accept` policy denies unconditionally, before
    // the token is ever looked up.
    expect(response.status).toBe(429)
    expect((response.body as { code?: string }).code).toBe('RATE_LIMITED')
  })

  test('fix: with app.server assigned (as src/index.ts now does), the request reaches business logic and a bad token is reported as invalid, not rate-limited', async () => {
    const app = await bootRealServer(true)
    harnesses.push(app)
    const user = await authenticatedUser(app)

    const response = await app.request(
      'POST',
      '/api/v1/invitations/not-a-real-token-00000000000000000/accept',
      { cookies: user.cookie },
    )

    // The caller's IP now resolves, so the rate limiter's real Redis-backed
    // counter is used (well under its limit on a fresh key) and the request
    // reaches the invitation lookup, which correctly reports 404.
    expect(response.status).toBe(404)
    expect((response.body as { code?: string }).code).not.toBe('RATE_LIMITED')
  })
})
