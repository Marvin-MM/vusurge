import * as React from "react";
import { Flag } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/features/notifications/api/queries";
import { TwoFactorSection } from "@/features/participant/components/TwoFactorSection";
import { useMyReports } from "@/features/moderation/api/queries";
import { NotificationCategory } from "@/types";
import { toast } from "sonner";

const REPORT_STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  UNDER_REVIEW: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  DISMISSED: "bg-muted text-muted-foreground border-border",
  ACTION_TAKEN: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const TOGGLES: { category: NotificationCategory; label: string; description: string }[] = [
  { category: "DEADLINE_REMINDER", label: "Challenge Deadline Reminders", description: "Reminders as submission deadlines approach." },
  { category: "TEAM_INVITATION", label: "Team Invitations", description: "When a team captain invites you to join." },
  { category: "PARTICIPATION_DECISION", label: "Registration Decisions", description: "When your challenge registration is approved or rejected." },
  { category: "FEEDBACK_RELEASED", label: "Judge Feedback Released", description: "When judges' feedback on your submission is published." },
  { category: "RESULTS_PUBLISHED", label: "Results Published", description: "When a challenge you're in publishes results." },
  { category: "ANNOUNCEMENT", label: "Organizer Announcements", description: "Announcements posted for challenges you're registered for." },
];

export function UserSettingsPage() {
  const { data, isLoading } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const disabled = new Set(data?.disabledCategories || []);
  const { items: myReports, isLoading: reportsLoading, hasMore, loadMore, isLoadingMore } = useMyReports();

  const handleToggle = (category: NotificationCategory, enabled: boolean) => {
    const next = new Set(disabled);
    if (enabled) next.delete(category);
    else next.add(category);
    updateMutation.mutate(Array.from(next), {
      onError: (err: any) => toast.error(err?.message || "Failed to update preferences."),
    });
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Account Preferences" description="Configure which notifications you receive." />

      <div className="max-w-2xl space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-foreground">Notification Preferences</h3>

          {isLoading ? (
            <div className="space-y-3">
              {TOGGLES.map((t) => <div key={t.category} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {TOGGLES.map((t) => (
                <div key={t.category} className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-foreground">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground">{t.description}</div>
                  </div>
                  <Switch checked={!disabled.has(t.category)} onCheckedChange={(v) => handleToggle(t.category, v)} disabled={updateMutation.isPending} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <TwoFactorSection />

        <Card className="p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">My Reports</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Content reports you've filed against organizations or challenges, and their review status.
            </p>
          </div>

          {reportsLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : myReports.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-xl">
              <Flag className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">
                You haven't filed any content reports. You can report a challenge or organization from its page.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 -mx-6 px-6">
              {myReports.map((r) => (
                <div key={r.id} className="py-3 space-y-1.5 text-xs first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{r.targetType}</Badge>
                      <span className="font-bold text-foreground">{r.category.replace(/_/g, " ")}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${REPORT_STATUS_STYLE[r.status] || ""}`}>
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{r.description}</p>
                  {r.resolutionReason && (
                    <p className="text-muted-foreground italic">Resolution: {r.resolutionReason}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Filed {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </Card>
      </div>
    </PageContainer>
  );
}
