import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
  PlatformOrganization,
  OrganizationApplication,
  ModerationReport,
  SupportTicket,
  SupportTicketComment,
  AuditEvent,
} from "@/types";

// =============================================================================
// Organizations (platform-wide) & organization applications
// =============================================================================

export function usePlatformOrganizations(status?: string) {
  return useCursorList<PlatformOrganization>(["platform", "organizations", { status }], "/platform/organizations", status ? { status } : undefined);
}

export function usePlatformOrganization(organizationId: string) {
  return useQuery({
    queryKey: ["platform", "organizations", organizationId],
    queryFn: () => apiGet<PlatformOrganization>(`/platform/organizations/${organizationId}`),
    enabled: Boolean(organizationId),
  });
}

/**
 * Per-organization audit activity rollup — `GET
 * /platform/organizations/:id/audit-summary`. The only aggregate the platform
 * API exposes anywhere (cursor pagination deliberately returns no totals), so
 * it is the one place a superadmin can see volume rather than a page of rows.
 */
export interface PlatformAuditSummary {
  totalEvents: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  topActions: { action: string; count: number }[];
}

export function usePlatformOrganizationAuditSummary(
  organizationId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["platform", "organizations", organizationId, "audit-summary"],
    queryFn: () =>
      apiGet<PlatformAuditSummary>(`/platform/organizations/${organizationId}/audit-summary`),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useSuspendOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, reason }: { organizationId: string; reason: string }) =>
      apiPost<PlatformOrganization>(`/platform/organizations/${organizationId}/suspend`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] }),
  });
}

export function useReinstateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, reason }: { organizationId: string; reason: string }) =>
      apiPost<PlatformOrganization>(`/platform/organizations/${organizationId}/reinstate`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] }),
  });
}

export function useArchiveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, reason }: { organizationId: string; reason: string }) =>
      apiPost<PlatformOrganization>(`/platform/organizations/${organizationId}/archive`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] }),
  });
}

export function useOrganizationApplicationsForReview(status?: string, options?: { enabled?: boolean }) {
  return useCursorList<OrganizationApplication>(
    ["platform", "organization-applications", { status }],
    "/platform/organization-applications",
    status ? { status } : undefined,
    options,
  );
}

export function useOrganizationApplicationForReview(applicationId: string) {
  return useQuery({
    queryKey: ["platform", "organization-applications", applicationId],
    queryFn: () => apiGet<OrganizationApplication>(`/platform/organization-applications/${applicationId}`),
    enabled: Boolean(applicationId),
  });
}

export function useApproveOrganizationApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, notes }: { applicationId: string; notes?: string }) =>
      apiPost<{ organizationId: string; organizationSlug: string }>(
        `/platform/organization-applications/${applicationId}/approve`,
        { notes },
        { headers: { "idempotency-key": newIdempotencyKey() } },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "organization-applications"] }),
  });
}

export function useRejectOrganizationApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, reason, internalNotes }: { applicationId: string; reason: string; internalNotes?: string }) =>
      apiPost<OrganizationApplication>(`/platform/organization-applications/${applicationId}/reject`, { reason, internalNotes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "organization-applications"] }),
  });
}

// =============================================================================
// Moderation (content reports)
// =============================================================================

export function usePlatformReports(status?: string) {
  return useCursorList<ModerationReport>(["platform", "reports", { status }], "/platform/reports", status ? { status } : undefined);
}

export function useDismissReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      apiPost<ModerationReport>(`/platform/reports/${reportId}/dismiss`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "reports"] }),
  });
}

export function useHideReportedContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      apiPost<ModerationReport>(`/platform/reports/${reportId}/hide-content`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "reports"] }),
  });
}

export function useRestoreReportedContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      apiPost<ModerationReport>(`/platform/reports/${reportId}/restore-content`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "reports"] }),
  });
}

export function useSuspendOrganizationFromReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      apiPost<ModerationReport>(`/platform/reports/${reportId}/suspend-organization`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
  });
}

// =============================================================================
// Support tickets (platform triage)
// =============================================================================

export function usePlatformSupportTickets(filters?: { status?: string; priority?: string; assignedToUserId?: string }) {
  return useCursorList<SupportTicket>(["platform", "support", "tickets", filters], "/platform/support/tickets", filters);
}

/**
 * The detail endpoint returns a wrapper — the ticket plus its user-visible
 * comment thread and its staff-only internal notes — not a bare ticket. Typing
 * it as a flat SupportTicket left every field undefined, which crashed the
 * detail page on the first property access.
 */
export interface PlatformSupportTicketDetail {
  ticket: SupportTicket;
  comments: SupportTicketComment[];
  internalNotes: SupportTicketComment[];
}

