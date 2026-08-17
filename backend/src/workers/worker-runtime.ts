import { type Job, Worker } from 'bullmq'
import type { Infrastructure } from '../container'
import { newRequestId } from '../shared/ids'
import { describeError, runWithRequestContext } from '../shared/logging'
import { appMetrics, withSpan } from '../shared/observability'
import { createOutboxDispatcher } from '../shared/outbox'
import { ALL_QUEUE_NAMES, QueueName } from '../shared/queue'
import { elapsedMs, startTimer } from '../shared/time'
import { type JobRouter, markOutboxProcessed, recordOutboxFailure } from './job-router'
import { installScheduledJobs, runScheduledJob, type ScheduledJobData } from './scheduled-jobs'

/**
 * The worker process runtime.
 *
 * Runs two things:
 *
 *   the dispatch loop  polls the outbox, publishes due events to BullMQ, and
 *                      reconciles rows stuck in ENQUEUED
 *   queue workers      one BullMQ Worker per logical queue, each with its own
 *                      concurrency budget so a burst of exports cannot starve
 *                      transactional email (master prompt section 20)
 *
 * Every job body carries the outbox event ID, and BullMQ is given that ID as
 * the job ID, so duplicate delivery is both possible and safe.
 */

export interface WorkerRuntime {
  start(): Promise<void>
  stop(): Promise<void>
}

interface OutboxJobData {
  outboxEventId: string
  eventType: string
  organizationId: string | null
  requestId: string | null
  traceParent: string | null
  payload: Record<string, unknown>
}

type WorkerJobData = OutboxJobData | ScheduledJobData

function isScheduledJob(data: WorkerJobData): data is ScheduledJobData {
  return 'kind' in data && data.kind === 'scheduled'
}

