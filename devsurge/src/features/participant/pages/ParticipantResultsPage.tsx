import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, ArrowRight, Clock, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useMyChallengeParticipations } from "@/features/participant/api/queries";
import { useOrgChallenge, usePublicChallengeResults } from "@/features/challenges/api/queries";
import { MyParticipationSummary } from "@/types";

/**
 * One row per challenge the caller actually took part in. Results themselves
 * are public content by construction — the only org-scoped results endpoint is
 * organizer-gated — so each row reads the public projection, but scoped to
 * this user's own participations and rendered inside the participant shell.
 * Fetching per row (rather than one aggregate call) is necessary because the
 * public results endpoint is keyed by challenge *slug*, which the
 * participation summary does not carry; the challenge lookup supplies it.
 */
function ResultRow({ participation }: { participation: MyParticipationSummary }) {
  const navigate = useNavigate();
  const { data: challenge } = useOrgChallenge(
    participation.organizationId,
    participation.challengeId
  );
  const published = challenge?.status === "RESULTS_PUBLISHED";
  const { data: results = [] } = usePublicChallengeResults(
    published ? participation.organizationSlug : "",
    published ? challenge?.slug || "" : ""
  );

  const isJudging = challenge?.status === "JUDGING" || challenge?.status === "RESULTS_READY";

  return (
    <Card className="border-border">
      <CardHeader className="p-5 pb-3 flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1 min-w-0">
          <CardTitle className="text-sm font-bold text-foreground">
            {participation.challengeTitle}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {published ? (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
                Results Published
              </Badge>
            ) : isJudging ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Gavel className="h-3 w-3" />
                Judging in Progress
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Clock className="h-3 w-3" />
                Awaiting Results
              </Badge>
            )}
          </div>
        </div>
        {published && challenge && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate(`/challenges/${participation.organizationSlug}/${challenge.slug}`)
            }
            className="text-xs h-8 gap-1.5 shrink-0"
          >
            <span>View Challenge</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>

      {published && (
        <CardContent className="p-5 pt-0 space-y-2">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Results are published for this challenge, but no ranked entries were listed.
            </p>
          ) : (
            [...results]
              .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
              .map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/80 bg-muted/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Medal className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground truncate">
                      {result.rankLabel || (result.rank ? `Rank #${result.rank}` : "Recognized")}
                    </span>
                  </div>
                  {result.aggregateScore != null && (
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      {result.aggregateScore.toFixed(1)}
                    </span>
                  )}
                </div>
              ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function ParticipantResultsPage() {
  const navigate = useNavigate();
  const { data: participations = [], isLoading } = useMyChallengeParticipations();

  // Withdrawn/rejected entries have no meaningful result to report.
  const relevant = participations.filter(
    (p) => p.status === "APPROVED" || p.status === "DISQUALIFIED"
  );

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Results"
        description="Outcomes for the challenges you have taken part in."
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-24 rounded-xl bg-muted/40 border border-border animate-pulse" />
          ))}
        </div>
      ) : relevant.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No results yet"
          description="Once you take part in a challenge and its organizers publish the outcome, it will appear here."
          action={{ label: "Explore Challenges", onClick: () => navigate("/app/challenges") }}
        />
      ) : (
        <div className="space-y-4">
          {relevant.map((participation) => (
            <ResultRow key={participation.id} participation={participation} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
