import { randomUUID } from 'node:crypto'

/**
 * Identifier generation.
 *
 * Primary keys are UUIDv7: they are globally unique like UUIDv4 but their
 * leading bits are a millisecond timestamp, so B-tree inserts stay at the right
 * edge of the index instead of scattering random pages. That matters for the
 * append-heavy tables in this system (audit_event, notification, outbox_event).
 *
 * Unpredictability is NEVER treated as authorization: every object access is
 * checked against the tenant and the actor's permissions regardless of how the
 * identifier was obtained (master prompt section 5.3).
 */

/** Generate a time-ordered UUIDv7 for use as a primary key. */
export function newId(): string {
  return Bun.randomUUIDv7()
}

/** Generate a random UUIDv4, for values where time ordering would leak timing. */
export function newRandomId(): string {
  return randomUUID()
}

/** Generate a correlation identifier for one request or job. */
export function newRequestId(): string {
  return Bun.randomUUIDv7()
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/**
 * Build a deterministic identifier from stable parts.
 *
 * Used for outbox deduplication keys and BullMQ job IDs so that a retried
 * operation produces the same identity and cannot create a duplicate side
 * effect (master prompt section 20).
 */
export function deterministicKey(...parts: readonly (string | number)[]): string {
  return parts.map((part) => String(part)).join(':')
}