export function createWorkerRuntime(
  infrastructure: Infrastructure,
  router: JobRouter,
): WorkerRuntime {
  const { config, logger, queueRedis } = infrastructure
  const metrics = appMetrics()
  const dispatcher = createOutboxDispatcher(
    infrastructure.transactions,
    infrastructure.queues,
    config,
    logger,
  )

  const workers: Worker[] = []
  let dispatchTimer: ReturnType<typeof setTimeout> | undefined
  let running = false

  const concurrencyFor = (queue: string): number => {
    const map: Record<string, number> = {
      [QueueName.Email]: config.worker.concurrency.email,
      [QueueName.NotificationFanout]: config.worker.concurrency.notificationFanout,
      [QueueName.Reminders]: config.worker.concurrency.reminders,
      [QueueName.Integrations]: config.worker.concurrency.integrations,
      [QueueName.Analytics]: config.worker.concurrency.analytics,
      [QueueName.Exports]: config.worker.concurrency.exports,
      [QueueName.MediaCleanup]: config.worker.concurrency.mediaCleanup,
      [QueueName.CacheMaintenance]: config.worker.concurrency.cacheMaintenance,
      [QueueName.OutboxDispatch]: config.worker.concurrency.outboxDispatch,
    }
    return map[queue] ?? 1
  }

  async function processJob(job: Job<WorkerJobData>): Promise<void> {
    const data = job.data
    if (isScheduledJob(data)) {
      const started = startTimer()
      const requestId = newRequestId()
      await withSpan(
        `scheduled ${data.scheduledJobName}`,
        { 'messaging.destination.name': job.queueName, 'messaging.operation.name': 'process' },
        () =>
          runWithRequestContext(
            { requestId, jobId: String(job.id), queueName: job.queueName },
            async () => {
              await runScheduledJob(infrastructure, dispatcher, data.scheduledJobName)
              metrics.queueJobsCompleted.add(1, { queue: job.queueName })
              metrics.queueJobDuration.record(elapsedMs(started), { queue: job.queueName })
            },
          ),
      )
      return
    }
    const handler = router.handlerFor(data.eventType)

    if (handler === undefined) {
      // Not retryable: no amount of waiting will produce a handler. Surface it
      // as a terminal failure so an operator sees the gap.
      const message = `No handler registered for event type "${data.eventType}"`
      logger.error({ eventType: data.eventType, jobId: job.id }, message)
      await recordOutboxFailure(infrastructure, data.outboxEventId, new Error(message), true)
      throw new Error(message)
    }

    const started = startTimer()
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)

    // Reuse the originating request ID so an async effect stays correlated with
    // the HTTP request that caused it.
    const requestId = data.requestId ?? newRequestId()

    metrics.queueJobWaitDuration.record(Math.max(0, Date.now() - job.timestamp), {
      queue: job.queueName,
    })

    await withSpan(
      `process ${data.eventType}`,
      {
        'messaging.destination.name': job.queueName,
        'messaging.operation.name': 'process',
      },
      () =>
        runWithRequestContext(
          {
            requestId,
            jobId: String(job.id),
            queueName: job.queueName,
            ...(data.organizationId ? { organizationId: data.organizationId } : {}),
          },
          async () => {
            try {
              await handler({
                infrastructure,
                outboxEventId: data.outboxEventId,
                eventType: data.eventType,
                organizationId: data.organizationId,
                requestId,
                payload: data.payload ?? {},
                attempt: job.attemptsMade + 1,
              })

              await markOutboxProcessed(infrastructure, data.outboxEventId)

              metrics.queueJobsCompleted.add(1, { queue: job.queueName })
              metrics.queueJobDuration.record(elapsedMs(started), { queue: job.queueName })
            } catch (error) {
              metrics.queueJobsFailed.add(1, {
                queue: job.queueName,
                final: String(isFinalAttempt),
              })
              await recordOutboxFailure(infrastructure, data.outboxEventId, error, isFinalAttempt)
              logger.error(
                {
                  err: describeError(error),
                  eventType: data.eventType,
                  attempt: job.attemptsMade + 1,
                  final: isFinalAttempt,
                },
                'Queue job failed',
              )
              throw error
            }
          },
        ),
      data.traceParent,
    )
  }

  /**
   * Dispatch loop.
   *
   * A timer rather than setInterval: chaining the next tick only after the
   * current one finishes prevents overlapping sweeps from piling up when the
   * database is slow.
   */
  async function dispatchTick(): Promise<void> {
    if (!running) return

    try {
      const dispatched = await dispatcher.dispatchBatch()
      await dispatcher.reconcileStale()
      await dispatcher.oldestPendingAgeSeconds()

      if (dispatched > 0) {
        logger.debug({ dispatched }, 'Dispatched outbox events')
      }
    } catch (error) {
      logger.error({ err: describeError(error) }, 'Outbox dispatch sweep failed')
    }

    if (running) {
      dispatchTimer = setTimeout(() => void dispatchTick(), config.worker.outbox.pollIntervalMs)
    }
  }

  return {
    async start(): Promise<void> {
      running = true

      for (const queueName of ALL_QUEUE_NAMES) {
        const worker = new Worker<WorkerJobData>(queueName, processJob, {
          connection: queueRedis,
          prefix: config.queueRedis.keyPrefix,
          concurrency: concurrencyFor(queueName),
          // A job that outlives this is treated as stalled and re-delivered.
          lockDuration: 60_000,
        })

        worker.on('failed', (job, error) => {
          logger.warn(
            { queue: queueName, jobId: job?.id, err: describeError(error) },
            'Job attempt failed',
          )
        })

        worker.on('error', (error) => {
          logger.error({ queue: queueName, err: describeError(error) }, 'Worker error')
        })

        workers.push(worker)
      }

      await installScheduledJobs(infrastructure)

      logger.info(
        {
          queues: ALL_QUEUE_NAMES.length,
          handlers: router.registeredEventTypes().length,
          schedulers: config.worker.schedulers.enabled ? 'enabled' : 'disabled',
        },
        'Worker process started',
      )

      void dispatchTick()
    },

    async stop(): Promise<void> {
      running = false
      if (dispatchTimer !== undefined) clearTimeout(dispatchTimer)

      // close() stops accepting new jobs and waits for active ones to finish,
      // so a job is never abandoned halfway through its side effect.
      await Promise.all(workers.map((worker) => worker.close()))
      logger.info('Worker process drained')
    },
  }
}
