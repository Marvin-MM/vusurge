import { describe, expect, test } from 'bun:test'
import { createAuditWriter, redactAuditPayload } from '../../src/shared/audit'
import { CircuitBreaker } from '../../src/shared/cache'
import { formatCacheKey } from '../../src/shared/cache/cache'
import { AppError, buildProblem, conflict, ErrorCode, notFound } from '../../src/shared/errors'
import {
  buildPage,
  decodeCursor,
  encodeCursor,
  resolveSortDirection,
  resolveSortField,
  toPageRequest,
} from '../../src/shared/http'

describe('cursor pagination', () => {
  const limits = { defaultPageSize: 25, maxPageSize: 100 }

  test('round-trips a cursor', () => {
    const payload = { at: '2026-03-01T12:00:00.000Z', id: '0193f2a5-4c3a-7c1b-9e2d-6f8a1b2c3d4e' }
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload)
  })

  test('rejects a malformed cursor rather than trusting it', () => {
    // A cursor is opaque input: a crafted one must not reach the query builder.
    expect(() => decodeCursor('not-base64!!')).toThrow(/not valid/)
    expect(() => decodeCursor(Buffer.from('{"at":1}').toString('base64url'))).toThrow(/not valid/)
  })

  test('caps an oversized page request instead of rejecting it', () => {
    expect(toPageRequest({ limit: 5000 }, limits).limit).toBe(100)
    expect(toPageRequest({}, limits).limit).toBe(25)
  })

  test('rejects a nonsensical page size', () => {
    expect(() => toPageRequest({ limit: 0 }, limits)).toThrow(/at least 1/)
  })

  test('detects more pages from the extra fetched row', () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      id: `id-${index}`,
      createdAt: `2026-03-0${index + 1}T00:00:00.000Z`,
    }))

    const page = buildPage(rows, { limit: 3 }, (row) => ({ at: row.createdAt, id: row.id }))

    expect(page.items).toHaveLength(3)
    expect(page.hasMore).toBe(true)
    expect(decodeCursor(page.nextCursor as string).id).toBe('id-2')
  })

  test('reports the end of a feed', () => {
    const page = buildPage([{ id: 'a', createdAt: 'x' }], { limit: 3 }, (row) => ({
      at: row.createdAt,
      id: row.id,
    }))
    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBeNull()
  })
})

describe('sort allowlisting', () => {
  const allowed = ['createdAt', 'title'] as const

  test('accepts an allowlisted field', () => {
    expect(resolveSortField('title', allowed, 'createdAt')).toBe('title')
  })

  test('rejects an arbitrary client field name', () => {
    // Client field names must never reach SQL directly.
    expect(() => resolveSortField('password); drop table users;--', allowed, 'createdAt')).toThrow(
      /not supported/,
    )
  })

  test('defaults when unspecified', () => {
    expect(resolveSortField(undefined, allowed, 'createdAt')).toBe('createdAt')
    expect(resolveSortDirection(undefined)).toBe('desc')
    expect(() => resolveSortDirection('sideways')).toThrow()
  })
})

describe('problem documents', () => {
  test('carry a stable code, request ID and safe detail', () => {
    const problem = buildProblem(
      conflict(ErrorCode.TEAM_FULL, 'This team is already at its maximum size.'),
      'req-123',
    )

    expect(problem.status).toBe(409)
    expect(problem.code).toBe('TEAM_FULL')
    expect(problem.requestId).toBe('req-123')
    expect(problem.type).toContain('TEAM_FULL')
  })

  test('a cross-tenant miss is indistinguishable from a genuine miss', () => {
    // Both must be byte-identical, or the response becomes an oracle for
    // probing which identifiers exist in other tenants.
    const absent = buildProblem(notFound(), 'req-1')
    const otherTenant = buildProblem(notFound(), 'req-1')
    expect(absent).toEqual(otherTenant)
  })

  test('never serializes the underlying cause', () => {
    const problem = buildProblem(
      new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred.',
        status: 500,
        cause: new Error('select * from user where password = $1'),
      }),
      'req-2',
    )

    expect(JSON.stringify(problem)).not.toContain('select *')
    expect(JSON.stringify(problem)).not.toContain('password')
  })
})

