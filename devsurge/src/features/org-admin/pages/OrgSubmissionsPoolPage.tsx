import * as React from "react";
import { useParams } from "react-router-dom";
import { Search, Filter, Github, ExternalLink, Ban, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useAdminSubmissions, useDisqualifySubmission, useReinstateSubmission, useReopenSubmission, usePromoteSubmissionToInnovation } from "@/features/org-admin/api/queries";
import { useSubmission } from "@/features/submissions/api/queries";
import { SubmissionStatusBadge } from "@/components/shared/StatusBadge";
import { Submission } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { toast } from "sonner";

function SubmissionRow({ summary, onDisqualify, onReinstate, onReopen, onPromote, canPromote }: { summary: Submission; onDisqualify: () => void; onReinstate: () => void; onReopen: () => void; onPromote: () => void; canPromote: boolean }) {
  const { orgId = "", challengeId = "" } = useParams<{ orgId: string; challengeId: string }>();
  const { data: full } = useSubmission(orgId, challengeId, summary.id);
  const v = full?.draftVersion;

  return (
    <Card className="p-4 border-border hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <SubmissionStatusBadge status={summary.status} />
        </div>
        <h3 className="text-sm font-bold text-foreground truncate">{v?.title || "Untitled Submission"}</h3>
        {v?.tagline && <p className="text-xs text-muted-foreground line-clamp-1">{v.tagline}</p>}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-0.5">
          <span>Created {new Date(summary.createdAt).toLocaleDateString()}</span>
          {v?.repositoryUrl && (
            <a href={v.repositoryUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
              <Github className="h-3 w-3" />
              <span>Repo</span>
            </a>
          )}
          {v?.demoUrl && (
            <a href={v.demoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              <span>Demo</span>
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
        {canPromote && summary.status === "FINALIZED" && (
          <Button variant="outline" size="sm" onClick={onPromote} className="text-xs h-8 gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Promote to Innovation</span>
          </Button>
        )}
        {summary.status === "FINALIZED" && (
          <Button variant="outline" size="sm" onClick={onReopen} className="text-xs h-8 gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Reopen
          </Button>
        )}
        {summary.status !== "DISQUALIFIED" ? (
          <Button variant="outline" size="sm" onClick={onDisqualify} className="text-xs h-8 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
            <Ban className="h-3.5 w-3.5" />
            <span>Disqualify</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onReinstate} className="text-xs h-8 gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Reinstate
          </Button>
        )}
      </div>
    </Card>
  );
}

export function OrgSubmissionsPoolPage() {
  const { orgId = "", challengeId = "" } = useParams<{ orgId: string; challengeId: string }>();
  const { userContext } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const { items: submissions, isLoading, hasMore, loadMore, isLoadingMore } = useAdminSubmissions(orgId, challengeId, statusFilter === "ALL" ? undefined : statusFilter);
  const disqualifyMutation = useDisqualifySubmission(orgId, challengeId);
  const reinstateMutation = useReinstateSubmission(orgId, challengeId);
  const reopenMutation = useReopenSubmission(orgId, challengeId);
  const promoteMutation = usePromoteSubmissionToInnovation(orgId, challengeId);
  const canPromote = can(userContext, "innovation.manage");

  const [statusAction, setStatusAction] = React.useState<{ submission: Submission; action: "disqualify" | "reinstate" | "reopen" } | null>(null);
  const [reason, setReason] = React.useState("");
  const [promoteTarget, setPromoteTarget] = React.useState<Submission | null>(null);

  return (
    <OrgAccessGuard permission="submission.view_all" title="Submissions Management Restricted" description="You require Challenge Manager privileges to inspect the submissions pool.">
      <PageContainer className="space-y-6">
        <PageHeader title="Submissions Pool" description="Review project submissions for this challenge." />

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-44 bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="DRAFT" className="text-xs">Draft</SelectItem>
              <SelectItem value="FINALIZED" className="text-xs">Finalized</SelectItem>
              <SelectItem value="DISQUALIFIED" className="text-xs">Disqualified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-24 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
          ) : submissions.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-xs border-border">No submissions found matching the selected filter.</Card>
          ) : (
            submissions.map((sub) => (
              <SubmissionRow
                key={sub.id}
                summary={sub}
                canPromote={canPromote}
                onDisqualify={() => { setStatusAction({ submission: sub, action: "disqualify" }); setReason(""); }}
                onReinstate={() => { setStatusAction({ submission: sub, action: "reinstate" }); setReason(""); }}
                onReopen={() => { setStatusAction({ submission: sub, action: "reopen" }); setReason(""); }}
                onPromote={() => setPromoteTarget(sub)}
              />
            ))
          )}
        </div>
        <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />

        <Dialog open={Boolean(statusAction)} onOpenChange={(open) => !open && setStatusAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">{statusAction ? `${statusAction.action[0].toUpperCase()}${statusAction.action.slice(1)} Submission` : "Update Submission"}</DialogTitle>
              <DialogDescription className="text-xs">Provide a reason of at least 10 characters. It will be recorded in the audit trail.</DialogDescription>
            </DialogHeader>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason..." className="text-xs h-9" required />
            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStatusAction(null)} className="text-xs">Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!statusAction || reason.trim().length < 10 || disqualifyMutation.isPending || reinstateMutation.isPending || reopenMutation.isPending}
                onClick={() => {
                  if (!statusAction) return;
                  const mutation = statusAction.action === "disqualify" ? disqualifyMutation : statusAction.action === "reinstate" ? reinstateMutation : reopenMutation;
                  mutation.mutate(
                    { submissionId: statusAction.submission.id, reason: reason.trim() },
                    {
                      onSuccess: () => { toast.success("Submission status updated."); setStatusAction(null); },
                      onError: (err: any) => toast.error(err?.message || "Failed to update submission."),
                    }
                  );
                }}
                className="text-xs font-semibold px-4"
              >
                {disqualifyMutation.isPending || reinstateMutation.isPending || reopenMutation.isPending ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(promoteTarget)} onOpenChange={(open) => !open && setPromoteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Promote to Innovation Portfolio</DialogTitle>
              <DialogDescription className="text-xs">
                This creates a new innovation portfolio item seeded from this submission's content. You can edit its details afterward.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPromoteTarget(null)} className="text-xs">Cancel</Button>
              <Button
                size="sm"
                disabled={promoteMutation.isPending}
                onClick={() => {
                  if (!promoteTarget) return;
                  promoteMutation.mutate(
                    { submissionId: promoteTarget.id, payload: {} },
                    {
                      onSuccess: () => { toast.success("Submission promoted to the innovation portfolio."); setPromoteTarget(null); },
                      onError: (err: any) => toast.error(err?.message || "Failed to promote submission."),
                    }
                  );
                }}
                className="text-xs font-semibold px-4"
              >
                {promoteMutation.isPending ? "Promoting..." : "Confirm Promote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}
