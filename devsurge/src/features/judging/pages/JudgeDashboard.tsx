import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Gavel, ShieldAlert, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { useMyJudgeAssignments } from "@/features/judging/api/queries";
import { JudgeAssignment } from "@/types";

const STATUS_STYLE: Record<JudgeAssignment["status"], string> = {
  ASSIGNED: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  CONFLICT_DECLARED: "bg-destructive/10 text-destructive border-destructive/20",
  RECUSED: "bg-muted text-muted-foreground border-border",
  REASSIGNED: "bg-muted text-muted-foreground border-border",
};

export function JudgeDashboard() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useMyJudgeAssignments();

  const active = assignments.filter((a) => a.status === "ASSIGNED");
  const other = assignments.filter((a) => a.status !== "ASSIGNED");

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="My Assignments" description="Submissions you've been assigned to score across every organization." />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <div key={n} className="h-20 rounded-2xl bg-muted/40 border border-border animate-pulse" />)}
        </div>
      ) : assignments.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed">
          <Gavel className="h-8 w-8 mx-auto mb-2 opacity-50" />
          You have no judge assignments yet. An organization will assign you once you've accepted a judging invitation.
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">To Score</h2>
              {active.map((a) => (
                <Card
                  key={a.id}
                  onClick={() => navigate(`/judge/assignments/${a.id}`)}
                  className="p-4 border-border hover:border-primary/50 transition-all cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-muted-foreground">Submission {a.submissionId.slice(0, 8)}</div>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[a.status]}`}>{a.status}</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Card>
              ))}
            </div>
          )}

          {other.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                Recused / Reassigned
              </h2>
              {other.map((a) => (
                <Card key={a.id} className="p-4 border-border flex items-center justify-between gap-4 opacity-70">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-muted-foreground">Submission {a.submissionId.slice(0, 8)}</div>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[a.status]}`}>{a.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
