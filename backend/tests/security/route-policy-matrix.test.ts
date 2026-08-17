import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createApp } from '../../src/app'
import { assertRoutePolicy, routePolicy } from '../../src/shared/http'
import { createTestInfrastructure, type TestInfrastructure } from '../helpers/test-infrastructure'

let infrastructure: TestInfrastructure
let routes: Array<{ method: string; path: string }>

beforeAll(async () => {
  infrastructure = await createTestInfrastructure({}, { connectDependencies: false })
  const app = createApp({ infrastructure })
  routes = app.routes.flatMap((route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method]
    return methods.map((method) => ({ method, path: route.path }))
  })
})

afterAll(async () => {
  await infrastructure?.dispose()
})

describe('route security policy matrix', () => {
  test('classifies every registered operation and has no nested auth wildcard', () => {
    const keys = new Set<string>()
    for (const route of routes) {
      const key = `${route.method.toUpperCase()} ${route.path}`
      expect(keys.has(key)).toBe(false)
      keys.add(key)
      const policy = routePolicy(route.method, route.path)
      expect(() => assertRoutePolicy(route.method, route.path, policy)).not.toThrow()
      expect(route.path).not.toMatch(/\/api\/v1\/(?:api\/v1|[^/]+\/api\/v1)\/auth/)
    }
    expect(routes.length).toBeGreaterThan(150)
  })

  test('marks every unsafe cookie-authenticated operation as CSRF-protected', () => {
    for (const route of routes) {
      const policy = routePolicy(route.method, route.path)
      if (
        policy.authentication === 'session' &&
        !['GET', 'HEAD', 'OPTIONS'].includes(route.method.toUpperCase())
      ) {
        expect(policy.csrf).toBe('required')
      }
    }
  })

  test('classifies non-repeatable and sensitive routes explicitly', () => {
    expect(routePolicy('POST', '/api/v1/organization-applications')).toMatchObject({
      idempotencyKey: 'required',
      csrf: 'required',
    })
    expect(routePolicy('POST', '/api/v1/me/account-deletion-request')).toMatchObject({
      idempotencyKey: 'required',
      freshSession: true,
    })
    expect(
      routePolicy(
        'POST',
        '/api/v1/organizations/:organizationId/challenges/:challengeId/results/publish',
      ),
    ).toMatchObject({ idempotencyKey: 'required', freshSession: true })
    expect(routePolicy('POST', '/api/v1/platform/organizations/id/suspend')).toMatchObject({
      mfa: 'recent-platform-assurance',
      freshSession: true,
    })
    expect(routePolicy('GET', '/api/v1/files/id/download')).toMatchObject({
      tenantContext: 'resolved-resource',
      freshSession: false,
    })
  })

  test('keeps runtime business routes and OpenAPI operations in exact parity', async () => {
    const document = (await Bun.file(
      new URL('../../docs/openapi.json', import.meta.url),
    ).json()) as {
      paths: Record<
        string,
        Record<
          string,
          {
            'x-route-policy'?: unknown
            parameters?: Array<{ in?: string; name?: string; required?: boolean }>
          }
        >
      >
    }
    const operationMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])
    const normalize = (path: string) =>
      path.replaceAll(/\{[^}]+\}/g, ':parameter').replaceAll(/:[^/]+/g, ':parameter')
    const runtime = new Set(
      routes
        .filter(
          (route) =>
            !route.path.startsWith('/api/v1/auth/') &&
            !route.path.startsWith('/openapi') &&
            route.method.toUpperCase() !== 'OPTIONS' &&
            route.method.toUpperCase() !== 'ALL',
        )
        .map((route) => `${route.method.toUpperCase()} ${normalize(route.path)}`),
    )
    const documented = new Set<string>()
    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!operationMethods.has(method) || path.startsWith('/api/v1/auth/')) continue
        const policy = routePolicy(method, path)
        expect(operation['x-route-policy']).toEqual(policy)
        const requiredHeader = (name: string) =>
          operation.parameters?.find(
            (parameter) =>
              parameter.in === 'header' && parameter.name?.toLowerCase() === name.toLowerCase(),
          )
        if (policy.csrf === 'required') {
          expect(requiredHeader('x-csrf-token')?.required).toBe(true)
        }
        if (policy.idempotencyKey === 'required') {
          expect(requiredHeader('idempotency-key')?.required).toBe(true)
        }
        documented.add(`${method.toUpperCase()} ${normalize(path)}`)
      }
    }

    expect([...runtime].filter((key) => !documented.has(key))).toEqual([])
    expect([...documented].filter((key) => !runtime.has(key))).toEqual([])
  })
})
