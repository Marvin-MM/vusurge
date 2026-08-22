import * as React from "react";
import { Link } from "react-router-dom";
import { Calendar, Building2, ArrowRight } from "lucide-react";
import { Challenge } from "@/types";
import { Card } from "@/components/ui/card";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";
import { getDisplayStatus } from "@/lib/challengeStatus";
import { useAssetUrl } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";

export interface PublicChallengeCardProps {
  key?: React.Key;
  challenge: Challenge;
  layout?: "grid" | "list";
  className?: string;
}

export function PublicChallengeCard({ challenge, layout = "grid", className }: PublicChallengeCardProps) {
  const isGrid = layout === "grid";
  const orgName = challenge.organizationName || "DevArena Partner";
  const detailHref = `/challenges/${challenge.organizationSlug}/${challenge.slug}`;
  const { url: coverUrl } = useAssetUrl(challenge.coverAssetId, "public");
  const deadline = challenge.submissionDeadline;

  if (!isGrid) {
    return (
      <Card
        className={cn(
          "p-5 hover:border-primary/50 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6 border-border/80 bg-card/90",
          className
        )}
      >
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
            {orgName.slice(0, 2).toUpperCase()}
          </div>

          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ChallengeStatusBadge status={getDisplayStatus(challenge)} />
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {orgName}
              </span>
            </div>

            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
              <Link to={detailHref}>{challenge.title}</Link>
            </h3>

            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {challenge.summary || challenge.description}
            </p>
          </div>
        </div>

        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-6 shrink-0 gap-3">
          {deadline && (
            <div className="text-left md:text-right">
              <div className="text-[11px] text-muted-foreground">Submission Deadline:</div>
              <div className="text-xs font-semibold text-foreground">{new Date(deadline).toLocaleDateString()}</div>
            </div>
          )}

          <Link
            to={detailHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline group-hover:translate-x-0.5 transition-transform"
          >
            <span>View Challenge</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col group h-full shadow-xs",
        className
      )}
    >
      <div className="h-44 relative bg-slate-900 overflow-hidden">
        <img
          src={coverUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"}
          alt={challenge.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent" />

        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <ChallengeStatusBadge status={getDisplayStatus(challenge)} />
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-white">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-slate-200 truncate drop-shadow-xs">{orgName}</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            <Link to={detailHref}>{challenge.title}</Link>
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {challenge.summary || challenge.description}
          </p>
        </div>

        <div className="space-y-3 pt-2 border-t border-border/50">
          {deadline && (
            <div className="flex items-center justify-end text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1 font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{new Date(deadline).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-2">
          <Link
            to={detailHref}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-secondary/80 text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <span>Explore Challenge</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
