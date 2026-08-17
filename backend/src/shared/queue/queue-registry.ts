import { type JobsOptions, Queue, type QueueOptions } from 'bullmq'
import type { RedisConnection } from '../cache'
import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'
import { ALL_QUEUE_NAMES, type QueueName } from './queue-names'

/**
 * BullMQ queue handles for producers.
 *
 * Producers only ever enqueue work that a committed outbox row already
 * requires. Enqueueing is therefore allowed to fail: the outbox dispatcher will
 * try again, and the durable record of the obligation lives in PostgreSQL, not
 * in Redis (master prompt section 20).
 */

export interface EnqueueOptions {
  /**
   * Deterministic job identifier. BullMQ refuses a second job with the same ID
   * while the first is still known, which is what makes redelivery safe.
   */
  readonly jobId: string
  readonly delayMs?: number
  readonly priority?: number
  readonly attempts?: number
}

export interface QueueRegistry {
  get(name: QueueName): Queue
  enqueue<T extends object>(
    name: QueueName,
    jobName: string,
    payload: T,
    options: EnqueueOptions,
  ): Promise<void>
  /** Waiting + delayed counts per queue, for readiness and metrics. */
  depths(): Promise<Record<string, number>>
  close(): Promise<void>
}

/**
 * Retry policy shared by every queue: bounded, exponentially backed off, and
 * jittered.
 *
 * Jitter matters: without it, a provider outage makes every failed job retry in
 * lockstep and produces a thundering herd the moment the provider recovers
 * (master prompt section 39). BullMQ applies `jitter` as a fraction of the
 * computed delay, so 0.5 spreads retries across half the backoff window.
 */
export function defaultJobOptions(maxAttempts: number): JobsOptions {
  return {
    attempts: maxAttempts,
    backoff: { type: 'exponential', delay: 1_000, jitter: 0.5 },
    // Keep a bounded window of terminal jobs so failures stay visible in
    // dashboards without letting Redis grow without limit.
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 604_800, count: 5000 },
  }
}

export function createQueueRegistry(
  connection: RedisConnection,
  config: AppConfig,
  logger: Logger,
): QueueRegistry {
  const metrics = appMetrics()
  const queues = new Map<QueueName, Queue>()

  const queueOptions: QueueOptions = {
    connection,
    prefix: config.queueRedis.keyPrefix,
    defaultJobOptions: defaultJobOptions(config.worker.outbox.maxAttempts),
  }

  const getQueue = (name: QueueName): Queue => {
    const existing = queues.get(name)
    if (existing !== undefined) return existing
    const created = new Queue(name, queueOptions)
    queues.set(name, created)
    return created
  }

  metrics.queueDepth.addCallback(async (result) => {
    for (const [name, queue] of queues) {
      try {
        const counts = await queue.getJobCounts('waiting', 'delayed')
        result.observe((counts['waiting'] ?? 0) + (counts['delayed'] ?? 0), { queue: name })
      } catch (error) {
        logger.warn({ err: describeError(error), queue: name }, 'Failed to observe queue depth')
      }
    }
  })

  return {
    get(name: QueueName): Queue {
      return getQueue(name)
    },

    async enqueue(name, jobName, payload, options): Promise<void> {
      const queue = this.get(name)
      await queue.add(jobName, payload, {
        jobId: options.jobId,
        ...(options.delayMs !== undefined ? { delay: options.delayMs } : {}),
        ...(options.priority !== undefined ? { priority: options.priority } : {}),
        ...(options.attempts !== undefined ? { attempts: options.attempts } : {}),
      })
    },

    async depths(): Promise<Record<string, number>> {
      const result: Record<string, number> = {}
      for (const name of ALL_QUEUE_NAMES) {
        try {
          const queue = getQueue(name)
          const counts = await queue.getJobCounts('waiting', 'delayed', 'active', 'failed')
          const depth = (counts['waiting'] ?? 0) + (counts['delayed'] ?? 0)
          result[name] = depth
        } catch (error) {
          logger.warn({ err: describeError(error), queue: name }, 'Failed to read queue depth')
        }
      }
      return result
    },

    async close(): Promise<void> {
      await Promise.all([...queues.values()].map((queue) => queue.close()))
    },
  }
}
