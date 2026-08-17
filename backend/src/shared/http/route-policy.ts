export type RouteAuthentication = 'public' | 'optional-session' | 'session' | 'provider-signature'
export type RouteTenantContext = 'none' | 'organization' | 'challenge' | 'resolved-resource'

export interface RoutePolicy {
  readonly authentication: RouteAuthentication
  readonly tenantContext: RouteTenantContext
  readonly authorization: 'none' | 'provider-signature' | 'better-auth' | 'service-policy'
  readonly csrf: 'not-applicable' | 'better-auth' | 'required'
  readonly freshSession: boolean
  readonly mfa: 'none' | 'platform-assurance' | 'recent-platform-assurance'
  readonly idempotencyKey: 'not-applicable' | 'required'
  readonly rateLimits: readonly string[]
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function canonicalPath(path: string): string {
  const pathname = path.split('?')[0] ?? path
  return pathname
    .replaceAll(/\{[^}]+\}/g, ':param')
    .replaceAll(/:[^/]+/g, ':param')
    .replace(/\/$/, '')
}

function isPublic(path: string, method: string): boolean {
  if (path === '/health/live' || path === '/health/ready') return true
  if (path.startsWith('/api/v1/meta/')) return true
  if (path.startsWith('/api/v1/public/')) return true
  if (path.startsWith('/api/v1/search')) return true
  if (path.startsWith('/openapi')) return true
  if (path === '/api/v1/users/:param/profile' && method === 'GET') return true
  return false
}

function needsIdempotency(method: string, path: string): boolean {
  if (method !== 'POST') return false
  return (
    path === '/api/v1/organization-applications' ||
    path === '/api/v1/me/account-deletion-request' ||
    path === '/api/v1/organizations/:param/invitations' ||
    path === '/api/v1/organizations/:param/exports' ||
    path === '/api/v1/organizations/:param/integrations/:param/test' ||
    path === '/api/v1/organizations/:param/challenges/:param/submissions/:param/finalize' ||
    path === '/api/v1/organizations/:param/challenges/:param/results/publish'
  )
}

function needsFreshSession(method: string, path: string): boolean {
  if (path === '/api/v1/me/account-deletion-request' && !SAFE_METHODS.has(method)) return true
  if (path === '/api/v1/organizations/:param/transfer-ownership') return true
  if (
    path.includes('/members/:param/change-role') ||
    path.includes('/members/:param/reactivate') ||
    path.includes('/members/:param/remove')
  ) {
    return true
  }
  if (path.includes('/integrations') && !SAFE_METHODS.has(method)) return true
  if (path.includes('/exports') && (method !== 'GET' || path.endsWith('/download'))) return true
  if (
    path.endsWith('/results/publish') ||
    path.endsWith('/results/retract') ||
    path.endsWith('/feedback/release')
  ) {
    return true
  }
  if (path.startsWith('/api/v1/files/') && method === 'DELETE') {
    return true
  }
  return path.startsWith('/api/v1/platform/') && !SAFE_METHODS.has(method)
}

function rateLimits(method: string, path: string): string[] {
  const limits: string[] = []
  if (!SAFE_METHODS.has(method)) limits.push('general.authenticated_write')
  if (path === '/api/v1/organization-applications') limits.push('organization.application_create')
  if (path === '/api/v1/organizations/:param/invitations') {
    limits.push('organization.invitation_create')
  }
  if (path.includes('/invitations/:param/accept')) limits.push('invitation.acceptance')
  if (path === '/api/v1/join-codes/redeem') limits.push('organization.join_code_redeem')
  if (path === '/api/v1/organizations/:param/exports' && method === 'POST') {
    limits.push('analytics.export_request')
  }
  if (path === '/api/v1/files/upload-authorization') {
    limits.push('media.file_upload_auth', 'media.file_upload_auth_org')
  }
  if (path === '/api/v1/media/images/upload-authorization') {
    limits.push('media.image_upload_auth')
  }
  if (path.startsWith('/api/v1/public/') || path.startsWith('/api/v1/search')) {
    limits.push('public.read')
  }
  return limits
}

/** Security classification shared by the runtime audit and OpenAPI generator. */
export function routePolicy(methodInput: string, pathInput: string): RoutePolicy {
  const method = methodInput.toUpperCase()
  const path = canonicalPath(pathInput)

  if (path.startsWith('/api/v1/auth')) {
    return {
      authentication: 'optional-session',
      tenantContext: 'none',
      authorization: 'better-auth',
      csrf: 'better-auth',
      freshSession: false,
      mfa: 'none',
      idempotencyKey: 'not-applicable',
      rateLimits: ['auth.provider'],
    }
  }

  if (path === '/webhooks/resend') {
    return {
      authentication: 'provider-signature',
      tenantContext: 'none',
      authorization: 'provider-signature',
      csrf: 'not-applicable',
      freshSession: false,
      mfa: 'none',
      idempotencyKey: 'not-applicable',
      rateLimits: ['webhook.provider'],
    }
  }

  const publicRoute = isPublic(path, method)
  const authentication: RouteAuthentication =
    path === '/api/v1/users/:param/profile'
      ? 'optional-session'
      : publicRoute
        ? 'public'
        : 'session'
  const tenantContext: RouteTenantContext = path.startsWith('/api/v1/files/')
    ? 'resolved-resource'
    : path.includes('/organizations/:param/challenges/:param')
      ? 'challenge'
      : path.includes('/organizations/:param')
        ? 'organization'
        : 'none'
  const freshSession = needsFreshSession(method, path)
  const platform = path.startsWith('/api/v1/platform/')

  return {
    authentication,
    tenantContext,
    authorization: publicRoute ? 'none' : 'service-policy',
    csrf: authentication === 'session' && !SAFE_METHODS.has(method) ? 'required' : 'not-applicable',
    freshSession,
    mfa: platform ? (freshSession ? 'recent-platform-assurance' : 'platform-assurance') : 'none',
    idempotencyKey: needsIdempotency(method, path) ? 'required' : 'not-applicable',
    rateLimits: rateLimits(method, path),
  }
}

export function assertRoutePolicy(method: string, path: string, policy: RoutePolicy): void {
  const normalizedMethod = method.toUpperCase()
  if (
    policy.authentication === 'session' &&
    !SAFE_METHODS.has(normalizedMethod) &&
    policy.csrf !== 'required'
  ) {
    throw new Error(`${normalizedMethod} ${path} is an unsafe session route without CSRF.`)
  }
  if (policy.freshSession && policy.authentication !== 'session') {
    throw new Error(`${normalizedMethod} ${path} requires freshness without a session.`)
  }
  if (policy.mfa !== 'none' && !path.startsWith('/api/v1/platform/')) {
    throw new Error(`${normalizedMethod} ${path} declares platform MFA outside platform routes.`)
  }
}
