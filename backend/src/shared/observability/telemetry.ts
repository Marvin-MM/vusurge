import {
  type Attributes,
  context as contextApi,
  metrics as metricsApi,
  propagation,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import type { AppConfig } from '../config/config.schema'
import { describeError, type Logger } from '../logging'
import { resetMetricsRegistry } from './metrics'

/**
 * OpenTelemetry bootstrap.
 *
 * Tracing and metrics are independently switchable so a deployment can run
 * metrics-only. When both are off the OpenTelemetry API falls back to no-op
 * implementations and instrumentation call sites cost effectively nothing.
 *
 * Span attributes must never carry PII, tokens, cookies, request bodies, or
 * private submission content (master prompt section 40).
 */

export interface Telemetry {
  readonly tracingEnabled: boolean
  readonly metricsEnabled: boolean
  shutdown(): Promise<void>
}

export function initializeTelemetry(config: AppConfig, logger: Logger): Telemetry {
  const { observability, app } = config
  const shutdownHandlers: (() => Promise<void>)[] = []

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: app.serviceName,
    [ATTR_SERVICE_VERSION]: app.version,
    'deployment.environment.name': app.environment,
    'service.instance.role': app.processRole,
  })

  if (observability.tracingEnabled && observability.otlpTraceEndpoint) {
    const tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(new OTLPTraceExporter({ url: observability.otlpTraceEndpoint })),
      ],
    })
    tracerProvider.register()
    shutdownHandlers.push(() => tracerProvider.shutdown())
    logger.info({ endpoint: observability.otlpTraceEndpoint }, 'OpenTelemetry tracing enabled')
  }

  if (observability.metricsEnabled) {
    const readers = []

    if (observability.otlpMetricEndpoint) {
      readers.push(
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: observability.otlpMetricEndpoint }),
          exportIntervalMillis: 30_000,
        }),
      )
    }

    if (observability.prometheusPort !== undefined) {
      // Bound to an internal interface by configuration: the scrape endpoint is
      // deliberately outside the public API namespace (master prompt 34.1).
      readers.push(
        new PrometheusExporter({
          port: observability.prometheusPort,
          host: observability.prometheusHost,
        }),
      )
      logger.info(
        { host: observability.prometheusHost, port: observability.prometheusPort },
        'Prometheus metrics listener enabled',
      )
    }

    if (readers.length > 0) {
      const meterProvider = new MeterProvider({ resource, readers })
      metricsApi.setGlobalMeterProvider(meterProvider)
      resetMetricsRegistry()
      shutdownHandlers.push(() => meterProvider.shutdown())
      logger.info('OpenTelemetry metrics enabled')
    } else {
      logger.warn(
        'OTEL_METRICS_ENABLED is true but neither an OTLP metrics endpoint nor a Prometheus ' +
          'port is configured; metrics will not be exported',
      )
    }
  }

  return {
    tracingEnabled: observability.tracingEnabled,
    metricsEnabled: observability.metricsEnabled,
    async shutdown(): Promise<void> {
      for (const handler of shutdownHandlers) {
        try {
          await handler()
        } catch (error) {
          logger.warn({ err: describeError(error) }, 'Telemetry shutdown failed')
        }
      }
    },
  }
}

/** Attach the current trace and span IDs, when sampling is active. */
export function currentTraceContext(): { traceId?: string; spanId?: string; traceParent?: string } {
  const span = trace.getActiveSpan()
  if (span === undefined) return {}
  const context = span.spanContext()
  const flags = (context.traceFlags & 1) === 1 ? '01' : '00'
  return {
    traceId: context.traceId,
    spanId: context.spanId,
    traceParent: `00-${context.traceId}-${context.spanId}-${flags}`,
  }
}

const traceParentGetter = {
  keys(carrier: Readonly<Record<string, string>>): string[] {
    return Object.keys(carrier)
  },
  get(carrier: Readonly<Record<string, string>>, key: string): string | undefined {
    return carrier[key]
  },
}

/** Execute one operation in a bounded, low-cardinality span. */
export function withSpan<T>(
  name: string,
  attributes: Attributes,
  work: () => Promise<T> | T,
  parentTraceParent?: string | null,
): Promise<T> {
  const parentContext =
    parentTraceParent === undefined || parentTraceParent === null
      ? contextApi.active()
      : propagation.extract(
          contextApi.active(),
          { traceparent: parentTraceParent },
          traceParentGetter,
        )

  return trace
    .getTracer('innovation-platform-backend')
    .startActiveSpan(name, { attributes }, parentContext, async (span) => {
      try {
        const result = await work()
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR })
        if (error instanceof Error) span.recordException(error)
        throw error
      } finally {
        span.end()
      }
    })
}
