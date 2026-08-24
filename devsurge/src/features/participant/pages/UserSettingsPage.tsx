import * as React from "react";
import { AlertTriangle, Flag } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/features/notifications/api/queries";
import { TwoFactorSection } from "@/features/participant/components/TwoFactorSection";
import { useMyReports } from "@/features/moderation/api/queries";
import { NotificationCategory } from "@/types";
import { toast } from "sonner";
import { useAccountDeletionRequest, useCancelAccountDeletion, useRequestAccountDeletion } from "@/features/users/api/queries";
import { authClient } from "@/api/client/authClient";

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
  const { data: deletionRequest, isLoading: deletionLoading } = useAccountDeletionRequest();
  const requestDeletion = useRequestAccountDeletion();
  const cancelDeletion = useCancelAccountDeletion();
  const [deletionDialogOpen, setDeletionDialogOpen] = React.useState(false);
  const [deletionReason, setDeletionReason] = React.useState("");

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

        <Card className="p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Connected Accounts</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Connect your Google or GitHub accounts to sign in without a password.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              type="button"
              className="h-10 text-xs font-semibold flex-1"
              onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/app/settings" })}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect Google
            </Button>
            <Button
              variant="outline"
              type="button"
              className="h-10 text-xs font-semibold flex-1"
              onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/app/settings" })}
            >
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              Connect GitHub
            </Button>
          </div>
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

        <Card className="p-6 space-y-4 border-destructive/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-bold text-foreground">Account deletion</h3>
              <p className="text-[11px] text-muted-foreground">
                Request permanent account deletion. A grace period applies before deletion is processed.
              </p>
            </div>
          </div>
          {deletionLoading ? (
            <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
          ) : deletionRequest ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <p className="text-xs text-foreground">
                Deletion is scheduled for <strong>{new Date(deletionRequest.eligibleAt).toLocaleDateString()}</strong>.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={cancelDeletion.isPending}
                onClick={() => cancelDeletion.mutate(undefined, {
                  onSuccess: () => toast.success("Account deletion request cancelled."),
                  onError: (error: any) => toast.error(error?.message || "Could not cancel the request."),
                })}
              >
                {cancelDeletion.isPending ? "Cancelling..." : "Cancel deletion request"}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setDeletionDialogOpen(true)}>
              Request account deletion
            </Button>
          )}
        </Card>
      </div>

      <Dialog open={deletionDialogOpen} onOpenChange={setDeletionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request account deletion?</DialogTitle>
            <DialogDescription>
              This starts the deletion grace period. You may cancel the request from this page until processing begins.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={deletionReason}
            onChange={(event) => setDeletionReason(event.target.value)}
            maxLength={1000}
            placeholder="Optional reason"
            className="min-h-[90px] text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletionDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={requestDeletion.isPending}
              onClick={() => requestDeletion.mutate(deletionReason.trim() || undefined, {
                onSuccess: () => {
                  setDeletionDialogOpen(false);
                  setDeletionReason("");
                  toast.success("Account deletion requested.");
                },
                onError: (error: any) => toast.error(error?.message || "Could not request account deletion."),
              })}
            >
              {requestDeletion.isPending ? "Requesting..." : "Confirm deletion request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
