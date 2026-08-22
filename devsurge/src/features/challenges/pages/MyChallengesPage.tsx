import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useMyChallengeParticipations } from "@/features/participant/api/queries";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  DISQUALIFIED: "Disqualified",
};

export function MyChallengesPage() {
  const navigate = useNavigate();
  const { data: participations = [], isLoading } = useMyChallengeParticipations();

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="My Registered Challenges"
        description="Challenges you've registered for or applied to."
        actions={
          <Button onClick={() => navigate("/app/challenges")} className="text-xs font-semibold">
            Browse More Challenges
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-muted/40 border border-border animate-pulse" />
          ))}
        </div>
      ) : participations.length === 0 ? (
        <EmptyState
          title="No registered challenges yet"
          description="Browse open challenges and register to get started."
          action={{ label: "Browse Challenges", onClick: () => navigate("/app/challenges") }}
        />
      ) : (
        <div className="space-y-4">
          {participations.map((p) => (
            <Card key={p.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {STATUS_LABEL[p.status] || p.status}
                </Badge>
                <h3
                  onClick={() => navigate(`/app/challenges/${p.organizationSlug}/${p.challengeId}`)}
                  className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  {p.challengeTitle}
                </h3>
                <p className="text-xs text-muted-foreground">Applied {new Date(p.appliedAt).toLocaleDateString()}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/app/challenges/${p.organizationSlug}/${p.challengeId}`)}
                  className="text-xs h-8"
                >
                  View Challenge
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
