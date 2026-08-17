import { BlockList, isIP } from 'node:net'
import { trace } from '@opentelemetry/api'
import { Elysia } from 'elysia'
import type { AppConfig } from '../config/config.schema'
import { enrichRequestContext, getRequestId, type Logger } from '../logging'
import { appMetrics } from '../observability'
import { elapsedMs, startTimer } from '../time'
import { resolveRequestId } from './request-scope'

/**
 * Per-request correlation, access logging, and security headers.
 *
 * Establishes the AsyncLocalStorage context that every later log line, audit
 * record, and outbox event reads, so one identifier ties an HTTP request to the
 * database rows it produced and to the queue jobs those rows triggered.
 *
 * The incoming `x-request-id` is honoured so a reverse proxy or client can
 * correlate across services, but it is bounded and sanitised: it ends up in
 * logs and response headers, so an unchecked value would be a log-injection
 * vector.
 */

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy that overwrites it. The
 * first entry is used, and rate limiting treats the value as a hint rather than
 * an identity — which is why high-risk policies also key on the authenticated
 * user where one exists.
 */
function normalizedIp(value: string): string | undefined {
  const trimmed = value.trim().replace(/^\[|\]$/g, '')
  const withoutMappedPrefix = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed
  return isIP(withoutMappedPrefix) === 0 ? undefined : withoutMappedPrefix
}

export function createClientIpResolver(trustedProxyCidrs: readonly string[]) {
  const trusted = new BlockList()
  for (const value of trustedProxyCidrs) {
    const [rawAddress, rawPrefix] = value.split('/')
    const address = rawAddress === undefined ? undefined : normalizedIp(rawAddress)
    if (address === undefined) throw new Error(`Invalid trusted proxy CIDR: ${value}`)
    const family = isIP(address) === 4 ? 'ipv4' : 'ipv6'
    const defaultPrefix = family === 'ipv4' ? 32 : 128
    const prefix = rawPrefix === undefined ? defaultPrefix : Number(rawPrefix)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > defaultPrefix) {
      throw new Error(`Invalid trusted proxy CIDR: ${value}`)
    }
    trusted.addSubnet(address, prefix, family)
  }

  const isTrusted = (address: string) =>
    trusted.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6')

  return (request: Request, peerAddress?: string): string | undefined => {
    const peer = peerAddress === undefined ? undefined : normalizedIp(peerAddress)
    if (peer === undefined) return undefined
    if (!isTrusted(peer)) return peer

    const forwarded = request.headers.get('x-forwarded-for')
    const chain =
      forwarded === null
        ? []
        : forwarded
            .split(',')
            .map(normalizedIp)
            .filter((entry): entry is string => entry !== undefined)

    if (chain.length === 0) {
      const realIp = request.headers.get('x-real-ip')
      return realIp === null ? peer : (normalizedIp(realIp) ?? peer)
    }

    let current = peer
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      if (!isTrusted(current)) return current
      current = chain[index] as string
    }
    return current
  }
}

/** Conservative compatibility helper: forwarding headers are untrusted. */
export function clientAddress(request: Request, peerAddress?: string): string | undefined {
  return createClientIpResolver([])(request, peerAddress)
}

export function requestContextPlugin(config: AppConfig, logger: Logger) {
  const metrics = appMetrics()
  const resolveClientIp = createClientIpResolver(config.app.trustedProxyCidrs)

  return (
    new Elysia({ name: 'request-context' })
      // onRequest runs before routing, so an unmatched path still gets a
      // correlation ID and the security headers.
      .onRequest(({ request, set }) => {
        // The scope wrapper already established the correlation ID for this
        // request; fall back only if a caller invoked the app without it.
        const requestId = getRequestId() ?? resolveRequestId(request.headers.get('x-request-id'))

        set.headers['x-request-id'] = requestId

        // Security headers. A JSON API is not a browsing context, so the policy
        // is maximally restrictive: nothing here is ever meant to be framed,
        // sniffed, or treated as a document.
        set.headers['x-content-type-options'] = 'nosniff'
        set.headers['x-frame-options'] = 'DENY'
        set.headers['referrer-policy'] = 'no-referrer'
        set.headers['content-security-policy'] = "default-src 'none'; frame-ancestors 'none'"
        set.headers['cross-origin-resource-policy'] = 'same-origin'
        if (config.app.environment === 'production') {
          set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains'
        }
      })
      .derive({ as: 'global' }, ({ request, route, set, server }) => {
        const requestId =
          typeof set.headers['x-request-id'] === 'string'
            ? set.headers['x-request-id']
            : resolveRequestId(request.headers.get('x-request-id'))

        // The route template is only known after routing, so it is added here.
        enrichRequestContext({ route: route ?? 'unmatched' })
        const routeTemplate = route ?? 'unmatched'
        const span = trace.getActiveSpan()
        span?.updateName(`${request.method} ${routeTemplate}`)
        span?.setAttribute('http.route', routeTemplate)

        return {
          requestId,
          startedAt: startTimer(),
          clientIp: resolveClientIp(request, server?.requestIP(request)?.address),
        }
      })
      .onAfterResponse({ as: 'global' }, ({ request, route, set, startedAt, requestId }) => {
        // `derive` does not run for an unmatched path, so there is no start
        // marker for a 404. Report the duration as 0 rather than NaN.
        const duration = typeof startedAt === 'number' ? elapsedMs(startedAt) : 0
        const status = typeof set.status === 'number' ? set.status : 200
        // Route template, never the raw path: a path carries identifiers and
        // would explode metric cardinality.
        const routeTemplate = route ?? 'unmatched'

        metrics.httpRequests.add(1, {
          route: routeTemplate,
          method: request.method,
          status_class: `${Math.floor(status / 100)}xx`,
        })
        metrics.httpRequestDuration.record(duration, {
          route: routeTemplate,
          method: request.method,
        })

        logger.info(
          {
            // `derive` did not run for an unmatched path, so fall back to the
            // ambient scope, which always has the ID.
            requestId: requestId ?? getRequestId(),
            method: request.method,
            route: routeTemplate,
            status,
            durationMs: duration,
          },
          'request completed',
        )
      })
      .as('global')
  )
}
