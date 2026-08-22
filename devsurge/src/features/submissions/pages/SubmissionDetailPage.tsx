import * as React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Code, Link2, Video, ArrowLeft, Lock, Edit, History, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/shared/PageContainer";
import { useSubmission, useSubmissionVersions, useSubmissionFeedback } from "@/features/submissions/api/queries";
import { SubmissionStatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/feedback/EmptyState";

export function SubmissionDetailPage() {
  const { submissionId = "" } = useParams<{ submissionId: string }>();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get("organizationId") || "";
  const challengeId = searchParams.get("challengeId") || "";
  const navigate = useNavigate();

  const { data: submission } = useSubmission(organizationId, challengeId, submissionId);
  const { data: versions = [] } = useSubmissionVersions(organizationId, challengeId, submissionId);
  const { data: feedback = [] } = useSubmissionFeedback(organizationId, challengeId, submissionId);

  if (!submission) {
    return (
      <PageContainer>
        <EmptyState
          title="Submission Not Found"
          description="The requested project submission does not exist or has been deleted."
          action={{ label: "Back to Submissions", onClick: () => navigate("/app/submissions") }}
        />
      </PageContainer>
    );
  }

  const v = submission.draftVersion;
  const isFinalized = submission.status === "FINALIZED";

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/submissions")} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Submissions</span>
        </Button>
        <div className="flex items-center gap-2">
          {isFinalized ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
              <Lock className="h-3.5 w-3.5" />
              Finalized & Locked
            </span>
          ) : (
            <Button
              size="sm"
              onClick={() => navigate(`/app/submissions/${submission.id}/edit?organizationId=${organizationId}&challengeId=${challengeId}`)}
              className="text-xs h-8 font-semibold gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Draft</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <SubmissionStatusBadge status={submission.status} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">{v?.title || "Untitled Submission"}</h1>
            {v?.tagline && <p className="text-sm font-semibold text-foreground/80">{v.tagline}</p>}
          </div>
        </div>

        {v?.solutionDescription && (
          <div className="space-y-2 pt-4 border-t border-border/60">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Solution</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{v.solutionDescription}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-4 pt-4 border-t border-border/60 text-xs">
          {v?.repositoryUrl && (
            <a href={v.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:border-primary/50 text-foreground font-semibold transition-colors">
              <Code className="h-4 w-4 text-primary" />
              <span>Repository</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}
          {v?.demoUrl && (
            <a href={v.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:border-emerald-500/50 text-foreground font-semibold transition-colors">
              <Link2 className="h-4 w-4 text-emerald-500" />
              <span>Live Demo</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}
          {v?.pitchVideoUrl && (
            <a href={v.pitchVideoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:border-purple-500/50 text-foreground font-semibold transition-colors">
              <Video className="h-4 w-4 text-purple-500" />
              <span>Pitch Video</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {feedback.length > 0 ? (
            feedback.map((fb, idx) => (
              <Card key={idx} className="p-6 space-y-4 border-purple-500/30 bg-purple-500/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Judge Feedback {feedback.length > 1 ? `#${idx + 1}` : ""}</span>
                  {fb.totalScore != null && fb.maxPossibleScore != null && (
                    <div className="text-right">
                      <div className="text-2xl font-black text-foreground">{fb.totalScore} / {fb.maxPossibleScore}</div>
                    </div>
                  )}
                </div>
                <div className="space-y-3 pt-2">
                  {fb.criterionScores.map((s, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground">{s.criterionKey}</span>
                        {s.comment && <p className="text-[11px] text-muted-foreground mt-0.5">{s.comment}</p>}
                      </div>
                      <Badge variant="default" className="text-xs font-bold bg-primary/10 text-primary border-none">{s.score} pts</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          ) : (
            <Card className="border-border p-6 text-center space-y-2">
              <Sparkles className="h-6 w-6 text-primary mx-auto" />
              <h4 className="text-sm font-bold text-foreground">Judging & Scoring in Progress</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Feedback appears here once the organizer releases judges' evaluations.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <span>Version History</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No prior versions.</p>
              ) : (
                <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {versions.map((version) => (
                    <div key={version.id} className="relative pl-6 space-y-1">
                      <div className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-background ${version.isFinal ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">Version {version.versionNumber}</span>
                        {version.isFinal && <Badge variant="outline" className="text-[10px]">Final</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{new Date(version.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
