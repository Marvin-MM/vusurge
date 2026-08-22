import * as React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Building2 } from "lucide-react";
import { PublicInnovation } from "@/types";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface InnovationCardProps {
  key?: React.Key;
  item: PublicInnovation;
  className?: string;
  /** Hide when already shown in context (e.g. an org's own profile page). */
  showOrganization?: boolean;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  DISCOVERY: { label: "Discovery", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" },
  VALIDATION: { label: "Validation", color: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  PROTOTYPE: { label: "Prototype", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  PILOT: { label: "Active Pilot", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  INCUBATION: { label: "Incubation", color: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30" },
  SCALE: { label: "Scale / Spin-Out", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
};

/** Public innovation-portfolio showcase card — see PublicInnovation (no financials/milestones, those are org-internal only). */
export function InnovationCard({ item, className, showOrganization = true }: InnovationCardProps) {
  const stageInfo = STAGE_LABELS[item.stage] || { label: item.stage, color: "bg-muted text-muted-foreground border-border" };

  return (
    <Card
      className={cn(
        "p-6 rounded-2xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between space-y-5 shadow-xs group",
        className
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border", stageInfo.color)}>
            <Sparkles className="h-3 w-3" />
            <span>{stageInfo.label}</span>
          </span>
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground line-clamp-1">{item.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
            {item.opportunityStatement || item.thesis || item.expectedImpact}
          </p>
        </div>

        {item.strategicThemes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.strategicThemes.slice(0, 3).map((theme) => (
              <span key={theme} className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50 font-medium">
                {theme}
              </span>
            ))}
          </div>
        )}
      </div>

      {showOrganization && (
        <div className="pt-3 border-t border-border/60 flex items-center justify-between">
          <Link
            to={`/organizations/${item.organizationSlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors truncate"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.organizationName}</span>
          </Link>
        </div>
      )}
    </Card>
  );
}
