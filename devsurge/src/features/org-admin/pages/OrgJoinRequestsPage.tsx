import * as React from "react";
import { useParams } from "react-router-dom";
import { UserCheck, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useOrgJoinRequests, useApproveJoinRequest, useRejectJoinRequest } from "@/features/org-admin/api/queries";
import { useUserProfile } from "@/features/users/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { toast } from "sonner";
import { JoinRequest } from "@/types";

function RequestRow({ request, onApprove, onReject }: { request: JoinRequest; onApprove: () => void; onReject: () => void }) {
  const { data: profile } = useUserProfile(request.userId);
  const isPending = request.status === "PENDING";

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{profile?.displayName || "Applicant"}</span>
          <Badge variant={isPending ? "secondary" : "outline"} className="text-[10px] font-mono">
            {request.status}
          </Badge>
        </div>
        {request.message && <p className="text-[11px] text-muted-foreground">{request.message}</p>}
        <div className="text-[11px] text-muted-foreground">Requested {new Date(request.createdAt).toLocaleDateString()}</div>
      </div>
      {isPending && (
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={onApprove} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
            <Check className="h-3.5 w-3.5" />
            <span>Approve</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onReject} className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
            <X className="h-3.5 w-3.5" />
            <span>Reject</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function OrgJoinRequestsPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { userContext } = useAuth();
  const { items: requests, isLoading, hasMore, loadMore, isLoadingMore } = useOrgJoinRequests(orgId, {
    enabled: can(userContext, "organization.review_join_requests"),
  });
  const approveMutation = useApproveJoinRequest(orgId);
  const rejectMutation = useRejectJoinRequest(orgId);

  const [rejectTarget, setRejectTarget] = React.useState<JoinRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <OrgAccessGuard permission="organization.review_join_requests" title="Join Requests Restricted" description="You require Organization Admin privileges to review join requests.">
      <PageContainer className="space-y-6">
        <PageHeader title="Join Requests" description="Review requests from people asking to join your organization." />

        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              {pendingCount} Pending Request{pendingCount === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">
                <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No join requests yet.
              </div>
            ) : (
              requests.map((r) => (
                <RequestRow
                  key={r.id}
                  request={r}
                  onApprove={() =>
                    approveMutation.mutate(r.id, {
                      onSuccess: () => toast.success("Join request approved."),
                      onError: (err: any) => toast.error(err?.message || "Failed to approve."),
                    })
                  }
                  onReject={() => {
                    setRejectTarget(r);
                    setRejectReason("");
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
              <DialogTitle className="text-base font-bold">Reject Join Request</DialogTitle>
              <DialogDescription className="text-xs">Optionally provide a reason for the applicant.</DialogDescription>
            </DialogHeader>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (optional)" className="text-xs h-9" />
            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectTarget(null)} className="text-xs">Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={rejectMutation.isPending}
                onClick={() => {
                  if (!rejectTarget) return;
                  rejectMutation.mutate(
                    { requestId: rejectTarget.id, reason: rejectReason || undefined },
                    {
                      onSuccess: () => { toast.success("Join request rejected."); setRejectTarget(null); },
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
