import * as React from "react";
import { Trophy, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { usePublicChallenges } from "@/features/challenges/api/queries";

export function AdminChallengesPage() {
  const { items: challenges, isLoading, hasMore, loadMore, isLoadingMore } = usePublicChallenges();

  return (
    <PageContainer className="space-y-4">
      <PageHeader title="Global Challenges" description="Every publicly-visible challenge across all organizations." />

      <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>This view only shows challenges with public visibility — there is no platform-level endpoint for browsing an organization's private or unlisted challenges. Use an organization's own Challenges page for full visibility.</span>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-16 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
        ) : challenges.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No public challenges found.
          </Card>
        ) : (
          challenges.map((c) => (
            <Card key={c.id} className="p-4 border-border flex items-center justify-between gap-4 text-xs">
              <div>
                <div className="font-bold text-foreground">{c.title}</div>
                <div className="text-muted-foreground">{c.organizationName} · /{c.organizationSlug}</div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{c.status}</Badge>
            </Card>
          ))
        )}
      </div>
      <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
    </PageContainer>
  );
}
