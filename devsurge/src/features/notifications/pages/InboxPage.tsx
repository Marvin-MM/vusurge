import * as React from "react";
import { Bell, Check, CheckCheck, UserPlus, Trophy, Megaphone, HelpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/features/notifications/api/queries";
import { NotificationDetailDialog } from "@/features/notifications/components/NotificationDetailDialog";
import { NotificationCategory, Notification } from "@/types";
import { toast } from "sonner";

const CATEGORY_ICON: Partial<Record<NotificationCategory, React.ElementType>> = {
  TEAM_INVITATION: UserPlus,
  PARTICIPATION_DECISION: Trophy,
  ANNOUNCEMENT: Megaphone,
  SUPPORT_TICKET_UPDATE: HelpCircle,
};

export function InboxPage() {
  const { items: notifications, isLoading, hasMore, loadMore, isLoadingMore } = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const [openNotification, setOpenNotification] = React.useState<Notification | null>(null);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => toast.success("All notifications marked as read."),
    });
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Team invitations, participation decisions, announcements, and support updates."
        actions={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="text-xs font-semibold gap-1.5">
              <CheckCheck className="h-4 w-4 text-primary" />
              <span>Mark All as Read</span>
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-xl bg-muted/40 border border-border animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl space-y-2">
          <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto" />
          <p className="font-semibold text-foreground">No notifications yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map((notif) => {
              const Icon = CATEGORY_ICON[notif.category] || Bell;
              const isUnread = !notif.readAt;
              return (
                <Card
                  key={notif.id}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isUnread ? "bg-primary/5 border-primary/30" : "bg-card border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenNotification(notif)}
                    className="space-y-2 min-w-0 text-left cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground">{notif.title}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(notif.createdAt).toLocaleDateString()}</span>
                      {isUnread && (
                        <Badge variant="default" className="text-[9px] px-1.5 py-0 font-bold bg-primary text-primary-foreground">NEW</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{notif.body}</p>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {isUnread && (
                      <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(notif.id)} className="text-xs h-8 gap-1">
                        <Check className="h-3 w-3" />
                        <span>Mark Read</span>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setOpenNotification(notif)} className="text-xs h-8 gap-1">
                      <span>Open</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </>
      )}

      <NotificationDetailDialog
        notification={openNotification}
        open={openNotification !== null}
        onOpenChange={(next) => {
          if (!next) setOpenNotification(null);
        }}
      />
    </PageContainer>
  );
}
