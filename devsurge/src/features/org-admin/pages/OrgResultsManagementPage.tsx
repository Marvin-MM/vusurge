import * as React from "react";
import { useParams } from "react-router-dom";
import { Trophy, Medal, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useAdminSubmissions, useAdminResults, useFinalizeResults, usePublishResults, useRetractResults } from "@/features/org-admin/api/queries";
import { useSubmission } from "@/features/submissions/api/queries";
import { toast } from "sonner";
import { useOrgChallenge } from "@/features/challenges/api/queries";

function SubmissionTitle({ organizationId, challengeId, submissionId }: { organizationId: string; challengeId: string; submissionId: string }) {
  const { data } = useSubmission(organizationId, challengeId, submissionId);
  return <>{data?.draftVersion?.title || submissionId.slice(0, 8)}</>;
}

export function OrgResultsManagementPage() {
  const { orgId = "", challengeId = "" } = useParams<{ orgId: string; challengeId: string }>();
  const { items: submissions } = useAdminSubmissions(orgId, challengeId, "FINALIZED");
  const { data: challenge } = useOrgChallenge(orgId, challengeId);
  const { data: results = [] } = useAdminResults(orgId, challengeId);
  const finalizeMutation = useFinalizeResults(orgId, challengeId);
  const publishMutation = usePublishResults(orgId, challengeId);
  const retractMutation = useRetractResults(orgId, challengeId);

  const [ranks, setRanks] = React.useState<Record<string, string>>({});
  const [publishModalOpen, setPublishModalOpen] = React.useState(false);
  const [retractModalOpen, setRetractModalOpen] = React.useState(false);
  const [retractionReason, setRetractionReason] = React.useState("");

  const hasResults = results.length > 0;

  const handleFinalize = () => {
    const selections = Object.entries(ranks)
      .filter(([, rank]) => rank)
      .map(([submissionId, rank]) => ({ submissionId, selectionType: "WINNER", rank: Number(rank), rankLabel: `Rank #${rank}` }));

    if (selections.length === 0) {
      toast.error("Assign at least one rank before finalizing.");
      return;
    }

    finalizeMutation.mutate(selections, {
      onSuccess: () => toast.success("Results finalized."),
      onError: (err: any) => toast.error(err?.message || "Failed to finalize results."),
    });
  };

  const handlePublish = () => {
    publishMutation.mutate(undefined, {
      onSuccess: () => { toast.success("Results published."); setPublishModalOpen(false); },
      onError: (err: any) => toast.error(err?.message || "Failed to publish results."),
    });
  };

  return (
    <OrgAccessGuard permission="challenge.publish_results" title="Results Publication Restricted" description="You require Challenge Manager privileges to finalize and publish results.">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Results & Winners"
          description="Assign final rankings from finalized submissions, then publish."
          actions={
            hasResults && (
              <div className="flex gap-2">
                {challenge?.status === "RESULTS_PUBLISHED" && (
                  <Button size="sm" variant="outline" onClick={() => setRetractModalOpen(true)} className="text-xs gap-1.5 h-8">
                    <RotateCcw className="h-3.5 w-3.5" /> Retract
                  </Button>
                )}
                {challenge?.status !== "RESULTS_PUBLISHED" && (
                  <Button size="sm" onClick={() => setPublishModalOpen(true)} className="text-xs font-semibold gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Publish Results</span>
                  </Button>
                )}
              </div>
            )
          }
        />

        {hasResults ? (
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold">Finalized Rankings</CardTitle>
              <CardDescription className="text-xs">Already finalized for this challenge.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {[...results].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <Medal className="h-4 w-4 text-amber-500" />
                    <span className="font-bold text-foreground">
                      <SubmissionTitle organizationId={orgId} challengeId={challengeId} submissionId={r.submissionId} />
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{r.rankLabel || `Rank #${r.rank}`}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold">Assign Rankings</CardTitle>
              <CardDescription className="text-xs">Finalized submissions eligible for ranking.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {submissions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-xs">No finalized submissions yet.</div>
              ) : (
                submissions.map((sub) => (
                  <div key={sub.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <span className="font-bold text-foreground">
                      <SubmissionTitle organizationId={orgId} challengeId={challengeId} submissionId={sub.id} />
                    </span>
                    <Input
                      type="number"
                      placeholder="Rank"
                      value={ranks[sub.id] || ""}
                      onChange={(e) => setRanks({ ...ranks, [sub.id]: e.target.value })}
                      className="text-xs h-8 w-20"
                    />
                  </div>
                ))
              )}
            </CardContent>
            {submissions.length > 0 && (
              <div className="p-4 border-t border-border/60 flex justify-end">
                <Button size="sm" onClick={handleFinalize} disabled={finalizeMutation.isPending} className="text-xs font-semibold gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  <span>{finalizeMutation.isPending ? "Finalizing..." : "Finalize Results"}</span>
                </Button>
              </div>
            )}
          </Card>
        )}

        <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-emerald-500" />
                Publish Results
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                This makes rankings publicly visible and notifies participants. This cannot be easily undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPublishModalOpen(false)} className="text-xs">Cancel</Button>
              <Button size="sm" onClick={handlePublish} disabled={publishMutation.isPending} className="text-xs font-semibold px-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                {publishMutation.isPending ? "Publishing..." : "Confirm & Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={retractModalOpen} onOpenChange={setRetractModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Retract Published Results</DialogTitle>
              <DialogDescription className="text-xs">
                This removes the public result snapshot. Enter an audit reason of at least 10 characters.
              </DialogDescription>
            </DialogHeader>
            <Input value={retractionReason} onChange={(event) => setRetractionReason(event.target.value)} maxLength={1000} placeholder="Reason for retraction" />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRetractModalOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={retractionReason.trim().length < 10 || retractMutation.isPending}
                onClick={() => retractMutation.mutate(retractionReason.trim(), {
                  onSuccess: () => {
                    setRetractModalOpen(false);
                    setRetractionReason("");
                    toast.success("Published results retracted.");
                  },
                  onError: (error: any) => toast.error(error?.message || "Failed to retract results."),
                })}
              >
                {retractMutation.isPending ? "Retracting..." : "Confirm retraction"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}
