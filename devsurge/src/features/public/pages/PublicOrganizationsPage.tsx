import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Search, Shield, PlusCircle } from "lucide-react";
import { usePublicOrganizations } from "@/features/organizations/api/queries";
import { OrganizationCard } from "@/components/shared/OrganizationCard";
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
import { Card } from "@/components/ui/card";

export function PublicOrganizationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";
  const typeFilter = searchParams.get("type") || "ALL";

  const { items: organizations, isLoading, hasMore, loadMore, isLoadingMore } = usePublicOrganizations(
    search ? { q: search } : undefined
  );

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "ALL") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  };

  // organizationType is free-form on the backend, not a closed enum — build
  // filter options from what's actually loaded rather than a guessed list.
  const availableTypes = React.useMemo(
    () => Array.from(new Set(organizations.map((o) => o.organizationType))).sort(),
    [organizations]
  );

  const filteredOrgs = React.useMemo(() => {
    if (typeFilter === "ALL") return organizations;
    return organizations.filter((o) => o.organizationType === typeFilter);
  }, [organizations, typeFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-foreground">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
            <Building2 className="h-3.5 w-3.5" />
            <span>Innovation Ecosystems</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Host Organizations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Browse verified organizations hosting challenges on DevArena — companies, universities, and community
            groups running their own innovation programs.
          </p>
        </div>

        <Button asChild className="gap-2 shrink-0 font-semibold">
          <Link to="/app/apply-organization">
            <PlusCircle className="h-4 w-4" />
            <span>Apply for an Organization</span>
          </Link>
        </Button>
      </div>

      {/* Governance & Privacy Notice Box */}
      <Card className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Organization Membership Policy:</strong> Public profiles showcase an
            organization's open challenges. Membership enrollment is governed by invitation, join code, or
            request-to-join, depending on each organization's own settings.
          </div>
        </div>
      </Card>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl border border-border/80 bg-card flex flex-col sm:flex-row items-center gap-3 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations by name..."
            value={search}
            onChange={(e) => updateParam("q", e.target.value)}
            className="pl-10 h-10 text-xs"
          />
        </div>

        {availableTypes.length > 0 && (
          <div className="w-full sm:w-56 shrink-0">
            <Select value={typeFilter} onValueChange={(val) => updateParam("type", val)}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Organization Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Organization Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-muted/40 border border-border animate-pulse p-6" />
          ))}
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border space-y-3 max-w-md mx-auto">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-base font-bold text-foreground">No organizations found</h3>
          <p className="text-xs text-muted-foreground">No public organizations match your search filter.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrgs.map((org) => (
              <OrganizationCard key={org.id} organization={org} />
            ))}
          </div>
          <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
        </>
      )}
    </div>
  );
}
