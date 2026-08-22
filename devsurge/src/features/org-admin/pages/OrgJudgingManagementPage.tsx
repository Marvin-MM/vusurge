import * as React from "react";
import { useParams } from "react-router-dom";
import { Award, Plus, Trash2, Users, Sparkles, RefreshCw, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import {
  useAdminRubrics,
  useCreateRubric,
  useRubricVersions,
  useCreateRubricVersion,
  useActivateRubricVersion,
  useAdminStaff,
  useAdminJudgeAssignments,
  useAdminSubmissions,
  useCreateJudgeAssignment,
  useAutoBalanceJudgeAssignments,
  useJudgingProgress,
  useFinalizeJudging,
} from "@/features/org-admin/api/queries";
import { toast } from "sonner";

interface DraftCriterion {
  key: string;
  label: string;
  minScore: number;
  maxScore: number;
  weight: number;
}

function RubricSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: rubrics = [] } = useAdminRubrics(organizationId, challengeId);
  const createRubricMutation = useCreateRubric(organizationId, challengeId);
  const [name, setName] = React.useState("");
  const [selectedRubricId, setSelectedRubricId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (rubrics.length > 0 && !selectedRubricId) setSelectedRubricId(rubrics[0].id);
  }, [rubrics, selectedRubricId]);

  const { data: versions = [] } = useRubricVersions(organizationId, challengeId, selectedRubricId || "");
  const createVersionMutation = useCreateRubricVersion(organizationId, challengeId, selectedRubricId || "");
  const activateMutation = useActivateRubricVersion(organizationId, challengeId, selectedRubricId || "");

  const [criteria, setCriteria] = React.useState<DraftCriterion[]>([
    { key: "technical", label: "Technical Execution", minScore: 0, maxScore: 10, weight: 40 },
    { key: "impact", label: "Impact & Originality", minScore: 0, maxScore: 10, weight: 40 },
    { key: "presentation", label: "Presentation", minScore: 0, maxScore: 10, weight: 20 },
  ]);

  const totalWeight = criteria.reduce((acc, c) => acc + c.weight, 0);

  return (
    <Card className="p-6 space-y-4 border-border">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
        <Award className="h-4 w-4 text-purple-500" />
        Judging Rubric
      </h3>

      {rubrics.length === 0 ? (
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rubric name, e.g. Main Rubric" className="text-xs h-9" />
          <Button
            size="sm"
            disabled={!name.trim() || createRubricMutation.isPending}
            onClick={() => createRubricMutation.mutate({ name }, { onSuccess: (r) => setSelectedRubricId(r.id) })}
            className="text-xs h-9 gap-1 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Rubric
          </Button>
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Rubric: <strong className="text-foreground">{rubrics.find((r) => r.id === selectedRubricId)?.name}</strong>
          </div>

          {versions.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">Versions</div>
              {versions.map((v) => (
                <div key={v.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs">
                  <span className="font-mono">v{v.version} — {v.criteria.length} criteria</span>
                  {v.isActive ? (
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-none">Active</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => activateMutation.mutate(v.id)} className="text-xs h-7">
                      Activate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">New Version — Criteria</div>
              <span className={`text-xs font-mono font-bold ${totalWeight === 100 ? "text-emerald-500" : "text-destructive"}`}>{totalWeight}% / 100%</span>
            </div>
            {criteria.map((c, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center gap-2 text-xs">
                <Input
                  value={c.label}
                  onChange={(e) => { const upd = [...criteria]; upd[idx] = { ...upd[idx], label: e.target.value }; setCriteria(upd); }}
                  className="text-xs h-8 flex-1"
                />
                <Input
                  type="number"
                  value={c.weight}
                  onChange={(e) => { const upd = [...criteria]; upd[idx] = { ...upd[idx], weight: Number(e.target.value) }; setCriteria(upd); }}
                  className="text-xs h-8 w-20 font-mono"
                />
                <Button variant="ghost" size="icon" onClick={() => setCriteria(criteria.filter((_, i) => i !== idx))} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCriteria([...criteria, { key: `criterion_${criteria.length + 1}`, label: "New Criterion", minScore: 0, maxScore: 10, weight: 0 }])}
              className="text-xs h-8 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Criterion
            </Button>
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                disabled={totalWeight !== 100 || createVersionMutation.isPending}
                onClick={() =>
                  createVersionMutation.mutate(
                    { criteria },
                    { onSuccess: () => toast.success("New rubric version created."), onError: (err: any) => toast.error(err?.message || "Failed to save.") }
                  )
                }
                className="text-xs font-semibold"
              >
                Save New Version
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function AssignmentsSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: staff = [] } = useAdminStaff(organizationId, challengeId);
  const { data: assignments = [] } = useAdminJudgeAssignments(organizationId, challengeId);
  const { items: submissions } = useAdminSubmissions(organizationId, challengeId);
  const createAssignmentMutation = useCreateJudgeAssignment(organizationId, challengeId);
  const autoBalanceMutation = useAutoBalanceJudgeAssignments(organizationId, challengeId);

  const judges = staff.filter((s) => s.role === "JUDGE" && s.status === "ACTIVE");

  return (
    <Card className="p-6 space-y-4 border-border">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Judge Assignments
        </h3>
        <Button
          variant="outline"
          size="sm"
          disabled={autoBalanceMutation.isPending}
          onClick={() => autoBalanceMutation.mutate(undefined, { onSuccess: () => toast.success("Assignments auto-balanced.") })}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Auto-Balance</span>
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {judges.length} active judge{judges.length === 1 ? "" : "s"} • {submissions.length} submission{submissions.length === 1 ? "" : "s"} • {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
      </div>

      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No assignments yet. Use Auto-Balance to distribute submissions across judges evenly.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <div key={a.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">Submission {a.submissionId.slice(0, 8)}...</span>
              <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProgressSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: progress } = useJudgingProgress(organizationId, challengeId);
  const finalizeMutation = useFinalizeJudging(organizationId, challengeId);

  if (!progress) return null;

  return (
    <Card className="p-6 space-y-4 border-border">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        Judging Progress
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
          <div className="text-xl font-bold text-foreground">{progress.totalAssignments}</div>
          <div className="text-muted-foreground">Total</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
          <div className="text-xl font-bold text-emerald-600">{progress.submittedCount}</div>
          <div className="text-muted-foreground">Submitted</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
          <div className="text-xl font-bold text-amber-600">{progress.draftCount}</div>
          <div className="text-muted-foreground">Draft</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
          <div className="text-xl font-bold text-foreground">{progress.lockedCount}</div>
          <div className="text-muted-foreground">Locked</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
          <div className="text-xl font-bold text-destructive">{progress.conflictCount}</div>
          <div className="text-muted-foreground">Conflicts</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
          <div className="text-xl font-bold text-muted-foreground">{progress.recusedCount}</div>
          <div className="text-muted-foreground">Recused</div>
        </div>
      </div>
      <Button
        onClick={() => finalizeMutation.mutate(undefined, { onSuccess: () => toast.success("Judging finalized."), onError: (err: any) => toast.error(err?.message || "Failed to finalize.") })}
        disabled={finalizeMutation.isPending}
        className="text-xs font-semibold gap-1.5"
      >
        <Lock className="h-3.5 w-3.5" />
        <span>Finalize Judging</span>
      </Button>
    </Card>
  );
}

export function OrgJudgingManagementPage() {
  const { orgId = "", challengeId = "" } = useParams<{ orgId: string; challengeId: string }>();

  return (
    <OrgAccessGuard permission="challenge.manage_rubric" title="Judging Management Restricted" description="You require Challenge Manager or Organization Admin privileges to manage judging.">
      <PageContainer className="space-y-6">
        <PageHeader title="Judging Management" description="Configure the rubric, assign judges, and track scoring progress." />
        <RubricSection organizationId={orgId} challengeId={challengeId} />
        <AssignmentsSection organizationId={orgId} challengeId={challengeId} />
        <ProgressSection organizationId={orgId} challengeId={challengeId} />
      </PageContainer>
    </OrgAccessGuard>
  );
}
