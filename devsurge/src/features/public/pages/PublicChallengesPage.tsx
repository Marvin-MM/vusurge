import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { Search, LayoutGrid, List, RotateCcw, Trophy, ArrowUpDown, Filter, Sparkles } from "lucide-react";
import { usePublicChallenges } from "@/features/challenges/api/queries";
import { usePublicOrganizations } from "@/features/organizations/api/queries";
import { PublicChallengeCard } from "@/components/shared/PublicChallengeCard";
import { FeaturedChallengeCard } from "@/components/shared/FeaturedChallengeCard";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PublicChallengesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "ALL";
  const orgFilter = searchParams.get("org") || "ALL";
  const sortBy = searchParams.get("sort") || "newest";
  const viewMode = (searchParams.get("view") as "grid" | "list") || "grid";

  // Search is server-side (`q` re-triggers the query); status/org filters
  // apply to whatever pages have been loaded so far via "Load More".
  const { items: challenges, isLoading, hasMore, loadMore, isLoadingMore } = usePublicChallenges(
    search ? { q: search } : undefined
  );
  const { items: organizations } = usePublicOrganizations();

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "ALL" || (key === "sort" && value === "newest") || (key === "view" && value === "grid")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  const handleResetFilters = () => setSearchParams(new URLSearchParams());

  const filteredChallenges = React.useMemo(() => {
    let list = [...challenges];

    if (statusFilter !== "ALL") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (orgFilter !== "ALL") {
      list = list.filter((c) => c.organizationSlug === orgFilter);
    }

    switch (sortBy) {
      case "deadline_asc":
        list.sort((a, b) => {
          if (!a.submissionDeadline) return 1;
          if (!b.submissionDeadline) return -1;
          return new Date(a.submissionDeadline).getTime() - new Date(b.submissionDeadline).getTime();
        });
        break;
      case "newest":
      default:
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return list;
  }, [challenges, statusFilter, orgFilter, sortBy]);

  const hasActiveFilters = search !== "" || statusFilter !== "ALL" || orgFilter !== "ALL" || sortBy !== "newest";
  const featuredChallenge = filteredChallenges[0];
  const restChallenges = hasActiveFilters ? filteredChallenges : filteredChallenges.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
          <Trophy className="h-3.5 w-3.5" />
          <span>Open Challenges Directory</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Discover & Compete in Live Challenges
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Browse challenges published by verified organizations, register with a team or solo, and submit your
          project for blind, rubric-based judging.
        </p>
      </div>

      {/* Featured Highlight (when no specific search filter is active) */}
      {!hasActiveFilters && featuredChallenge && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Recently Published</span>
          </div>
          <FeaturedChallengeCard challenge={featuredChallenge} />
        </div>
      )}

      {/* Search and Filter Control Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search challenges by title or keywords..."
              value={search}
              onChange={(e) => updateParam("q", e.target.value)}
              className="pl-10 h-10 text-xs"
            />
          </div>

          <div className="w-full md:w-48 shrink-0">
            <Select value={sortBy} onValueChange={(val) => updateParam("sort", val)}>
              <SelectTrigger className="h-10 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Recently Published</SelectItem>
                <SelectItem value="deadline_asc">Upcoming Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden sm:flex items-center border border-border rounded-lg p-0.5 bg-muted/30">
            <button
              type="button"
              onClick={() => updateParam("view", "grid")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => updateParam("view", "list")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "list" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(val) => updateParam("status", val)}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold">{statusFilter.replace("_", " ")}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="JUDGING">Judging</SelectItem>
              <SelectItem value="RESULTS_PUBLISHED">Results Published</SelectItem>
            </SelectContent>
          </Select>

          <Select value={orgFilter} onValueChange={(val) => updateParam("org", val)}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[150px]">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-muted-foreground">Org:</span>
                <span className="font-semibold">
                  {orgFilter === "ALL" ? "All Orgs" : organizations.find((o) => o.slug === orgFilter)?.name || orgFilter}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.slug}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Filters</span>
            </Button>
          )}
        </div>
      </div>

      {/* Results Count & Meta */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Showing <strong>{filteredChallenges.length}</strong>{" "}
          {filteredChallenges.length === 1 ? "challenge" : "challenges"}
          {hasActiveFilters && " matching criteria"}
        </div>
      </div>

      {/* Challenge List / Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-muted/40 border border-border animate-pulse p-6" />
          ))}
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border space-y-4 max-w-lg mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Filter className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">No challenges match your criteria</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Try adjusting your search terms or clearing status/organization filters to see available challenges.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleResetFilters}>
            Clear All Filters
          </Button>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restChallenges.map((chal) => (
                <PublicChallengeCard key={chal.id} challenge={chal} layout="grid" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {restChallenges.map((chal) => (
                <PublicChallengeCard key={chal.id} challenge={chal} layout="list" />
              ))}
            </div>
          )}
          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </>
      )}
    </div>
  );
}
