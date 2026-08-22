import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePublicChallenges } from "@/features/challenges/api/queries";
import { PublicChallengeCard } from "@/components/shared/PublicChallengeCard";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/feedback/EmptyState";

export function ChallengesExplorePage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");

  const { items: challenges, isLoading, hasMore, loadMore, isLoadingMore } = usePublicChallenges(
    search ? { q: search } : undefined
  );

  const filtered = status === "ALL" ? challenges : challenges.filter((c) => c.status === status);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Challenges Catalog"
        description="Browse open challenges across every organization on the platform. Register as an individual or team."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/app/my-challenges")} className="text-xs font-semibold gap-1.5">
            <Trophy className="h-4 w-4 text-primary" />
            <span>My Registered Challenges</span>
          </Button>
        }
      />

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search challenges by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-xs w-full md:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="JUDGING">Judging</SelectItem>
            <SelectItem value="RESULTS_PUBLISHED">Results Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-muted/40 border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No challenges found"
          description="Try changing your search keywords or resetting your status filter."
          action={{ label: "Reset Filters", onClick: () => { setSearch(""); setStatus("ALL"); } }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {filtered.map((chal) => (
              <PublicChallengeCard key={chal.id} challenge={chal} layout="grid" />
            ))}
          </div>
          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </>
      )}
    </PageContainer>
  );
}
