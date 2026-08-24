import * as React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, Trophy, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { PublicChallengeCard } from "@/components/shared/PublicChallengeCard";
import { OrganizationCard } from "@/components/shared/OrganizationCard";
import { usePublicSearch } from "@/features/public/api/queries";

export function PublicSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQ = searchParams.get("q") || "";
  const [input, setInput] = React.useState(initialQ);
  const { data, isLoading } = usePublicSearch(initialQ);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(input.trim() ? { q: input.trim() } : {});
  };

  const totalResults = (data?.organizations.length || 0) + (data?.challenges.length || 0);

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Search" description="Find challenges and organizations across VUSurge." />

      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search challenges and organizations..."
            className="pl-10 h-11 text-sm"
            autoFocus
          />
        </div>
      </form>

      {!initialQ ? (
        <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Enter a search term to find challenges and organizations.
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-40 rounded-2xl bg-muted/40 border border-border animate-pulse" />)}
        </div>
      ) : totalResults === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed">
          No results for "{initialQ}".
        </Card>
      ) : (
        <div className="space-y-8">
          {data && data.challenges.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-primary" />
                Challenges ({data.challenges.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.challenges.map((c) => <PublicChallengeCard key={c.id} challenge={c} />)}
              </div>
            </div>
          )}
          {data && data.organizations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Organizations ({data.organizations.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.organizations.map((o) => <OrganizationCard key={o.id} organization={o} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
