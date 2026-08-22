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

export function usePlatformSupportTicket(ticketId: string) {
  return useQuery({
    queryKey: ["platform", "support", "tickets", ticketId],
    queryFn: () => apiGet<SupportTicket>(`/platform/support/tickets/${ticketId}`),
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
