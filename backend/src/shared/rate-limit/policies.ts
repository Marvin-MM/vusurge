/**
 * Rate limit policies.
 *
 * Every abuse-sensitive endpoint named in master prompt section 36 has a policy
 * here. Declaring them in one table keeps limits reviewable and stops each
 * route inventing its own numbers.
 *
 * `riskLevel` decides behaviour when Redis is unavailable:
 *   high     fail closed. Losing the cache must never open a brute-force window
 *            on credentials, join codes, or invitation tokens.
 *   standard fail open. Availability matters more than a precise limit on
 *            ordinary reads.
 */

export type RateLimitScope = 'ip' | 'user' | 'organization' | 'ip+user' | 'ip+route'

export interface RateLimitPolicy {
  readonly name: string
  readonly windowSeconds: number
  readonly maxRequests: number
  readonly scope: RateLimitScope
  readonly riskLevel: 'high' | 'standard'
}

function policy(
  name: string,
  maxRequests: number,
  windowSeconds: number,
  scope: RateLimitScope,
  riskLevel: 'high' | 'standard' = 'standard',
): RateLimitPolicy {
  return { name, maxRequests, windowSeconds, scope, riskLevel }
}

export const RateLimitPolicies = {
  // --- Credential and token paths: fail closed -----------------------------
  /** Better Auth has its own protections; this is the outer envelope. */
  AuthAttempt: policy('auth.attempt', 10, 60, 'ip', 'high'),
  PasswordReset: policy('auth.password_reset', 5, 900, 'ip', 'high'),
  EmailVerificationResend: policy('auth.verification_resend', 5, 900, 'ip+user', 'high'),
  /** The single most brute-forceable surface in the product. */
  JoinCodeRedemption: policy('organization.join_code_redeem', 5, 300, 'ip+user', 'high'),
  InvitationAcceptance: policy('organization.invitation_accept', 10, 300, 'ip', 'high'),
  StaffInvitationAcceptance: policy('judging.staff_invitation_accept', 10, 300, 'ip', 'high'),
  TeamInvitationAcceptance: policy('team.invitation_accept', 20, 300, 'ip+user', 'high'),

  // --- Write paths that fan out email or create records --------------------
  InvitationCreation: policy('organization.invitation_create', 50, 3600, 'organization'),
  OrganizationApplication: policy('organization.application_create', 3, 86_400, 'user'),
  JoinRequest: policy('organization.join_request', 10, 3600, 'user'),
  SupportTicketCreation: policy('support.ticket_create', 10, 3600, 'user'),
  ContentReportCreation: policy('moderation.report_create', 20, 3600, 'user'),
  ExportRequest: policy('analytics.export_request', 10, 3600, 'organization'),
  IntegrationTest: policy('integration.test', 10, 600, 'organization'),
  AnnouncementPublish: policy('announcement.publish', 30, 3600, 'organization'),

  // --- Upload authorization ------------------------------------------------
  ImageUploadAuthorization: policy('media.image_upload_auth', 60, 600, 'user'),
  ImageUploadAuthorizationOrganization: policy(
    'media.image_upload_auth_org',
    300,
    600,
    'organization',
  ),
  FileUploadAuthorization: policy('media.file_upload_auth', 30, 600, 'user'),
  FileUploadAuthorizationOrganization: policy(
    'media.file_upload_auth_org',
    150,
    600,
    'organization',
  ),

  // --- Public read surfaces ------------------------------------------------
  PublicSearch: policy('public.search', 60, 60, 'ip'),
  PublicListing: policy('public.listing', 120, 60, 'ip'),

  // --- Authenticated general write envelope --------------------------------
  AuthenticatedWrite: policy('general.authenticated_write', 300, 60, 'user'),
} as const

export type RateLimitPolicyName = keyof typeof RateLimitPolicies
