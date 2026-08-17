import { Elysia } from 'elysia'
import type { AccessContext, AccessContextResolver } from '../authorization'
import type { AppConfig } from '../config/config.schema'
import type { Database } from '../database'
import { badRequest, notFound, unauthenticated } from '../errors'
import { createClientIpResolver } from '../http/request-context.plugin'
import { isUuid } from '../ids'
import { assertCsrfSafe, assertCsrfToken, createCsrfToken, isSafeMethod } from '../security'
import type { BetterAuthInstance } from './better-auth'

/**
 * Provides the `access` derive that every business route reads its
 * `AccessContext` from.
 *
 * Every business route gets an `access` value built from the current
 *      session plus authoritative database state, via `AccessContextResolver`.
 *      Routes read `access` and pass it to `authorize()`; nothing downstream
 *      of this plugin trusts a client-supplied identity claim.
 */

export interface AuthPluginDependencies {
  readonly auth: BetterAuthInstance
  readonly resolver: AccessContextResolver
  readonly config: AppConfig
}

/**
 * Mount Better Auth exactly once at the application root.
 *
 * This deliberately contains no derives or macros. Keeping the catch-all
 * handler separate prevents Elysia from prefixing and re-registering it when
 * the reusable auth context plugin is consumed by grouped business modules.
 */
export function betterAuthHandlerPlugin({
  auth,
  config,
  database,
}: Pick<AuthPluginDependencies, 'auth' | 'config'> & { readonly database: Database }) {
  return new Elysia({ name: 'better-auth-handler' }).all(
    `${config.auth.basePath}/*`,
    async ({ request }) => {
      const response = await auth.handler(request)
      const relativePath = new URL(request.url).pathname.slice(config.auth.basePath.length)
      if (response.ok && relativePath.startsWith('/two-factor/verify-')) {
        const body = (await response
          .clone()
          .json()
          .catch(() => null)) as { token?: unknown } | null
        if (typeof body?.token === 'string') {
          // Covers both sign-in verification and a step-up performed by an
          // already authenticated session. The response is withheld until the
          // assurance write succeeds.
          await database.client.session.updateMany({
            where: { token: body.token },
            data: { mfaVerifiedAt: new Date(), authenticationMethod: 'mfa' },
          })
        }
      }
      return response
    },
    { detail: { hide: true } },
  )
}

/** Elysia macro/derive surface, usable by any route registered after this plugin. */
export function authPlugin({ auth, resolver, config }: AuthPluginDependencies) {
  const resolveClientIp = createClientIpResolver(config.app.trustedProxyCidrs)
  return new Elysia({ name: 'auth-context' })
    .derive({ as: 'global' }, async ({ request, server }): Promise<{ access: AccessContext }> => {
      const ipAddress = resolveClientIp(request, server?.requestIP(request)?.address)
      const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)

      const hasSessionCookie =
        request.headers.get('cookie')?.includes(`${config.auth.cookiePrefix}.session_token`) ??
        false

      // CSRF: every unsafe, cookie-authenticated request on OUR routes must
      // originate from a trusted origin. Requests without a session cookie
      // carry no ambient authority and are left alone (webhooks, etc.).
      assertCsrfSafe({
        method: request.method,
        originHeader: request.headers.get('origin'),
        refererHeader: request.headers.get('referer'),
        hasSessionCookie,
        trustedOrigins: config.app.trustedOrigins,
        publicBaseUrl: config.app.publicBaseUrl,
      })

      if (session === null) {
        return {
          access: {
            actor: null,
            ipAddress,
            userAgent: request.headers.get('user-agent') ?? undefined,
          },
        }
      }

      if (hasSessionCookie && !isSafeMethod(request.method)) {
        assertCsrfToken(
          request.headers.get('x-csrf-token'),
          createCsrfToken(
            config.auth.secret,
            session.session.id,
            session.session.mfaVerifiedAt ?? null,
          ),
        )
      }

      const actor = await resolver.resolveActor(session.user.id, {
        id: session.session.id,
        createdAt: session.session.createdAt,
        mfaVerifiedAt: session.session.mfaVerifiedAt ?? null,
        authenticationMethod: session.session.authenticationMethod ?? null,
      })

      return {
        access: {
          actor,
          ipAddress,
          userAgent: request.headers.get('user-agent') ?? undefined,
        },
      }
    })
    .macro({
      /**
       * Require an authenticated actor.
       *
       * Throws rather than returning a hand-built response, so the denial
       * flows through the single global error handler and carries the real
       * request ID like every other failure (master prompt section 33).
       */
      requireAuth: {
        resolve({ access }) {
          if (access.actor === null) {
            throw unauthenticated()
          }
          return {
            access: access as AccessContext & { actor: NonNullable<AccessContext['actor']> },
          }
        },
      },

      /**
       * Resolve `access.organization` from the route's `:organizationId`.
       *
       * Every tenant-admin route names its organization explicitly in the
       * path — never a cookie-selected "active organization" (master prompt
       * section 34, preamble). A missing or non-existent organization
       * produces the SAME 404 an unauthorized caller would see for a real
       * one, so a response can never be used to probe which organization
       * IDs exist (master prompt section 35).
       */
      orgContext: {
        async resolve({ access, params }) {
          const organizationId = (params as Record<string, string | undefined>)['organizationId']
          if (organizationId === undefined || !isUuid(organizationId)) {
            throw badRequest('A valid organization identifier is required in the path.')
          }

          const organization = await resolver.resolveOrganization(
            organizationId,
            access.actor?.userId ?? null,
          )
          if (organization === null) {
            throw notFound('The requested resource was not found.')
          }

          return { access: { ...access, organization } }
        },
      },

      /**
       * Resolve `access.challenge` from the route's `:challengeId`.
       *
       * Depends on `orgContext` having already resolved `access.organization`
       * — a challenge is only ever addressed within its organization's path,
       * never on its own. A missing or non-existent challenge produces the
       * same 404 an unauthorized caller would see, for the same reason
       * `orgContext` does.
       */
      challengeContext: {
        async resolve({ access, params }) {
          const challengeId = (params as Record<string, string | undefined>)['challengeId']
          if (challengeId === undefined || !isUuid(challengeId)) {
            throw badRequest('A valid challenge identifier is required in the path.')
          }
          const organizationId = access.organization?.organizationId
          if (organizationId === undefined) {
            throw badRequest('challengeContext requires orgContext to run first.')
          }

          const challenge = await resolver.resolveChallenge(
            challengeId,
            organizationId,
            access.actor?.userId ?? null,
          )
          if (challenge === null) {
            throw notFound('The requested resource was not found.')
          }

          return { access: { ...access, challenge } }
        },
      },
    })
    .as('global')
}

/** The reusable, pre-built auth plugin instance every module route depends on. */
export type AuthPlugin = ReturnType<typeof authPlugin>
