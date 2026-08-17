import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Ambient per-operation context.
 *
 * Carries the correlation identifiers that must appear on every log line, audit
 * record, and outbox event produced while handling one request or one queue
 * job, without threading them through every function signature.
 *
 * It holds identifiers only. Never put user content, tokens, or session data in
 * here: everything in this object is eligible to be written to logs.
 */
export interface RequestContext {
  /** Correlates every log line, audit row, and outbox event for one operation. */
  readonly requestId: string
  /** Route template (e.g. /api/v1/organizations/:organizationId), never the raw path. */
  readonly route?: string
  readonly method?: string
  readonly userId?: string
  readonly organizationId?: string
  /** Set on worker operations so job logs are attributable. */
  readonly jobId?: string
  readonly queueName?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

/** Run `fn` with `context` visible to everything it awaits. */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn)
}

/**
 * Note on `AsyncLocalStorage.enterWith`.
 *
 * It is deliberately NOT used here. `enterWith` binds the store to the current
 * async resource and every descendant of it, so calling it from a middleware
 * hook contaminates whatever async context that hook happens to run on — in
 * practice the process root, which then stamps a stale request ID onto
 * unrelated background logs. The context is instead established by `run`
 * wrapping the entire request in shared/http/request-scope.ts.
 */

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId
}

/**
 * Merge additional identifiers into the active context.
 *
 * Used once the authenticated actor and tenant are known, so log lines emitted
 * later in the request carry them.
 */
export function enrichRequestContext(patch: Partial<RequestContext>): void {
  const current = storage.getStore()
  if (current === undefined) return
  // The stored object is deliberately mutable so identifiers discovered mid
  // request (actor, tenant) are reflected in log lines emitted afterwards.
  Object.assign(current as unknown as Record<string, unknown>, patch)
}
