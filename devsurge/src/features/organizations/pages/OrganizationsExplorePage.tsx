import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePublicOrganizations } from "@/features/organizations/api/queries";
import { OrganizationCard } from "@/components/shared/OrganizationCard";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/feedback/EmptyState";

export function OrganizationsExplorePage() {
  const [search, setSearch] = React.useState("");
  const { items: organizations, isLoading, hasMore, loadMore, isLoadingMore } = usePublicOrganizations(
    search ? { q: search } : undefined
  );

  return (
    <PageContainer>
      <PageHeader
        title="Organizations"
        description="Organizations hosting challenges on DevArena."
      />

      <div className="flex items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs h-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {[1, 2, 3].map((n) => <div key={n} className="h-56 rounded-2xl bg-muted/40 border border-border animate-pulse" />)}
        </div>
      ) : organizations.length === 0 ? (
        <EmptyState title="No organizations found" description="Try a different search." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {organizations.map((org) => (
              <OrganizationCard key={org.id} organization={org} />
            ))}
          </div>
          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </>
      )}
    </PageContainer>
  );
}
