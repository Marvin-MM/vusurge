import * as React from "react";
import { useParams } from "react-router-dom";
import { Search, Filter, CheckCircle2, XCircle, Clock, Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useAdminParticipants, useApproveParticipant, useRejectParticipant } from "@/features/org-admin/api/queries";
import { useUserProfile } from "@/features/users/api/queries";
import { toast } from "sonner";

function ParticipantRow({
  participant,
  onApprove,
  onReject,
}: {
  participant: { id: string; userId: string; status: string; appliedAt: string };
  onApprove: () => void;
  onReject: () => void;
}) {
  const { data: profile } = useUserProfile(participant.userId);
  const isPending = participant.status === "PENDING";

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-foreground truncate">{profile?.displayName || "Participant"}</span>
          <Badge
            variant="secondary"
            className={`text-[10px] font-mono ${
              participant.status === "APPROVED"
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : participant.status === "PENDING"
                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}
          >
            {participant.status}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground">Applied {new Date(participant.appliedAt).toLocaleDateString()}</div>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button size="sm" onClick={onApprove} className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1">
            <Check className="h-3 w-3" />
            <span>Approve</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onReject} className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
            <X className="h-3 w-3" />
            <span>Reject</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function OrgParticipantsPage() {
  const { orgId = "", challengeId = "" } = useParams<{ orgId: string; challengeId: string }>();
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const { items: participants, isLoading, hasMore, loadMore, isLoadingMore } = useAdminParticipants(orgId, challengeId, statusFilter === "ALL" ? undefined : statusFilter);
  const approveMutation = useApproveParticipant(orgId, challengeId);
  const rejectMutation = useRejectParticipant(orgId, challengeId);

  const [rejectTarget, setRejectTarget] = React.useState<{ id: string } | null>(null);
  const [reason, setReason] = React.useState("");

  const pendingCount = participants.filter((p) => p.status === "PENDING").length;
  const approvedCount = participants.filter((p) => p.status === "APPROVED").length;
  const rejectedCount = participants.filter((p) => p.status === "REJECTED").length;

  return (
    <OrgAccessGuard permission="challenge.manage_participants" title="Participant Screening Restricted" description="You require Challenge Manager or Organization Admin privileges to screen participants.">
      <PageContainer className="space-y-6">
        <PageHeader title="Participant Screening" description="Review and approve participant registrations for this challenge." />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Pending</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">{pendingCount}</div>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Approved</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">{approvedCount}</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Rejected</span>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">{rejectedCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-44 bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="PENDING" className="text-xs">Pending</SelectItem>
              <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
              <SelectItem value="REJECTED" className="text-xs">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border/60">
            <CardTitle className="text-sm font-bold">Participant Roster</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
            ) : participants.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">No participants match the selected filter.</div>
            ) : (
              participants.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  onApprove={() =>
                    approveMutation.mutate(
                      { participationId: p.id },
                      { onSuccess: () => toast.success("Participant approved."), onError: (err: any) => toast.error(err?.message || "Failed to approve.") }
                    )
                  }
                  onReject={() => {
                    setRejectTarget(p);
                    setReason("");
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>
        <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />

        <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Reject Participant
              </DialogTitle>
              <DialogDescription className="text-xs">Provide a reason for rejecting this application.</DialogDescription>
            </DialogHeader>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason..." className="text-xs h-9" required />
            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectTarget(null)} className="text-xs">Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={rejectMutation.isPending}
                onClick={() => {
                  if (!rejectTarget) return;
                  rejectMutation.mutate(
                    { participationId: rejectTarget.id, reason },
                    {
                      onSuccess: () => { toast.success("Participant rejected."); setRejectTarget(null); },
                      onError: (err: any) => toast.error(err?.message || "Failed to reject."),
                    }
                  );
                }}
                className="text-xs font-semibold px-4"
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}
