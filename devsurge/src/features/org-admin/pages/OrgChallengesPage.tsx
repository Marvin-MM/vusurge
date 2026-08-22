import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Trophy,
  Users,
  Edit3,
  Eye,
  Clock,
  Send,
  ShieldCheck,
  RefreshCw,
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import {
  useOrgChallenges,
  usePublishChallenge,
  useRescheduleChallenge,
  useReopenChallenge,
  useCancelChallenge,
} from "@/features/org-admin/api/queries";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";
import { getDisplayStatus, isEffectivelyClosed } from "@/lib/challengeStatus";
import { Challenge } from "@/types";
import { toast } from "sonner";

type LifecycleAction = "PUBLISH" | "EXTEND_DEADLINE" | "REOPEN" | "CANCEL";

export function OrgChallengesPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { items: challenges, isLoading, hasMore, loadMore, isLoadingMore } = useOrgChallenges(orgId);
  const publishMutation = usePublishChallenge(orgId);
  const rescheduleMutation = useRescheduleChallenge(orgId);
  const reopenMutation = useReopenChallenge(orgId);
  const cancelMutation = useCancelChallenge(orgId);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [activeActionModal, setActiveActionModal] = React.useState<{ challenge: Challenge; action: LifecycleAction } | null>(null);
  const [extendedDeadlineDate, setExtendedDeadlineDate] = React.useState("");
  const [lifecycleReason, setLifecycleReason] = React.useState("");

  const filteredChallenges = challenges.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isPending = publishMutation.isPending || rescheduleMutation.isPending || reopenMutation.isPending || cancelMutation.isPending;

  const handleExecuteLifecycleAction = () => {
    if (!activeActionModal) return;
    const { challenge, action } = activeActionModal;
    const onSuccess = (message: string) => {
      toast.success(message);
      setActiveActionModal(null);
      setLifecycleReason("");
      setExtendedDeadlineDate("");
    };
    const onError = (err: any) => toast.error(err?.message || "Failed to execute lifecycle change.");

    if (action === "PUBLISH") {
      publishMutation.mutate({ challengeId: challenge.id }, { onSuccess: () => onSuccess(`"${challenge.title}" is now published.`), onError });
    } else if (action === "EXTEND_DEADLINE") {
      if (!extendedDeadlineDate) {
        toast.error("Please provide a new deadline date.");
        return;
      }
      rescheduleMutation.mutate(
        { challengeId: challenge.id, payload: { submissionDeadline: new Date(extendedDeadlineDate).toISOString(), reason: lifecycleReason } },
        { onSuccess: () => onSuccess(`Deadline extended for "${challenge.title}".`), onError }
      );
    } else if (action === "REOPEN") {
      reopenMutation.mutate({ challengeId: challenge.id }, { onSuccess: () => onSuccess(`"${challenge.title}" reopened.`), onError });
    } else if (action === "CANCEL") {
      cancelMutation.mutate({ challengeId: challenge.id, payload: { reason: lifecycleReason } }, { onSuccess: () => onSuccess(`"${challenge.title}" cancelled.`), onError });
    }
  };

  return (
    <OrgAccessGuard permission="challenge.view" title="Challenge Administration Restricted" description="You require Challenge Manager or Organization Admin privileges to view and manage challenges.">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Challenge Management"
          description="Maintain challenge lifecycle state transitions."
          actions={
            <Button onClick={() => navigate(`/org/${orgId}/challenges/new`)} className="text-xs font-semibold gap-1.5 h-8 shadow-xs">
              <Plus className="h-4 w-4" />
              <span>Create New Challenge</span>
            </Button>
          }
        />

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search challenge titles..." className="pl-8 h-8 text-xs bg-background" />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-48 bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {["ALL", "DRAFT", "SCHEDULED", "OPEN", "JUDGING", "RESULTS_READY", "RESULTS_PUBLISHED", "ARCHIVED", "CANCELLED"].map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">{[1, 2].map((n) => <div key={n} className="h-32 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
          ) : filteredChallenges.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-xs border-border">No challenges match your filters.</Card>
          ) : (
            filteredChallenges.map((c) => {
              const isDraft = c.status === "DRAFT";
              const isLive = c.status === "OPEN" && !isEffectivelyClosed(c);
              const isClosed = isEffectivelyClosed(c) || c.status === "JUDGING" || c.status === "RESULTS_READY";

              return (
                <Card key={c.id} className="p-5 border-border hover:border-primary/40 transition-all shadow-2xs space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <ChallengeStatusBadge status={getDisplayStatus(c)} />
                      <h3 className="text-base font-bold text-foreground truncate">{c.title}</h3>
                      {c.summary && <p className="text-xs text-muted-foreground line-clamp-1">{c.summary}</p>}
                      {c.submissionDeadline && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          Deadline: {new Date(c.submissionDeadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap self-end lg:self-auto">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/org/${orgId}/challenges/${c.id}/edit`)} className="text-xs h-8 gap-1">
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </Button>

                      {isDraft && (
                        <Button
                          size="sm"
                          onClick={() => { setActiveActionModal({ challenge: c, action: "PUBLISH" }); setLifecycleReason(""); }}
                          className="text-xs h-8 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <Send className="h-3 w-3" />
                          <span>Publish</span>
                        </Button>
                      )}

                      {isLive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const base = c.submissionDeadline ? new Date(c.submissionDeadline).getTime() : Date.now();
                            setExtendedDeadlineDate(new Date(base + 86400000 * 3).toISOString().split("T")[0]);
                            setActiveActionModal({ challenge: c, action: "EXTEND_DEADLINE" });
                            setLifecycleReason("");
                          }}
                          className="text-xs h-8 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          <span>Extend Deadline</span>
                        </Button>
                      )}

                      {isClosed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setActiveActionModal({ challenge: c, action: "REOPEN" }); setLifecycleReason(""); }}
                          className="text-xs h-8 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Reopen</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/challenges/${c.id}/submissions`)} className="text-xs h-7 px-2 font-medium text-foreground hover:bg-muted">
                        <FileCheck2 className="h-3.5 w-3.5 mr-1 text-primary" />
                        Submissions
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/challenges/${c.id}/judging`)} className="text-xs h-7 px-2 font-medium text-foreground hover:bg-muted">
                        <Trophy className="h-3.5 w-3.5 mr-1 text-purple-500" />
                        Judging
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/challenges/${c.id}/participants`)} className="text-xs h-7 px-2 font-medium text-foreground hover:bg-muted">
                        <Users className="h-3.5 w-3.5 mr-1 text-blue-500" />
                        Participants
                      </Button>
                    </div>

                    {c.status !== "CANCELLED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setActiveActionModal({ challenge: c, action: "CANCEL" }); setLifecycleReason(""); }}
                        className="text-[11px] h-7 text-destructive hover:bg-destructive/10"
                      >
                        Cancel Challenge
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </div>

        <Dialog open={Boolean(activeActionModal)} onOpenChange={(open) => !open && setActiveActionModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {activeActionModal?.action.replace("_", " ")}
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                Confirm this action for <strong>{activeActionModal?.challenge.title}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              {activeActionModal?.action === "EXTEND_DEADLINE" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">New Submission Deadline</label>
                  <Input type="date" value={extendedDeadlineDate} onChange={(e) => setExtendedDeadlineDate(e.target.value)} className="text-xs h-9" required />
                </div>
              )}

              {(activeActionModal?.action === "EXTEND_DEADLINE" || activeActionModal?.action === "CANCEL") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Reason</label>
                  <Input value={lifecycleReason} onChange={(e) => setLifecycleReason(e.target.value)} placeholder="Reason for this change..." className="text-xs h-9" required />
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveActionModal(null)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleExecuteLifecycleAction} disabled={isPending} className="text-xs font-semibold px-4">
                {isPending ? "Executing..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}
