import * as React from "react";
import { Search, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { PlatformAccessGuard } from "@/features/superadmin/components/PlatformAccessGuard";
import { usePlatformChallenges } from "@/features/superadmin/api/queries";

function AdminChallengesContent() {
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const { items: challenges, isLoading, hasMore, loadMore, isLoadingMore } = usePlatformChallenges({
    search: deferredSearch || undefined,
  });

  return (
    <PageContainer className="space-y-4">
      <PageHeader title="Global Challenges" description="Every public, private, and unlisted challenge across all organizations." />

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search challenge or organization" className="pl-9" maxLength={200} />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-16 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
        ) : challenges.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No challenges found.
          </Card>
        ) : (
          challenges.map((c) => (
            <Card key={c.id} className="p-4 border-border flex items-center justify-between gap-4 text-xs">
              <div>
                <div className="font-bold text-foreground">{c.title}</div>
                <div className="text-muted-foreground">{c.organizationName} · /{c.organizationSlug}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {c.moderationHiddenAt && <Badge variant="destructive" className="text-[10px]">Hidden</Badge>}
                <Badge variant="outline" className="text-[10px]">{c.visibility}</Badge>
                <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
              </div>
            </Card>
          ))
        )}
      </div>
      <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
    </PageContainer>
  );
}

export function AdminChallengesPage() {
  return <PlatformAccessGuard anyOf={["platform.manage_organizations"]}><AdminChallengesContent /></PlatformAccessGuard>;
}
