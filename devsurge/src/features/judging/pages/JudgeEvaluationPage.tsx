import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, ShieldAlert, LogOut, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ConfirmActionDialog,
} from "@/components/feedback/ConfirmActionDialog";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  useJudgeAssignment,
  useJudgedSubmission,
  useAssignmentScorecard,
  useScorecardRubricVersion,
  useSaveScorecardDraft,
  useSubmitScorecard,
  useDeclareConflict,
  useRecuseAssignment,
} from "@/features/judging/api/queries";
import { ScorecardCriterionScore } from "@/types";
import { toast } from "sonner";

export function JudgeEvaluationPage() {
  const { assignmentId = "" } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const { data: assignment, isLoading: loadingAssignment } = useJudgeAssignment(assignmentId);
  const { data: scorecard, isLoading: loadingScorecard } = useAssignmentScorecard(assignmentId);
  const { data: submission } = useJudgedSubmission(
    assignment?.organizationId ?? "",
    assignment?.challengeId ?? "",
    assignment?.submissionId ?? "",
  );
  const { data: rubricVersion } = useScorecardRubricVersion(
    assignment?.organizationId ?? "",
    assignment?.challengeId ?? "",
    scorecard?.rubricVersionId,
  );

  const saveDraftMutation = useSaveScorecardDraft(assignmentId);
  const submitMutation = useSubmitScorecard(assignmentId);
  const declareConflictMutation = useDeclareConflict();
  const recuseMutation = useRecuseAssignment();

  const [scores, setScores] = React.useState<Record<string, { score: string; comment: string }>>({});
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
  const [confirmConflict, setConfirmConflict] = React.useState(false);
  const [confirmRecuse, setConfirmRecuse] = React.useState(false);

  React.useEffect(() => {
    if (!scorecard) return;
    const next: Record<string, { score: string; comment: string }> = {};
    for (const cs of scorecard.criterionScores) {
      next[cs.criterionKey] = { score: String(cs.score ?? ""), comment: cs.comment ?? "" };
    }
    setScores(next);
  }, [scorecard]);

  const version = submission?.draftVersion;
  const draftVersion = submission?.draftVersion ?? null;
  const isLocked = scorecard?.status === "LOCKED" || scorecard?.status === "SUBMITTED";
  const isRecusedOrReassigned = assignment && assignment.status !== "ASSIGNED";

  const buildPayload = (): ScorecardCriterionScore[] => {
    const criteria = rubricVersion?.criteria ?? [];
    return criteria.map((c) => ({
      criterionKey: c.key,
      score: Number(scores[c.key]?.score ?? c.minScore),
      comment: scores[c.key]?.comment || undefined,
    }));
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate(buildPayload(), {
      onSuccess: () => toast.success("Draft saved."),
      onError: (err: any) => toast.error(err?.message || "Failed to save draft."),
    });
  };

  const handleSubmit = () => {
    submitMutation.mutate(buildPayload(), {
      onSuccess: () => {
        toast.success("Scorecard submitted.");
        setConfirmSubmit(false);
        navigate("/judge");
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to submit scorecard.");
        setConfirmSubmit(false);
      },
    });
  };

  if (loadingAssignment || loadingScorecard) {
    return (
      <PageContainer>
        <div className="py-20 text-center text-xs text-muted-foreground">Loading...</div>
      </PageContainer>
    );
  }

  if (!assignment || !scorecard) {
    return (
      <PageContainer>
        <div className="py-20 text-center text-xs text-muted-foreground">Assignment not found.</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/judge")} className="text-xs h-8 gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Assignments</span>
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-foreground">{version?.title || "Submission"}</h1>
          {version?.tagline && <p className="text-sm text-muted-foreground mt-1">{version.tagline}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{scorecard.status}</Badge>
          {assignment.status === "ASSIGNED" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmConflict(true)} className="text-xs h-8 gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Declare Conflict</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmRecuse(true)} className="text-xs h-8 gap-1.5 text-destructive hover:text-destructive">
                <LogOut className="h-3.5 w-3.5" />
                <span>Recuse</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {isRecusedOrReassigned && (
        <Card className="p-4 border-destructive/30 bg-destructive/5 text-xs text-destructive">
          This assignment is {assignment.status.toLowerCase().replace("_", " ")} — scoring is disabled.
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold">Submission</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm">
              {draftVersion?.problemStatement && (
                <div>
                  <div className="text-xs font-bold text-foreground mb-1">Problem</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{draftVersion.problemStatement}</p>
                </div>
              )}
              {draftVersion?.solutionDescription && (
                <div>
                  <div className="text-xs font-bold text-foreground mb-1">Solution</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{draftVersion.solutionDescription}</p>
                </div>
              )}
              {draftVersion?.impactBeneficiaries && (
                <div>
                  <div className="text-xs font-bold text-foreground mb-1">Impact</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{draftVersion.impactBeneficiaries}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
                {draftVersion?.repositoryUrl && (
                  <a href={draftVersion.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Repository <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {draftVersion?.demoUrl && (
                  <a href={draftVersion.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Demo <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {draftVersion?.pitchVideoUrl && (
                  <a href={draftVersion.pitchVideoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Pitch Video <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {draftVersion?.presentationUrl && (
                  <a href={draftVersion.presentationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Presentation <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {draftVersion?.technologyTags && draftVersion.technologyTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {draftVersion.technologyTags.map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold">Scorecard</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-5">
              {!rubricVersion ? (
                <div className="text-xs text-muted-foreground">Loading rubric...</div>
              ) : (
                rubricVersion.criteria.map((criterion) => (
                  <div key={criterion.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground">{criterion.label}</label>
                      <span className="text-[10px] text-muted-foreground">weight {criterion.weight}</span>
                    </div>
                    {criterion.description && <p className="text-[11px] text-muted-foreground">{criterion.description}</p>}
                    <input
                      type="number"
                      min={criterion.minScore}
                      max={criterion.maxScore}
                      disabled={isLocked || isRecusedOrReassigned}
                      value={scores[criterion.key]?.score ?? ""}
                      onChange={(e) =>
                        setScores((prev) => ({ ...prev, [criterion.key]: { ...prev[criterion.key], score: e.target.value, comment: prev[criterion.key]?.comment ?? "" } }))
                      }
                      className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs disabled:opacity-50"
                    />
                    <Textarea
                      placeholder="Comment (optional)"
                      disabled={isLocked || isRecusedOrReassigned}
                      value={scores[criterion.key]?.comment ?? ""}
                      onChange={(e) =>
                        setScores((prev) => ({ ...prev, [criterion.key]: { ...prev[criterion.key], comment: e.target.value, score: prev[criterion.key]?.score ?? "" } }))
                      }
                      className="text-xs min-h-16"
                    />
                  </div>
                ))
              )}

              {!isLocked && !isRecusedOrReassigned && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
                  <Button variant="outline" size="sm" disabled={saveDraftMutation.isPending} onClick={handleSaveDraft} className="text-xs h-9 gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Draft</span>
                  </Button>
                  <Button size="sm" disabled={submitMutation.isPending} onClick={() => setConfirmSubmit(true)} className="text-xs h-9 gap-1.5 font-semibold">
                    <Send className="h-3.5 w-3.5" />
                    <span>Submit Final Scorecard</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title="Submit final scorecard?"
        description="Once submitted, this scorecard is locked and cannot be edited."
        confirmLabel="Submit"
        onConfirm={handleSubmit}
        loading={submitMutation.isPending}
      />
      <ConfirmActionDialog
        open={confirmConflict}
        onOpenChange={setConfirmConflict}
        title="Declare a conflict of interest?"
        description="This assignment will be flagged for reassignment and removed from your queue."
        confirmLabel="Declare Conflict"
        onConfirm={() =>
          declareConflictMutation.mutate(assignmentId, {
            onSuccess: () => { toast.success("Conflict declared."); setConfirmConflict(false); navigate("/judge"); },
            onError: (err: any) => { toast.error(err?.message || "Failed to declare conflict."); setConfirmConflict(false); },
          })
        }
        loading={declareConflictMutation.isPending}
      />
      <ConfirmActionDialog
        open={confirmRecuse}
        onOpenChange={setConfirmRecuse}
        title="Recuse yourself from this assignment?"
        description="You will no longer be able to score this submission."
        confirmLabel="Recuse"
        onConfirm={() =>
          recuseMutation.mutate(assignmentId, {
            onSuccess: () => { toast.success("Recused."); setConfirmRecuse(false); navigate("/judge"); },
            onError: (err: any) => { toast.error(err?.message || "Failed to recuse."); setConfirmRecuse(false); },
          })
        }
        loading={recuseMutation.isPending}
      />
    </PageContainer>
  );
}
