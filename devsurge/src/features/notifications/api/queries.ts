import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { Notification, NotificationCategory, SupportTicket, SupportTicketComment } from "@/types";

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["me", "notification-preferences"],
    queryFn: () => apiGet<{ disabledCategories: NotificationCategory[] }>("/me/notification-preferences"),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (disabledCategories: NotificationCategory[]) =>
      apiPatch("/me/notification-preferences", { disabledCategories }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "notification-preferences"] });
    },
  });
}

export function useNotifications(unreadOnly?: boolean) {
  return useCursorList<Notification>(["me", "notifications", { unreadOnly }], "/me/notifications", {
    unreadOnly: unreadOnly ? "true" : undefined,
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["me", "notifications", "unread-count"],
    queryFn: () => apiGet<{ count: number }>("/me/notifications/unread-count"),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => apiPost(`/me/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost("/me/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "notifications"] });
    },
  });
}

// --- Support tickets (participant-facing: /support/tickets) -----------------

export function useSupportTickets() {
  return useCursorList<SupportTicket>(["support-tickets"], "/support/tickets");
}

export function useSupportTicket(id: string) {
  return useQuery({
    queryKey: ["support-tickets", id],
    queryFn: () => apiGet<{ ticket: SupportTicket; comments: SupportTicketComment[] }>(`/support/tickets/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      category: SupportTicket["category"];
      subject: string;
      description: string;
      organizationId?: string;
      challengeId?: string;
    }) => apiPost<SupportTicket>("/support/tickets", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}

export function useAddTicketComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) =>
      apiPost<SupportTicketComment>(`/support/tickets/${ticketId}/comments`, { body }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", variables.ticketId] });
    },
  });
}

// --- Support ticket attachments ---------------------------------------------
// A comment is just `{ body: string }` (backend/docs/openapi.json:
// POST /support/tickets/{ticketId}/comments) — there is no `fileId`/attachment
// field anywhere on the comment or ticket schema. So an uploaded private file
// (purpose SUPPORT_ATTACHMENT, resourceId = ticket id — see
// backend/src/modules/files/files.service.ts's RESOURCE_TYPE map) has nothing
// to attach itself to except the comment body it's mentioned in. We embed a
// stable, parseable reference in the markdown body itself (which the backend
// stores and returns verbatim) rather than inventing a client-only side
// channel that wouldn't survive a reload or be visible to the other party.
const ATTACHMENT_MARKER = "attachment:";
const ATTACHMENT_PATTERN = /\[([^\]]+)\]\(attachment:([0-9a-fA-F-]{36})\)/g;

export function formatAttachmentReference(fileId: string, displayName: string): string {
  const label = displayName.replace(/[[\]]/g, "");
  return `[${label}](${ATTACHMENT_MARKER}${fileId})`;
}

export interface ParsedCommentAttachment {
  fileId: string;
  displayName: string;
}

/** Splits a comment body into plain text and any embedded attachment references. */
export function parseCommentAttachments(body: string): { text: string; attachments: ParsedCommentAttachment[] } {
  const attachments: ParsedCommentAttachment[] = [];
  const text = body.replace(ATTACHMENT_PATTERN, (_match, label: string, fileId: string) => {
    attachments.push({ fileId, displayName: label });
    return "";
  }).trim();
  return { text, attachments };
}

export function useCloseSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => apiPost(`/support/tickets/${ticketId}/close`),
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}

export function useReopenSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => apiPost(`/support/tickets/${ticketId}/reopen`),
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}
