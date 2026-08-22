import * as React from "react";
import { Link } from "react-router-dom";
import { Calendar, Building2, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { Challenge } from "@/types";
import { Button } from "@/components/ui/button";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";
import { getDisplayStatus } from "@/lib/challengeStatus";
import { useAssetUrl } from "@/lib/assetUrl";

export interface FeaturedChallengeCardProps {
  challenge: Challenge;
}

export function FeaturedChallengeCard({ challenge }: FeaturedChallengeCardProps) {
  const orgName = challenge.organizationName;
  const detailHref = `/challenges/${challenge.organizationSlug}/${challenge.slug}`;
  const { url: coverUrl } = useAssetUrl(challenge.coverAssetId, "public");

  return (
    <div className="relative rounded-3xl overflow-hidden border border-border/80 bg-card shadow-md">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
        {/* Left Visual Area */}
        <div className="lg:col-span-5 relative bg-slate-950 overflow-hidden min-h-[240px] lg:min-h-full">
          <img
            src={coverUrl || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80"}
            alt={challenge.title}
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-black/30 lg:bg-linear-to-r lg:from-transparent lg:to-card" />

          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Featured Challenge
            </span>
            <ChallengeStatusBadge status={getDisplayStatus(challenge)} />
          </div>

          {challenge.registrationCloseAt && (
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10">
                <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Registration Ends
                </div>
                <div className="text-xs font-bold text-slate-100 font-mono">
                  {new Date(challenge.registrationCloseAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Info Area */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {orgName && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">{orgName}</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs font-medium text-muted-foreground">
                Team Size: {challenge.minTeamSize}-{challenge.maxTeamSize} Innovators
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              <Link to={detailHref} className="hover:text-primary transition-colors">
                {challenge.title}
              </Link>
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {challenge.description || challenge.summary}
            </p>
          </div>

          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {challenge.submissionDeadline && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Submissions close {new Date(challenge.submissionDeadline).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Verified Rubrics</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button asChild className="gap-2 font-semibold">
                <Link to={detailHref}>
                  <span>View Details & Register</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
