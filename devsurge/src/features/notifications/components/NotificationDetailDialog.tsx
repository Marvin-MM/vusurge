import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { useMarkNotificationRead } from "@/features/notifications/api/queries";
import { resolveNotificationRoute } from "@/features/notifications/lib/notificationLink";
import { Notification } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  TEAM_INVITATION: "Team Invitation",
  PARTICIPATION_DECISION: "Participation Decision",
  ANNOUNCEMENT: "Announcement",
  SUPPORT_TICKET_UPDATE: "Support Update",
  SUBMISSION_FINALIZED: "Submission",
  DEADLINE_REMINDER: "Deadline Reminder",
};

/**
 * Reading a notification is a small, self-contained act — it does not warrant
 * its own route, and the backend's `linkUrl` is an API path that no client
 * route matches anyway (see `resolveNotificationRoute`). Opening in place
 * keeps the reader's position in the list and lets "unread" clear as a side
 * effect of actually reading, rather than of navigating away.
 */
export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
}: {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { userContext } = useAuth();
  const markReadMutation = useMarkNotificationRead();

  // Opening a notification is what "reading" it means — clear the unread flag
  // once, on open, rather than requiring a separate explicit click.
  React.useEffect(() => {
    if (open && notification && !notification.readAt) {
      markReadMutation.mutate(notification.id);
    }
    // Intentionally keyed on identity + open only: re-running when the
    // mutation object changes identity would fire duplicate requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notification?.id]);

  if (!notification) return null;

  const route = resolveNotificationRoute(notification.linkUrl);
  // A notification can outlive the role that made it actionable, and some of
  // its destinations live in the organization portal. Offer navigation only
  // when the reader can actually get in — otherwise the button is a link to a
  // "Restricted" screen.
  const canFollowRoute =
    route !== null && (route.permission === undefined || can(userContext, route.permission));
  const categoryLabel =
    CATEGORY_LABEL[notification.category] ?? notification.category.replace(/_/g, " ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
            <Badge variant="outline" className="text-[10px] font-semibold">
              {categoryLabel}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {new Date(notification.createdAt).toLocaleString()}
            </span>
          </div>
          <DialogTitle className="text-base font-bold leading-snug">
            {notification.title}
          </DialogTitle>
          {notification.body && (
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line pt-1">
              {notification.body}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
          {route && canFollowRoute && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(route.path);
              }}
              className="text-xs font-semibold gap-1.5"
            >
              <span>Go to Related Item</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>

        {notification.readAt === null && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
            <Check className="h-3 w-3" />
            <span>Marked as read</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
