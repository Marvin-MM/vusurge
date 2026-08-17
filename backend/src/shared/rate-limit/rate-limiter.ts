import type { RedisConnection } from '../cache'
import type { AppConfig } from '../config/config.schema'
import { rateLimited } from '../errors'
import { describeError, type Logger } from '../logging'
import { appMetrics } from '../observability'
import type { RateLimitPolicy } from './policies'

/**
 * Distributed rate limiting.
 *
 * Uses a fixed window implemented as a single atomic Redis script: INCR the
 * counter and, on the first hit, set its expiry. Doing both in one script
 * removes the race where a counter is incremented but never expires, which
 * would permanently lock out a key.
 *
 * A fixed window can allow up to 2x the limit across a window boundary. That is
 * an accepted trade for O(1) memory per key; the high-risk policies are sized
 * with that burst in mind.
 *
 * When Redis is unavailable, behaviour depends on the policy's risk level:
 * high-risk policies fail closed, because "the cache is down" must never become
 * an unlimited window against credentials or join codes (master prompt 36).
 */

const LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`

export interface RateLimitIdentity {
  readonly ipAddress?: string
  readonly userId?: string
  readonly organizationId?: string
  readonly route?: string
}

export interface RateLimitDecision {
  readonly allowed: boolean
  readonly remaining: number
  readonly limit: number
  readonly retryAfterSeconds: number
}

export interface RateLimiter {
  check(policy: RateLimitPolicy, identity: RateLimitIdentity): Promise<RateLimitDecision>
  /** Check and throw a 429 when the limit is exceeded. */
  enforce(policy: RateLimitPolicy, identity: RateLimitIdentity): Promise<void>
}

function identityKeys(policy: RateLimitPolicy, identity: RateLimitIdentity): string[] {
  switch (policy.scope) {
    case 'ip':
      return identity.ipAddress === undefined ? [] : [`ip:${identity.ipAddress}`]
    case 'user':
      return identity.userId === undefined ? [] : [`user:${identity.userId}`]
    case 'organization':
      return identity.organizationId === undefined ? [] : [`org:${identity.organizationId}`]
    case 'ip+user':
      return [
        ...(identity.ipAddress === undefined ? [] : [`ip:${identity.ipAddress}`]),
        ...(identity.userId === undefined ? [] : [`user:${identity.userId}`]),
      ]
    case 'ip+route':
      return identity.ipAddress === undefined
        ? []
        : [`ip-route:${identity.ipAddress}|${identity.route ?? 'unknown'}`]
  }
}

export function createRateLimiter(
  connection: RedisConnection,
  config: AppConfig,
  logger: Logger,
): RateLimiter {
  const metrics = appMetrics()

  const limiter: RateLimiter = {
    async check(policy, identity): Promise<RateLimitDecision> {
      if (!config.rateLimit.enabled) {
        return {
          allowed: true,
          remaining: policy.maxRequests,
          limit: policy.maxRequests,
          retryAfterSeconds: 0,
        }
      }

      const subjects = identityKeys(policy, identity)

      if (subjects.length === 0) {
        // No usable identity. For a high-risk policy that is itself suspicious
        // (an unauthenticated caller behind a proxy that strips the client IP),
        // so deny rather than wave it through.
        if (policy.riskLevel === 'high' && config.rateLimit.failClosedOnHighRisk) {
          metrics.rateLimitEvents.add(1, { policy: policy.name, outcome: 'denied-no-identity' })
          return {
            allowed: false,
            remaining: 0,
            limit: policy.maxRequests,
            retryAfterSeconds: policy.windowSeconds,
          }
        }
        return {
          allowed: true,
          remaining: policy.maxRequests,
          limit: policy.maxRequests,
          retryAfterSeconds: 0,
        }
      }

      try {
        // Combined scopes consume independent counters. A user changing IPs
        // and many users sharing one abusive IP are both bounded.
        const results = await Promise.all(
          subjects.map(
            async (subject) =>
              (await connection.eval(
                LIMIT_SCRIPT,
                1,
                `ratelimit:${policy.name}:${subject}`,
                String(policy.windowSeconds),
              )) as [number, number],
          ),
        )

        const allowed = results.every(([count]) => count <= policy.maxRequests)
        const remaining = Math.min(
          ...results.map(([count]) => Math.max(0, policy.maxRequests - count)),
        )
        const retryAfterSeconds = Math.max(
          ...results.map(([, ttl]) => (ttl > 0 ? ttl : policy.windowSeconds)),
        )

        metrics.rateLimitEvents.add(1, {
          policy: policy.name,
          outcome: allowed ? 'allowed' : 'limited',
        })

        return {
          allowed,
          remaining,
          limit: policy.maxRequests,
          retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
        }
      } catch (error) {
        const failClosed = policy.riskLevel === 'high' && config.rateLimit.failClosedOnHighRisk

        logger.error(
          { err: describeError(error), policy: policy.name, failClosed },
          failClosed
            ? 'Rate limiter unavailable; denying a high-risk request'
            : 'Rate limiter unavailable; allowing a standard-risk request',
        )

        metrics.rateLimitEvents.add(1, {
          policy: policy.name,
          outcome: failClosed ? 'denied-degraded' : 'allowed-degraded',
        })

        return {
          allowed: !failClosed,
          remaining: 0,
          limit: policy.maxRequests,
          retryAfterSeconds: failClosed ? policy.windowSeconds : 0,
        }
      }
    },

    async enforce(policy, identity): Promise<void> {
      const decision = await limiter.check(policy, identity)
      if (decision.allowed) return

      throw rateLimited(
        'Too many requests. Wait before trying again.',
        decision.retryAfterSeconds,
        { meta: { policy: policy.name, limit: decision.limit } },
      )
    },
  }

  return limiter
}
