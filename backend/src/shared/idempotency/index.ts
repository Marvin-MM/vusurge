import type { AppConfig } from '../config/config.schema'
import type { PrismaTransactionClient, TenantTransactionRunner } from '../database'
import { AppError, conflict, ErrorCode } from '../errors'
import { newId } from '../ids'
import { getRequestContext } from '../logging'
import { hashRequestBody } from '../security'

export interface IdempotentResult<T> {
  readonly value: T
  readonly replayed: boolean
  readonly status: number
}

export interface IdempotencyContext {
  readonly actorUserId: string
  readonly operation: string
  readonly key: string
  readonly requestBody: unknown
  readonly organizationId?: string
}

export interface IdempotencyStore {
  /**
   * Execute a mutation and persist its response in the same transaction. The
   * callback must use the supplied client for every business, audit and outbox
   * write.
   */
  run<T>(
    context: IdempotencyContext,
    operation: (tx: PrismaTransactionClient) => Promise<{ status: number; body: T }>,
  ): Promise<IdempotentResult<T>>
  purgeExpired(): Promise<number>
}

interface StoredAppError {
  readonly kind: 'app-error'
  readonly code: ErrorCode
  readonly message: string
  readonly fieldErrors?: AppError['fieldErrors']
  readonly meta?: AppError['meta']
  readonly retryAfterSeconds?: number
}

type TransactionOutcome<T> =
  | { readonly kind: 'success'; readonly result: IdempotentResult<T> }
  | { readonly kind: 'error'; readonly error: AppError }

function storageOperation(context: IdempotencyContext): string {
  const value =
    context.organizationId === undefined
      ? context.operation
      : `${context.operation}@${context.organizationId}`
  if (value.length > 120) {
    throw new Error('The scoped idempotency operation exceeds its database limit.')
  }
  return value
}

function validateContext(context: IdempotencyContext): void {
  if (context.key.length < 8 || context.key.length > 255) {
    throw new AppError({
      code: ErrorCode.MALFORMED_REQUEST,
      message: 'Idempotency-Key must contain between 8 and 255 characters.',
      status: 400,
    })
  }
  if (context.operation.trim() === '') {
    throw new Error('An idempotency operation name is required.')
  }
}

export function createIdempotencyStore(
  transactions: TenantTransactionRunner,
  config: AppConfig,
): IdempotencyStore {
  const ttlMs = config.retention.idempotencyRecordHours * 3600 * 1000

  return {
    async run<T>(
      context: IdempotencyContext,
      operation: (tx: PrismaTransactionClient) => Promise<{ status: number; body: T }>,
    ): Promise<IdempotentResult<T>> {
      validateContext(context)
      const requestHash = hashRequestBody(context.requestBody)
      const scopedOperation = storageOperation(context)
      const lockIdentity = [
        context.actorUserId,
        context.organizationId ?? 'global',
        context.operation,
        context.key,
      ].join('|')
      const requestId = getRequestContext()?.requestId ?? null

      const execute = async (tx: PrismaTransactionClient): Promise<TransactionOutcome<T>> => {
        // A waiter sees the committed response after the first transaction;
        // no externally committed in-progress claim can be stranded by a
        // crash between the business commit and response persistence.
        await tx.$queryRaw`
          select pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))::text as acquired
        `

        const existing = await tx.idempotencyRecord.findUnique({
          where: {
            actorUserId_operation_idempotencyKey: {
              actorUserId: context.actorUserId,
              operation: scopedOperation,
              idempotencyKey: context.key,
            },
          },
        })
        if (existing !== null) {
          return { kind: 'success', result: replay(existing, requestHash) }
        }

        // A savepoint lets deterministic 4xx outcomes be stored while rolling
        // back any partial business work performed before the rejection.
        await tx.$executeRawUnsafe('SAVEPOINT idempotency_operation')
        try {
          const result = await operation(tx)
          const now = await transactions.databaseNow(tx)
          await tx.idempotencyRecord.create({
            data: {
              id: newId(),
              actorUserId: context.actorUserId,
              operation: scopedOperation,
              idempotencyKey: context.key,
              requestHash,
              organizationId: context.organizationId ?? null,
              requestId,
              responseStatus: result.status,
              responseBody: result.body as never,
              completedAt: now,
              expiresAt: new Date(now.getTime() + ttlMs),
            },
          })
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT idempotency_operation')
          return {
            kind: 'success',
            result: { value: result.body, replayed: false, status: result.status },
          }
        } catch (error) {
          if (!AppError.isAppError(error) || error.status >= 500) throw error

          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT idempotency_operation')
          const now = await transactions.databaseNow(tx)
          const storedError: StoredAppError = {
            kind: 'app-error',
            code: error.code,
            message: error.message,
            ...(error.fieldErrors === undefined ? {} : { fieldErrors: error.fieldErrors }),
            ...(error.meta === undefined ? {} : { meta: error.meta }),
            ...(error.retryAfterSeconds === undefined
              ? {}
              : { retryAfterSeconds: error.retryAfterSeconds }),
          }
          await tx.idempotencyRecord.create({
            data: {
              id: newId(),
              actorUserId: context.actorUserId,
              operation: scopedOperation,
              idempotencyKey: context.key,
              requestHash,
              organizationId: context.organizationId ?? null,
              requestId,
              responseStatus: error.status,
              responseBody: storedError as never,
              completedAt: now,
              expiresAt: new Date(now.getTime() + ttlMs),
            },
          })
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT idempotency_operation')
          return { kind: 'error', error }
        }
      }

      const outcome =
        context.organizationId === undefined
          ? await transactions.withoutTenant(execute, { actorUserId: context.actorUserId })
          : await transactions.withTenant(context.organizationId, execute, {
              actorUserId: context.actorUserId,
            })

      if (outcome.kind === 'error') throw outcome.error
      return outcome.result
    },

    async purgeExpired(): Promise<number> {
      return transactions.withPlatformAccess(
        async (tx) => {
          const now = await transactions.databaseNow(tx)
          const result = await tx.idempotencyRecord.deleteMany({
            where: { expiresAt: { lt: now } },
          })
          return result.count
        },
        { purpose: 'Purge expired idempotency response records.' },
      )
    },
  }
}

function replay<T>(
  record: {
    requestHash: string
    responseStatus: number | null
    responseBody: unknown
  },
  requestHash: string,
): IdempotentResult<T> {
  if (record.requestHash !== requestHash) {
    throw conflict(
      ErrorCode.IDEMPOTENCY_KEY_REUSED,
      'This Idempotency-Key was already used with a different request body. Use a new key for a new request.',
    )
  }

  if (record.responseStatus === null) {
    throw conflict(
      ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS,
      'An identical request is still being processed. Retry in a moment.',
    )
  }

  if (record.responseStatus >= 400) {
    const stored = record.responseBody as Partial<StoredAppError> | null
    if (stored?.kind === 'app-error' && stored.code !== undefined && stored.message !== undefined) {
      throw new AppError({
        code: stored.code,
        message: stored.message,
        status: record.responseStatus,
        ...(stored.fieldErrors === undefined ? {} : { fieldErrors: stored.fieldErrors }),
        ...(stored.meta === undefined ? {} : { meta: stored.meta }),
        ...(stored.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: stored.retryAfterSeconds }),
      })
    }
    throw new AppError({
      code: ErrorCode.CONFLICT,
      message: 'The original request with this Idempotency-Key was rejected.',
      status: record.responseStatus,
    })
  }

  return {
    value: record.responseBody as T,
    replayed: true,
    status: record.responseStatus,
  }
}
