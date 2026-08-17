import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import type { Infrastructure } from './container'
import { createHealthController } from './modules/health/health.controller'
import { createHealthRepository } from './modules/health/health.repository'
import { healthRoutes } from './modules/health/health.route'
import { createHealthService } from './modules/health/health.service'
import { registerModules } from './modules/register'
import { createWebhooksController } from './modules/webhooks/webhooks.controller'
import { createWebhooksRepository } from './modules/webhooks/webhooks.repository'
import { webhooksRoutes } from './modules/webhooks/webhooks.route'
import { createWebhooksService } from './modules/webhooks/webhooks.service'
import { authPlugin, betterAuthHandlerPlugin } from './shared/auth'
import { errorHandlerPlugin, requestContextPlugin } from './shared/http'

/**
 * HTTP application assembly.
 *
 * Modules are wired here from the infrastructure graph: repositories take the
 * database, services take repositories and infrastructure, controllers take
 * services, and routes take controllers. Nothing reaches across those layers.
 *
 * Plugin order is significant. Request context runs first so that a correlation
 * ID and security headers exist even for a request that fails during parsing;
 * the error handler is registered globally so every later failure is converted
 * to the same problem+json contract.
 */

export interface AppOptions {
  readonly infrastructure: Infrastructure
}

export function createApp(options: AppOptions) {
  const { infrastructure } = options
  const { config, logger } = infrastructure

  // --- Module composition ---------------------------------------------------
  const healthRepository = createHealthRepository(infrastructure.database)
  const healthService = createHealthService({
    repository: healthRepository,
    cache: infrastructure.cache,
    config,
    queueHealthy: async () => {
      try {
        return (await infrastructure.queueRedis.ping()) === 'PONG'
      } catch {
        return false
      }
    },
  })
  const healthController = createHealthController(healthService)

  const webhooksRepository = createWebhooksRepository()
  const webhooksService = createWebhooksService(
    webhooksRepository,
    infrastructure.transactions,
    infrastructure.outbox,
    config,
    logger,
  )
  const webhooksController = createWebhooksController(webhooksService)

  // --- Application ----------------------------------------------------------
  const app = new Elysia({
    name: 'innovation-platform-api',
    // Bound so a single oversized body cannot exhaust process memory
    // (master prompt section 36).
    serve: { maxRequestBodySize: config.app.maxRequestBodyBytes },
  })
    .use(errorHandlerPlugin(config, logger))
    .use(requestContextPlugin(config, logger))
    .use(
      cors({
        // An explicit allowlist. A permissive origin combined with credentials
        // would defeat the cookie session model entirely.
        origin: config.app.trustedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['content-type', 'x-request-id', 'idempotency-key', 'x-csrf-token'],
        exposeHeaders: ['x-request-id', 'retry-after'],
        maxAge: 600,
      }),
    )
    .use(
      openapi({
        // The specification always builds; only the interactive UI is gated,
        // so production can keep the contract exportable without serving a
        // browsable console (master prompt section 33).
        provider: config.features.openApiUi ? 'scalar' : null,
        documentation: {
          info: {
            title: 'Innovation Management Platform API',
            version: config.app.version,
            description:
              'Multi-tenant innovation management platform. Organization-owned resources are ' +
              'addressed by explicit organization identifiers and isolated by tenant at both ' +
              'the application and database layers.',
          },
          servers: [{ url: config.app.publicBaseUrl }],
          tags: [
            { name: 'Health', description: 'Liveness and readiness probes.' },
            { name: 'Meta', description: 'Catalogues and client-visible capabilities.' },
          ],
        },
      }),
    )
    .use(healthRoutes(healthController))
    .use(webhooksRoutes(webhooksController))

  // The auth plugin instance is reused (not rebuilt) inside every module's
  // route file, via `.use(auth)`. Elysia deduplicates plugins by name, so
  // reusing it there does not re-run its setup — it only makes the `access`
  // derive and `requireAuth` macro visible to TypeScript at each module's own
  // route-definition call site, which a later top-level `.use()` cannot do
  // retroactively.
  const auth = authPlugin({
    auth: infrastructure.auth,
    resolver: infrastructure.accessContextResolver,
    config,
  })

  return app
    .use(
      betterAuthHandlerPlugin({
        auth: infrastructure.auth,
        config,
        database: infrastructure.database,
      }),
    )
    .use(auth)
    .use(registerModules(infrastructure, auth))
}

export type App = ReturnType<typeof createApp>
