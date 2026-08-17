import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTestApp, type TestApp } from '../helpers/test-app'

/**
 * Health and readiness through the full HTTP pipeline.
 *
 * These endpoints are the contract an orchestrator acts on: a wrong status code
 * either restarts healthy processes or keeps broken ones in rotation.
 */

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
})

afterAll(async () => {
  await app.dispose()
})

describe('GET /health/live', () => {
  test('reports the process is alive without touching dependencies', async () => {
    const response = await app.get<{ status: string; service: string; uptimeSeconds: number }>(
      '/health/live',
    )

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  test('does not leak connection details', async () => {
    const response = await app.get('/health/live')
    const serialized = JSON.stringify(response.body)

    for (const secret of ['postgresql://', 'redis://', 'password', 'ip_app']) {
      expect(serialized).not.toContain(secret)
    }
  })
})

describe('GET /health/ready', () => {
  test('reports dependency readiness by name and state only', async () => {
    const response = await app.get<{
      status: string
      dependencies: { name: string; status: string; required: boolean }[]
    }>('/health/ready')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ready')

    const names = response.body.dependencies.map((entry) => entry.name)
    expect(names).toContain('postgresql')
    expect(names).toContain('cache-redis')
    expect(names).toContain('queue-redis')

    // PostgreSQL is the only hard dependency for the API role: the cache is
    // never required, and a queue outage delays effects rather than losing them.
    const postgres = response.body.dependencies.find((entry) => entry.name === 'postgresql')
    const cache = response.body.dependencies.find((entry) => entry.name === 'cache-redis')
    expect(postgres?.required).toBe(true)
    expect(cache?.required).toBe(false)
  })

  test('is never cached by an intermediary', async () => {
    const response = await app.get('/health/ready')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('request correlation', () => {
  test('every response carries a request ID', async () => {
    const response = await app.get('/health/live')
    const requestId = response.headers.get('x-request-id')

    expect(requestId).toBeTruthy()
    expect(requestId?.length).toBeGreaterThan(8)
  })

  test('honours a caller-supplied request ID', async () => {
    const response = await app.get('/health/live', { 'x-request-id': 'trace-from-gateway-1' })
    expect(response.headers.get('x-request-id')).toBe('trace-from-gateway-1')
  })

  test('replaces a malformed request ID rather than echoing it', async () => {
    // The value is written to logs and reflected in a response header, so an
    // unchecked one is a log-injection vector. These are legal HTTP header
    // values but fall outside the accepted correlation-ID alphabet.
    for (const malformed of ['<script>alert(1)</script>', 'id";DROP", "x', 'id/../../etc']) {
      const response = await app.get('/health/live', { 'x-request-id': malformed })

      const returned = response.headers.get('x-request-id')
      expect(returned).not.toBe(malformed)
      expect(returned).toMatch(/^[A-Za-z0-9._-]+$/)
    }
  })

  test('replaces an over-long request ID', async () => {
    const response = await app.get('/health/live', { 'x-request-id': 'a'.repeat(500) })
    expect(response.headers.get('x-request-id')?.length).toBeLessThan(100)
  })
})

describe('OpenAPI document', () => {
  test('is generated from the route definitions', async () => {
    const response = await app.get<{
      openapi: string
      paths: Record<string, unknown>
    }>('/openapi/json')

    expect(response.status).toBe(200)
    expect(response.body.openapi).toMatch(/^3\./)
    expect(Object.keys(response.body.paths)).toContain('/health/live')
  })

  test('contains no secret values', async () => {
    const response = await app.get('/openapi/json')
    const serialized = JSON.stringify(response.body)

    for (const secret of ['postgresql://', 'redis://', 'BETTER_AUTH_SECRET', 'ENCRYPTION_MASTER']) {
      expect(serialized).not.toContain(secret)
    }
  })
})
