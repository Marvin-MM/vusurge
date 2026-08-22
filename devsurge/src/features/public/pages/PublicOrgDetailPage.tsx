import * as React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Building2, Trophy, Shield, ArrowRight, KeyRound, FolderGit2 } from "lucide-react";
import {
  usePublicOrganization,
  usePublicOrganizationInnovations,
  usePublicOrganizationProjects,
} from "@/features/organizations/api/queries";
import { usePublicOrganizationChallenges } from "@/features/challenges/api/queries";
import { PublicChallengeCard } from "@/components/shared/PublicChallengeCard";
import { InnovationCard } from "@/components/shared/InnovationCard";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { useAssetUrl } from "@/lib/assetUrl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportContentDialog } from "@/components/shared/ReportContentDialog";
import { JoinCodeRedemptionDialog } from "@/components/shared/JoinCodeRedemptionDialog";
import { useAuth } from "@/context/AuthContext";

export function PublicOrgDetailPage() {
  const { organizationSlug = "" } = useParams<{ organizationSlug: string }>();
  const navigate = useNavigate();
  const { data: organization, isLoading } = usePublicOrganization(organizationSlug);
  const { isAuthenticated, memberships } = useAuth();
  const [joinCodeDialogOpen, setJoinCodeDialogOpen] = React.useState(false);
  // A join code exists to get a NEW member in — showing it to someone who is
  // already a member of this exact org is dead UI at best and confusing at
  // worst (it implies they aren't a member yet).
  const isAlreadyMember = isAuthenticated && memberships.some((m) => m.organizationSlug === organizationSlug);

  const handleJoinCodeClick = () => {
    if (isAuthenticated) {
      setJoinCodeDialogOpen(true);
    } else {
      navigate(`/auth/signin?returnTo=${encodeURIComponent(`/organizations/${organizationSlug}`)}`);
    }
  };
  const {
    items: orgChallenges,
    hasMore: hasMoreChallenges,
    loadMore: loadMoreChallenges,
    isLoadingMore: isLoadingMoreChallenges,
  } = usePublicOrganizationChallenges(organizationSlug);
  const { items: orgInnovations } = usePublicOrganizationInnovations(organizationSlug);
  const { items: orgProjects } = usePublicOrganizationProjects(organizationSlug);
  const { url: logoUrl } = useAssetUrl(organization?.logoAssetId, "public");

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-8 animate-pulse">
        <div className="h-48 rounded-3xl bg-muted/40" />
        <div className="h-8 w-1/4 bg-muted/40 rounded-md" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
          <Building2 className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Organization Not Found</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The requested organization profile does not exist or may be set to private visibility.
        </p>
        <Button asChild variant="outline">
          <Link to="/organizations">Back to Organizations Directory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24 text-foreground">
      {/* 1. Header Banner & Profile Card */}
      <div className="relative bg-card border-b border-border/80 pb-8">
        <div className="h-40 sm:h-56 w-full bg-slate-900" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex items-end gap-4">
              {/* Only the logo overlaps the dark banner (standard avatar
                  pattern) — its own border/background stays visible
                  regardless of theme. The name/metadata text deliberately
                  stays in normal flow below the banner: it previously shared
                  the same -mt-16/-mt-20 pull-up as the logo, so `text-foreground`
                  (dark in light mode) rendered directly on top of the dark
                  banner and was effectively unreadable. */}
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={organization.name}
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-cover border-4 border-card bg-card shadow-md shrink-0 -mt-16 sm:-mt-20 relative z-10"
                />
              ) : (
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-2xl border-4 border-card bg-card shadow-md shrink-0 -mt-16 sm:-mt-20 relative z-10">
                  {organization.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="space-y-1 pb-1">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground">{organization.name}</h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                  <span>{organization.organizationType}</span>
                  {organization.region && (
                    <>
                      <span>•</span>
                      <span>{organization.region}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Only meaningful for a visitor who isn't already a member of
                  THIS org — showing it to an existing member implies they
                  haven't joined yet, which is both confusing and pointless. */}
              {!isAlreadyMember && (
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleJoinCodeClick}>
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>Enter Org Join Code</span>
                </Button>
              )}
              <ReportContentDialog
                targetType="ORGANIZATION"
                targetId={organization.id}
                targetLabel={organization.name}
              />
            </div>
          </div>

          {organization.description && (
            <div className="mt-6 max-w-4xl space-y-4">
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{organization.description}</p>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/60">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Hosted Challenges</div>
              <div className="text-xl font-bold text-foreground font-mono mt-0.5">{orgChallenges.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Incubated Ventures</div>
              <div className="text-xl font-bold text-foreground font-mono mt-0.5">{orgInnovations.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Published Projects</div>
              <div className="text-xl font-bold text-foreground font-mono mt-0.5">{orgProjects.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Public Challenges Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Challenges Hosted by {organization.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explore past and active challenges organized by this entity.
          </p>
        </div>

        {orgChallenges.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-2xl space-y-2">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
            <div className="text-sm font-bold text-foreground">No public challenges yet</div>
            <div className="text-xs text-muted-foreground">
              This organization has not published any public challenges at this time.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orgChallenges.map((chal) => (
                <PublicChallengeCard key={chal.id} challenge={chal} layout="grid" />
              ))}
            </div>
            <LoadMoreButton hasMore={hasMoreChallenges} isLoadingMore={isLoadingMoreChallenges} onClick={loadMoreChallenges} />
          </>
        )}
      </div>

      {/* 3. Incubated Ventures Section (if any) */}
      {orgInnovations.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Incubated Venture Portfolio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Spin-out ventures and pilot technologies born from {organization.name}'s challenges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {orgInnovations.map((item) => (
              <InnovationCard key={item.id} item={item} showOrganization={false} />
            ))}
          </div>
        </div>
      )}

      {/* 4. Published Projects Section (if any) */}
      {orgProjects.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-primary" />
              Published Challenge Projects
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Team submissions {organization.name} has opted to showcase publicly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {orgProjects.map((project) => (
              <Card key={project.id} className="p-5 rounded-2xl border border-border/80 bg-card space-y-3">
                <div className="text-[11px] text-muted-foreground font-medium">{project.challengeTitle}</div>
                <h3 className="text-sm font-bold text-foreground line-clamp-1">{project.title}</h3>
                {project.tagline && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{project.tagline}</p>
                )}
                {project.teamName && (
                  <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                    by {project.teamName}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 5. Join & Governance Policy Box — only relevant to a visitor who
          isn't already a member of THIS org. */}
      {!isAlreadyMember && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-6 rounded-2xl border border-border/80 bg-muted/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Shield className="h-4 w-4 text-primary" />
                <span>Institutional Membership Access</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you affiliated with {organization.name}? You can join this organization's workspace using an
                authorized invitation link or join code, depending on how they've configured membership.
              </p>
            </div>

            <Button className="gap-2 shrink-0" onClick={handleJoinCodeClick}>
              <span>Redeem Join Code</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      )}

      <JoinCodeRedemptionDialog open={joinCodeDialogOpen} onOpenChange={setJoinCodeDialogOpen} />
    </div>
  );
}
