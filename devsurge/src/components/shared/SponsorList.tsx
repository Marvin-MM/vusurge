import * as React from "react";
import { Sponsor } from "@/types";
import { useAssetUrl } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";

export interface SponsorListProps {
  sponsors: Sponsor[];
  className?: string;
}

function SponsorTile({ sponsor }: { sponsor: Sponsor }) {
  const { url: logoUrl } = useAssetUrl(sponsor.logoAssetId, "public");

  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all flex items-center gap-3 group">
      {logoUrl ? (
        <img src={logoUrl} alt={sponsor.name} className="h-9 w-9 rounded-lg object-cover border border-border shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
          {sponsor.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">{sponsor.name}</div>
      </div>
    </div>
  );
}

/** Tier is organizer-authored free text, not a closed enum — group by whatever values are actually present. */
export function SponsorList({ sponsors, className }: SponsorListProps) {
  if (!sponsors || sponsors.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-3">
        No sponsors officially announced yet for this challenge.
      </div>
    );
  }

  const tiers = Array.from(new Set(sponsors.map((s) => s.tier || "Sponsors"))).sort();

  return (
    <div className={cn("space-y-6", className)}>
      {tiers.map((tier) => {
        const tierSponsors = sponsors.filter((s) => (s.tier || "Sponsors") === tier);
        if (tierSponsors.length === 0) return null;

        return (
          <div key={tier} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{tier}</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {tierSponsors.map((s) => (
                <SponsorTile key={s.id} sponsor={s} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