export function usePlatformSupportTicket(ticketId: string) {
  return useQuery({
    queryKey: ["platform", "support", "tickets", ticketId],
    queryFn: () =>
      apiGet<PlatformSupportTicketDetail>(`/platform/support/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
  });
}

function invalidateTicket(queryClient: ReturnType<typeof useQueryClient>, ticketId: string) {
  queryClient.invalidateQueries({ queryKey: ["platform", "support", "tickets"] });
  queryClient.invalidateQueries({ queryKey: ["platform", "support", "tickets", ticketId] });
}

export function useAssignSupportTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignedToUserId: string | null) =>
      apiPost<SupportTicket>(`/platform/support/tickets/${ticketId}/assign`, { assignedToUserId }),
    onSuccess: () => invalidateTicket(queryClient, ticketId),
  });
}

export function useChangeTicketStatus(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: SupportTicket["status"]) =>
      apiPost<SupportTicket>(`/platform/support/tickets/${ticketId}/change-status`, { status }),
    onSuccess: () => invalidateTicket(queryClient, ticketId),
  });
}

export function useSetTicketPriority(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (priority: SupportTicket["priority"]) =>
      apiPost<SupportTicket>(`/platform/support/tickets/${ticketId}/set-priority`, { priority }),
    onSuccess: () => invalidateTicket(queryClient, ticketId),
  });
}

export function useResolveTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resolutionSummary: string) =>
      apiPost<SupportTicket>(`/platform/support/tickets/${ticketId}/resolve`, { resolutionSummary }),
    onSuccess: () => invalidateTicket(queryClient, ticketId),
  });
}

export function useAddTicketComment(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiPost<SupportTicketComment>(`/platform/support/tickets/${ticketId}/comments`, { body }),
    onSuccess: () => invalidateTicket(queryClient, ticketId),
  });
}

export function useAddTicketInternalNote(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiPost<SupportTicketComment>(`/platform/support/tickets/${ticketId}/internal-notes`, { body }),
    onSuccess: () => invalidateTicket(queryClient, ticketId),
  });
}

// =============================================================================
// Platform-wide audit log
// =============================================================================

export function usePlatformAudit(organizationId?: string, options?: { enabled?: boolean }) {
  return useCursorList<AuditEvent>(["platform", "audit", { organizationId }], "/platform/audit", organizationId ? { organizationId } : undefined, options);
}

// =============================================================================
// Platform users, challenges, analytics, and deployment settings
// =============================================================================

export type PlatformRole = "PLATFORM_SUPERADMIN" | "PLATFORM_SUPPORT_AGENT";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  deletedAt: string | null;
  createdAt: string;
  platformRoles: { id: string; role: PlatformRole; grantedAt: string }[];
}

export function usePlatformUsers(filters?: { search?: string; role?: PlatformRole }) {
  return useCursorList<PlatformUser>(["platform", "users", filters], "/platform/users", filters);
}

export function useGrantPlatformRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role, reason }: { userId: string; role: PlatformRole; reason: string }) =>
      apiPost<PlatformUser>(`/platform/users/${userId}/roles/grant`, { role, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "users"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "analytics"] });
    },
  });
}

export function useRevokePlatformRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role, reason }: { userId: string; role: PlatformRole; reason: string }) =>
      apiPost<PlatformUser>(`/platform/users/${userId}/roles/revoke`, { role, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "users"] }),
  });
}

export interface PlatformChallenge {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  title: string;
  slug: string;
  status: string;
  visibility: "ORG_MEMBERS" | "PUBLIC" | "UNLISTED";
  moderationHiddenAt: string | null;
  createdAt: string;
}

export function usePlatformChallenges(filters?: { search?: string; status?: string; visibility?: string }) {
  return useCursorList<PlatformChallenge>(
    ["platform", "challenges", filters],
    "/platform/challenges",
    filters,
  );
}

export interface PlatformAnalyticsSummary {
  users: number;
  verifiedUsers: number;
  usersWithTwoFactor: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  challenges: number;
  publicChallenges: number;
  activeParticipations: number;
  finalizedSubmissions: number;
  openReports: number;
  openSupportTickets: number;
  generatedAt: string;
}

export function usePlatformAnalyticsSummary() {
  return useQuery({
    queryKey: ["platform", "analytics", "summary"],
    queryFn: () => apiGet<PlatformAnalyticsSummary>("/platform/analytics/summary"),
    staleTime: 60_000,
  });
}

export interface PlatformSettings {
  environment: string;
  serviceVersion: string;
  featureFlags: Record<string, boolean>;
  security: {
    sessionExpiresInSeconds: number;
    freshSessionMaxAgeSeconds: number;
    rateLimitingEnabled: boolean;
    failClosedOnHighRisk: boolean;
    accountDeletionGraceDays: number;
  };
  limits: {
    maxRequestBodyBytes: number;
    maxImageBytes: number;
    maxDocumentBytes: number;
    maxSubmissionScreenshots: number;
  };
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform", "settings"],
    queryFn: () => apiGet<PlatformSettings>("/platform/settings"),
    staleTime: 5 * 60_000,
  });
}

// =============================================================================
// Infrastructure health — `/health/*` lives outside `/api/v1` (unauthenticated
// ops endpoints), so this bypasses the credentialed axios client and fetches
// directly against the API's root origin.
// =============================================================================

export interface HealthDependency {
  name: string;
  status: "ok" | "degraded" | "down";
  required: boolean;
  latencyMs?: number;
}

export interface HealthReadyResponse {
  status: "ready" | "not_ready";
  service: string;
  version: string;
  dependencies: HealthDependency[];
}

function apiRootOrigin(): string {
  const metaEnv = (import.meta as any).env || {};
  const apiBase: string = metaEnv.VITE_API_BASE_URL || "";
  return apiBase.replace(/\/api\/v1\/?$/, "");
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: ["platform", "health"],
    queryFn: async (): Promise<HealthReadyResponse> => {
      const res = await fetch(`${apiRootOrigin()}/health/ready`);
      if (!res.ok) throw new Error(`Health check failed (${res.status})`);
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
