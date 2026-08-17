import { createHash } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { openAPI, twoFactor } from 'better-auth/plugins'
import type { AppConfig } from '../config/config.schema'
import type { Database, TenantTransactionRunner } from '../database'
import type { EmailDeliveryManager } from '../email'
import { EmailCategory, EmailTemplates } from '../email'
import { newId } from '../ids'
import type { Logger } from '../logging'

/**
 * Better Auth instance.
 *
 * Owns identity only: email/password, verification, reset, Google, GitHub,
 * sessions, and two-factor. Organization membership, roles, and every
 * tenant-scoped concern are deliberately NOT modelled through Better Auth's
 * organization plugin — this platform's authorization model (last-owner
 * protection, RLS-backed tenancy, challenge-scoped staff) is custom, built on
 * `shared/authorization` (see ADR 0003).
 *
 * The Prisma client is the same instance the rest of the application uses:
 * Better Auth borrows the connection pool rather than opening a second one.
 */
export function createBetterAuth(
  config: AppConfig,
  database: Database,
  transactions: TenantTransactionRunner,
  emailDeliveries: EmailDeliveryManager,
  logger: Logger,
) {
  void logger
  const tokenDigest = (url: string): string =>
    createHash('sha256').update(url).digest('hex').slice(0, 32)

  function authenticationMethod(path: string | undefined): string {
    if (path?.includes('/two-factor/verify-')) return 'mfa'
    if (path?.includes('/callback/')) return 'oauth'
    if (path?.includes('/sign-in/email')) return 'password'
    return 'unknown'
  }

  return betterAuth({
    baseURL: config.app.publicBaseUrl,
    basePath: config.auth.basePath,
    secret: config.auth.secret,
    trustedOrigins: config.app.trustedOrigins,

    database: prismaAdapter(database.client, { provider: 'postgresql' }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        const { subject, text } = EmailTemplates.passwordResetEmail({
          displayName: user.name || user.email,
          resetUrl: url,
        })
        // Persist only. The provider call happens asynchronously in the email
        // worker, so an outage cannot lose the reset obligation or extend the
        // authentication request by a provider timeout.
        await transactions.withoutTenant(
          async (tx) =>
            emailDeliveries.enqueue(tx, {
              to: user.email,
              category: EmailCategory.PasswordReset,
              subject,
              text,
              idempotencyKey: `auth-password-reset:${user.id}:${tokenDigest(url)}`,
              disableTracking: true,
              recipientUserId: user.id,
              sourceType: 'auth.password_reset',
              sourceKey: `auth-password-reset:${user.id}:${tokenDigest(url)}`,
            }),
          { actorUserId: user.id },
        )
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const { subject, text } = EmailTemplates.verificationEmail({
          displayName: user.name || user.email,
          verificationUrl: url,
        })
        await transactions.withoutTenant(
          async (tx) =>
            emailDeliveries.enqueue(tx, {
              to: user.email,
              category: EmailCategory.Verification,
              subject,
              text,
              idempotencyKey: `auth-verification:${user.id}:${tokenDigest(url)}`,
              disableTracking: true,
              recipientUserId: user.id,
              sourceType: 'auth.verification',
              sourceKey: `auth-verification:${user.id}:${tokenDigest(url)}`,
            }),
          { actorUserId: user.id },
        )
      },
    },

    socialProviders: {
      ...(config.auth.google.enabled
        ? {
            google: {
              clientId: config.auth.google.clientId as string,
              clientSecret: config.auth.google.clientSecret as string,
            },
          }
        : {}),
      ...(config.auth.github.enabled
        ? {
            github: {
              clientId: config.auth.github.clientId as string,
              clientSecret: config.auth.github.clientSecret as string,
              // GitHub OAuth login does not grant private repository access:
              // only the default public scopes are requested (master prompt
              // section 15.2). Never add `repo` here.
            },
          }
        : {}),
    },

    // Account linking: only these two trusted, configured providers, and only
    // when Better Auth has independently verified the email on both sides —
    // never on a bare string match, which would be an account-takeover path
    // (master prompt section 7).
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
      },
    },

    session: {
      expiresIn: config.auth.sessionExpiresInSeconds,
      updateAge: config.auth.sessionUpdateAgeSeconds,
      // Privileged authorization reads current database assurance. Caching the
      // session in the cookie would delay MFA step-up and revocation changes.
      cookieCache: { enabled: false },
      additionalFields: {
        mfaVerifiedAt: {
          type: 'date',
          required: false,
          input: false,
        },
        authenticationMethod: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },

    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            const method = authenticationMethod(context?.path)
            return {
              data: {
                ...session,
                authenticationMethod: method,
                mfaVerifiedAt: method === 'mfa' ? new Date() : null,
              },
            }
          },
        },
      },
    },

    advanced: {
      cookiePrefix: config.auth.cookiePrefix,
      useSecureCookies: config.app.environment === 'production',
      ...(config.auth.cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: config.auth.cookieDomain } }
        : {}),
      // Every table in this schema uses UUIDv7 primary keys (`@db.Uuid`, no
      // database default), including the tables Better Auth owns. A custom
      // generator keeps that consistent instead of Better Auth's default
      // non-UUID ID format, which the `uuid` column type would reject.
      database: { generateId: () => newId() },
    },

    plugins: [
      // Mandatory for PLATFORM_SUPERADMIN, optional for everyone else. The
      // policy layer enforces the mandatory part (see checkPermission's
      // requireFreshSession branch); this plugin just supplies the mechanism.
      // Trusted-device bypass is disabled. A superadmin must establish
      // assurance for every session; ordinary users may still opt into 2FA.
      twoFactor({ issuer: config.app.serviceName, trustDeviceMaxAge: 0 }),
      // The generated schema is merged into the application OpenAPI document
      // by scripts/generate-openapi.ts. Do not expose a second reference UI.
      openAPI({ disableDefaultReference: true }),
    ],
  })
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>