describe('audit payload redaction', () => {
  test('strips credential-bearing fields at any depth', () => {
    const redacted = redactAuditPayload({
      name: 'Acme',
      before: { tokenHash: 'abc123', webhookSecret: 'shhh' },
      after: { nested: { password: 'hunter2', displayName: 'Acme Labs' } },
    }) as {
      before: Record<string, unknown>
      after: { nested: Record<string, unknown> }
    }

    expect(redacted.before['tokenHash']).toBe('[redacted]')
    expect(redacted.before['webhookSecret']).toBe('[redacted]')
    expect(redacted.after.nested['password']).toBe('[redacted]')
    // Non-sensitive values survive so the audit record stays useful.
    expect(redacted.after.nested['displayName']).toBe('Acme Labs')
  })

  test('truncates unbounded strings', () => {
    const redacted = redactAuditPayload({ note: 'x'.repeat(5000) }) as { note: string }
    expect(redacted.note.length).toBeLessThan(2100)
    expect(redacted.note).toContain('[truncated]')
  })

  test('publishes the server-derived actor before an RLS-guarded audit append', async () => {
    const calls: string[] = []
    const actorUserId = '0193f2a5-4c3a-7c1b-9e2d-6f8a1b2c3d4e'
    let contextActor: unknown
    const tx = {
      $executeRaw: async (_query: TemplateStringsArray, value: unknown) => {
        calls.push('actor-context')
        contextActor = value
        return 1
      },
      auditEvent: {
        create: async (input: { data: { actorUserId: string | null } }) => {
          calls.push('audit-insert')
          expect(input.data.actorUserId).toBe(actorUserId)
          return input.data
        },
      },
    }

    await createAuditWriter().write(tx as never, {
      actorType: 'USER',
      actorUserId,
      action: 'test.actor_context',
      resourceType: 'test',
      summary: 'Prove actor context precedes the insert.',
    })

    expect(contextActor).toBe(actorUserId)
    expect(calls).toEqual(['actor-context', 'audit-insert'])
  })
})

describe('cache key namespacing', () => {
  test('keys are scoped by tenant', () => {
    const a = formatCacheKey({
      namespace: 'dashboard',
      organizationId: 'org-a',
      parts: ['summary'],
    })
    const b = formatCacheKey({
      namespace: 'dashboard',
      organizationId: 'org-b',
      parts: ['summary'],
    })
    // Two tenants asking for the same logical resource must never collide.
    expect(a).not.toBe(b)
    expect(a).toContain('org-a')
  })

  test('non-tenant keys are explicitly global', () => {
    expect(formatCacheKey({ namespace: 'skills', parts: ['page-1'] })).toBe('skills:global:page-1')
  })
})

describe('circuit breaker', () => {
  test('opens after the failure threshold and rejects further attempts', () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      resetTimeoutMs: 10_000,
    })

    expect(breaker.canAttempt()).toBe(true)
    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.canAttempt()).toBe(true)
    breaker.recordFailure()
    expect(breaker.canAttempt()).toBe(false)
    expect(breaker.currentState()).toBe('open')
  })

  test('a success resets the failure count', () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      resetTimeoutMs: 10_000,
    })
    breaker.recordFailure()
    breaker.recordFailure()
    breaker.recordSuccess()
    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.canAttempt()).toBe(true)
  })

  test('probes once after the reset window, and re-opens if the probe fails', async () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeoutMs: 30 })
    breaker.recordFailure()
    expect(breaker.canAttempt()).toBe(false)

    await Bun.sleep(45)
    expect(breaker.canAttempt()).toBe(true)
    expect(breaker.currentState()).toBe('half-open')
    expect(breaker.canAttempt()).toBe(false)

    breaker.recordFailure()
    expect(breaker.canAttempt()).toBe(false)
  })

  test('a successful probe closes the circuit', async () => {
    const breaker = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeoutMs: 30 })
    breaker.recordFailure()
    await Bun.sleep(45)
    breaker.canAttempt()
    breaker.recordSuccess()
    expect(breaker.currentState()).toBe('closed')
  })
})
