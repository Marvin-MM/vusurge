import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Organization } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAssetUrl } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";

export interface OrganizationCardProps {
  key?: React.Key;
  organization: Organization;
  className?: string;
}

export function OrganizationCard({ organization, className }: OrganizationCardProps) {
  const { url: logoUrl } = useAssetUrl(organization.logoAssetId, "public");

  return (
    <Card
      className={cn(
        "p-6 rounded-2xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between space-y-5 shadow-xs group",
        className
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={organization.name}
                className="h-12 w-12 rounded-xl object-cover border border-border shrink-0 shadow-2xs"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                {organization.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                <Link to={`/organizations/${organization.slug}`}>{organization.name}</Link>
              </h3>
              <div className="text-xs text-muted-foreground font-medium">{organization.organizationType}</div>
            </div>
          </div>

          {organization.region && (
            <Badge variant="outline" className="text-[11px] font-semibold shrink-0">
              {organization.region}
            </Badge>
          )}
        </div>

        {/* Description */}
        {organization.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{organization.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-border/60 flex items-center justify-end">
        <Link
          to={`/organizations/${organization.slug}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <span>Public Profile</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
