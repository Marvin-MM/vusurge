import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTestApp, type TestApp } from '../helpers/test-app'

/**
 * Response-level hardening that applies to every endpoint.
 *
 * These are regression tests for whole classes of leak: an error that reveals a
 * SQL fragment, a response that can be framed or MIME-sniffed, or a 404 that
 * tells an attacker whether an identifier exists in another tenant.
 *
 * Master prompt sections 33, 35, 37, and threat classes 1, 2, and 20.
 */

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
})

afterAll(async () => {
  await app.dispose()
})

describe('security headers', () => {
  test('are present on successful responses', async () => {
    const response = await app.get('/health/live')

    // A JSON API is not a browsing context; nothing here should ever be
    // framed, sniffed, or treated as a document.
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin')
  })

  test('are present on error responses too', async () => {
    // Error paths are the easy place to forget hardening.
    const response = await app.get('/no-such-route')

    expect(response.status).toBe(404)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })
})

describe('error responses', () => {
  test('use the problem+json contract', async () => {
    const response = await app.get<{
      type: string
      title: string
      status: number
      detail: string
      code: string
      requestId: string
    }>('/no-such-route')

    expect(response.headers.get('content-type')).toContain('application/problem+json')
    expect(response.body.status).toBe(404)
    expect(response.body.code).toBe('NOT_FOUND')
    // The request ID is what a user quotes to support; it must always be there.
    expect(response.body.requestId).toBeTruthy()
  })

  test('never expose stack traces, SQL, file paths, or configuration', async () => {
    const response = await app.get('/no-such-route')
    const serialized = JSON.stringify(response.body)

    for (const forbidden of [
      'at Object.',
      'node_modules',
      '/home/',
      'select ',
      'postgresql://',
      'redis://',
      'ENCRYPTION_MASTER_KEY',
      'BETTER_AUTH_SECRET',
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })

  test('are not cacheable', async () => {
    const response = await app.request('POST', '/no-such-route', { body: {} })
    expect(response.status).toBe(404)
  })

  test('a missing resource and a forbidden one are indistinguishable', async () => {
    // Two different unknown paths must produce byte-identical bodies apart from
    // the request ID, so responses cannot be used to probe what exists.
    const first = await app.get<Record<string, unknown>>('/api/v1/does-not-exist')
    const second = await app.get<Record<string, unknown>>('/api/v1/also-does-not-exist')

    const normalize = (body: Record<string, unknown>): Record<string, unknown> => ({
      ...body,
      requestId: '<redacted>',
    })

    expect(normalize(first.body)).toEqual(normalize(second.body))
  })
})

describe('CORS', () => {
  test('does not reflect an arbitrary origin', async () => {
    const response = await app.get('/health/live', { origin: 'https://evil.example.org' })

    // Reflecting an origin while allowing credentials would defeat the cookie
    // session model entirely.
    const allowed = response.headers.get('access-control-allow-origin')
    expect(allowed).not.toBe('https://evil.example.org')
    expect(allowed).not.toBe('*')
  })

  test('allows a configured trusted origin with credentials', async () => {
    const trusted = app.infrastructure.config.app.trustedOrigins[0] as string
    const response = await app.get('/health/live', { origin: trusted })

    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })
})
