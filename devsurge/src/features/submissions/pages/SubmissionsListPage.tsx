import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useMySubmission } from "@/features/submissions/api/queries";
import { useMyChallengeParticipations } from "@/features/participant/api/queries";
import { SubmissionStatusBadge } from "@/components/shared/StatusBadge";
import { MyParticipationSummary } from "@/types";

function SubmissionRow({ participation }: { participation: MyParticipationSummary }) {
  const navigate = useNavigate();
  const { data: submission, isLoading } = useMySubmission(participation.organizationId, participation.challengeId);

  if (isLoading) return <div className="h-20 rounded-xl bg-muted/40 border border-border animate-pulse" />;
  if (!submission) return null;

  const title = submission.draftVersion?.title || "Untitled Submission";

  return (
    <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <SubmissionStatusBadge status={submission.status} />
          <span className="text-xs text-muted-foreground">{participation.challengeTitle}</span>
        </div>
        <h3
          onClick={() => navigate(`/app/submissions/${submission.id}?organizationId=${participation.organizationId}&challengeId=${participation.challengeId}`)}
          className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          {title}
        </h3>
        {submission.draftVersion?.tagline && <p className="text-xs text-muted-foreground line-clamp-1">{submission.draftVersion.tagline}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/app/submissions/${submission.id}?organizationId=${participation.organizationId}&challengeId=${participation.challengeId}`)}
          className="text-xs h-8 gap-1"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>View Details</span>
        </Button>
        {submission.status === "DRAFT" && (
          <Button
            size="sm"
            onClick={() => navigate(`/app/submissions/${submission.id}/edit?organizationId=${participation.organizationId}&challengeId=${participation.challengeId}`)}
            className="text-xs h-8 font-semibold"
          >
            Edit Draft
          </Button>
        )}
      </div>
    </Card>
  );
}

export function SubmissionsListPage() {
  const navigate = useNavigate();
  const { data: participations = [] } = useMyChallengeParticipations();
  const approved = participations.filter((p) => p.status === "APPROVED");

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="My Submissions"
        description="Review and edit your project submissions across every challenge you're registered for."
        actions={
          approved.length > 0 && (
            <Button onClick={() => navigate("/app/challenges")} className="text-xs font-semibold gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Start New Submission</span>
            </Button>
          )
        }
      />

      {approved.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          description="Register for a challenge to start a submission."
          action={{ label: "Browse Challenges", onClick: () => navigate("/app/challenges") }}
        />
      ) : (
        <div className="space-y-4">
          {approved.map((p) => (
            <SubmissionRow key={p.id} participation={p} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
