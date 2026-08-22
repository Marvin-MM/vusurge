import * as React from "react";
import { ShieldAlert, EyeOff, Eye, Ban, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { ReasonDialog } from "@/components/feedback/ConfirmActionDialog";
import {
  usePlatformReports,
  useDismissReport,
  useHideReportedContent,
  useRestoreReportedContent,
  useSuspendOrganizationFromReport,
} from "@/features/superadmin/api/queries";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  UNDER_REVIEW: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  DISMISSED: "bg-muted text-muted-foreground border-border",
  ACTION_TAKEN: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

type Action = "dismiss" | "hide" | "restore" | "suspend";

export function AdminModerationPage() {
  const { items: reports, isLoading, hasMore, loadMore, isLoadingMore } = usePlatformReports();
  const dismissMutation = useDismissReport();
  const hideMutation = useHideReportedContent();
  const restoreMutation = useRestoreReportedContent();
  const suspendMutation = useSuspendOrganizationFromReport();

  const [dialog, setDialog] = React.useState<{ reportId: string; action: Action } | null>(null);

  const labels: Record<Action, { title: string; confirmLabel: string }> = {
    dismiss: { title: "Dismiss this report?", confirmLabel: "Dismiss" },
    hide: { title: "Hide the reported content?", confirmLabel: "Hide Content" },
    restore: { title: "Restore the hidden content?", confirmLabel: "Restore" },
    suspend: { title: "Suspend the reported organization?", confirmLabel: "Suspend Org" },
  };

  const mutations: Record<Action, typeof dismissMutation> = {
    dismiss: dismissMutation,
    hide: hideMutation,
    restore: restoreMutation,
    suspend: suspendMutation,
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Content Moderation" description="Review reported organizations and challenges." />

      <Card className="border-border">
        <CardContent className="p-0 divide-y divide-border/60">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-xs">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No reports.
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{r.targetType}</Badge>
                    <span className="font-bold text-foreground">{r.category.replace(/_/g, " ")}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[r.status] || ""}`}>{r.status}</Badge>
                </div>
                <p className="text-muted-foreground">{r.description}</p>
                {r.resolutionReason && <p className="text-muted-foreground italic">Resolution: {r.resolutionReason}</p>}
                {r.status === "OPEN" || r.status === "UNDER_REVIEW" ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setDialog({ reportId: r.id, action: "dismiss" })}>
                      <XCircle className="h-3 w-3 mr-1" /> Dismiss
                    </Button>
                    {r.targetType === "CHALLENGE" && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setDialog({ reportId: r.id, action: "hide" })}>
                        <EyeOff className="h-3 w-3 mr-1" /> Hide Content
                      </Button>
                    )}
                    {r.targetOrganizationId && (
                      <Button variant="outline" size="sm" className="text-xs h-7 text-destructive" onClick={() => setDialog({ reportId: r.id, action: "suspend" })}>
                        <Ban className="h-3 w-3 mr-1" /> Suspend Org
                      </Button>
                    )}
                  </div>
                ) : r.status === "ACTION_TAKEN" && r.targetType === "CHALLENGE" ? (
                  <div className="pt-1">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setDialog({ reportId: r.id, action: "restore" })}>
                      <Eye className="h-3 w-3 mr-1" /> Restore Content
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />

      <ReasonDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog ? labels[dialog.action].title : ""}
        description="This is recorded in the audit trail."
        reasonPlaceholder="Reason (minimum 10 characters)..."
        confirmLabel={dialog ? labels[dialog.action].confirmLabel : "Confirm"}
        loading={dialog ? mutations[dialog.action].isPending : false}
        onConfirm={(reason) => {
          if (!dialog) return;
          mutations[dialog.action].mutate(
            { reportId: dialog.reportId, reason },
            {
              onSuccess: () => { toast.success("Done."); setDialog(null); },
              onError: (err: any) => toast.error(err?.message || "Action failed."),
            },
          );
        }}
      />
    </PageContainer>
  );
}
