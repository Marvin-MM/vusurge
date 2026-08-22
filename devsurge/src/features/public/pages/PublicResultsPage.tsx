import * as React from "react";
import { Link } from "react-router-dom";
import { Trophy, Medal, ArrowRight } from "lucide-react";
import { usePublicChallenges, usePublicChallengeResults } from "@/features/challenges/api/queries";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Challenge } from "@/types";

function ChallengeResultsSection({ challenge }: { challenge: Challenge }) {
  const { data: results = [] } = usePublicChallengeResults(challenge.organizationSlug || "", challenge.slug);

  if (results.length === 0) return null;

  const sorted = [...results].sort((a: any, b: any) => (a.rank ?? 999) - (b.rank ?? 999));

  return (
    <div className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card space-y-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">{challenge.organizationName || "Verified Host"}</span>
            {challenge.resultsPublishedAt && (
              <>
                <span className="text-muted-foreground text-xs">•</span>
                <span className="text-xs font-mono text-muted-foreground">
                  Concluded {new Date(challenge.resultsPublishedAt).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
          <h2 className="text-2xl font-black text-foreground">{challenge.title}</h2>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0 text-xs">
          <Link to={`/challenges/${challenge.organizationSlug}/${challenge.slug}`}>
            <span>View Full Challenge</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {sorted.map((result: any) => (
          <Card
            key={result.id}
            className="p-4 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Medal className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-foreground">
                {result.rankLabel || (result.rank ? `Rank #${result.rank}` : "Recognized")}
              </span>
            </div>
            {result.aggregateScore != null && (
              <span className="text-xs font-mono text-muted-foreground">Score: {result.aggregateScore.toFixed(1)}</span>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PublicResultsPage() {
  const { items: challenges, isLoading, hasMore, loadMore, isLoadingMore } = usePublicChallenges();
  const completedChallenges = challenges.filter((c) => c.status === "RESULTS_PUBLISHED");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 text-foreground">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
          <Trophy className="h-3.5 w-3.5" />
          <span>Official Hall of Winners</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Verified Challenge Results & Winners
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Official results from completed challenges, published once judging and the results review period conclude.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-48 rounded-3xl bg-muted/40 border border-border animate-pulse" />
          ))}
        </div>
      ) : completedChallenges.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl space-y-3 max-w-lg mx-auto">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
          <h3 className="text-base font-bold text-foreground">Active Deliberations in Progress</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Challenge judging is currently underway across the platform. Finalized results will be published here
            once each challenge's audit window completes.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-16">
            {completedChallenges.map((chal) => (
              <ChallengeResultsSection key={chal.id} challenge={chal} />
            ))}
          </div>
          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </>
      )}
    </div>
  );
}
