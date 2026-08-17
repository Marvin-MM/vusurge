import type { AuditActorType } from '../../generated/prisma/enums'
import type { PrismaTransactionClient } from '../database'
import { newId } from '../ids'
import { getRequestContext } from '../logging'

/**
 * Writing audit evidence.
 *
 * The audit trail and the application log are different systems. A log line is
 * operational telemetry that may be sampled, rotated, or lost; an audit row is
 * durable business evidence written inside the same transaction as the change
 * it records, so it exists if and only if the change committed.
 *
 * The runtime database role holds INSERT and SELECT on `audit_event` and
 * nothing else, so there is deliberately no update or delete path here: a
 * mistaken record is corrected by appending another event.
 *
 * Never put secrets, tokens, passwords, raw private submission content, or
 * unredacted personal data into `changes` (master prompt section 29).
 */

export interface AuditEventInput {
  readonly organizationId?: string
  readonly actorType: AuditActorType
  readonly actorUserId?: string
  /** Stable dotted action, e.g. 'organization.membership.role_changed'. */
  readonly action: string
  readonly resourceType: string
  readonly resourceId?: string
  /** One safe sentence. Shown to organization admins reading the audit log. */
  readonly summary: string
  /** Redacted before/after fragments. */
  readonly changes?: Record<string, unknown>
  /** Operator justification. Required by policy for high-privilege actions. */
  readonly reason?: string
  readonly ipAddress?: string
  readonly userAgent?: string
}

export interface AuditWriter {
  write(tx: PrismaTransactionClient, event: AuditEventInput): Promise<string>
}

/**
 * Field names whose values are stripped from audit `changes` payloads.
 *
 * Defence in depth: call sites are expected to pass already-safe fragments,
 * but a new field added to a model should not silently start appearing in the
 * audit log.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'secret',
  'apiKey',
  'clientSecret',
  'webhookSecret',
  'encryptedCredential',
  'credentialCiphertext',
  'plaintextCode',
  'codeHash',
  'twoFactorSecret',
  'backupCodes',
])

export function redactAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]'
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => redactAuditPayload(entry, depth + 1))
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_FIELDS.has(key) ? '[redacted]' : redactAuditPayload(entry, depth + 1)
    }
    return result
  }
  if (typeof value === 'string' && value.length > 2000) {
    return `${value.slice(0, 2000)}…[truncated]`
  }
  return value
}

export function createAuditWriter(): AuditWriter {
  return {
    async write(tx, event): Promise<string> {
      const context = getRequestContext()
      const id = newId()

      // User-owned and target-organization audit events are also emitted from
      // tenant-free workflows (support, moderation, user media). Publish the
      // server-derived actor into this transaction before the RLS-guarded
      // append. This setting is transaction-local and is never sourced from a
      // client payload.
      if (event.actorUserId !== undefined) {
        await tx.$executeRaw`select set_config('app.actor_user_id', ${event.actorUserId}, true)`
      }

      await tx.auditEvent.create({
        data: {
          id,
          organizationId: event.organizationId ?? null,
          actorType: event.actorType,
          actorUserId: event.actorUserId ?? null,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId ?? null,
          summary: event.summary.slice(0, 500),
          changes:
            event.changes === undefined ? undefined : (redactAuditPayload(event.changes) as never),
          reason: event.reason?.slice(0, 1000) ?? null,
          requestId: context?.requestId ?? null,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent?.slice(0, 500) ?? null,
        },
      })

      return id
    },
  }
}
