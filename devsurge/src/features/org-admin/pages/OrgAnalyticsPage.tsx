import * as React from "react";
import { useParams } from "react-router-dom";
import { BarChart3, Users, FileCheck2, Award, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { StatCard } from "@/components/shared/StatCard";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import {
  useOrgAnalyticsOverview,
  useOrgChallengeAnalytics,
  useOrgPortfolioAnalytics,
  useChallengeAnalyticsDeepDive,
  OrgChallengeAnalytics,
} from "@/features/org-admin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";

function ChallengeAnalyticsRow({ orgId, challenge }: { orgId: string; challenge: OrgChallengeAnalytics }) {
  const [expanded, setExpanded] = React.useState(false);
  const { data: deepDive } = useChallengeAnalyticsDeepDive(orgId, challenge.challengeId);

  return (
    <div>
      <div
        onClick={() => setExpanded((v) => !v)}
        className="p-4 flex items-center justify-between gap-4 text-xs cursor-pointer hover:bg-accent/30"
      >
        <span className="font-bold text-foreground flex items-center gap-1.5">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {challenge.title}
        </span>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>{challenge.registrations} registered</span>
          <span>{challenge.approvedParticipants} approved</span>
          <span>{challenge.finalSubmissions} submitted</span>
          <span>{(challenge.judgingCompletion * 100).toFixed(0)}% judged</span>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 bg-muted/20">
          {!deepDive ? (
            <div className="text-xs text-muted-foreground py-2">Loading details...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-background border border-border/60">
                <div className="font-bold text-foreground">{deepDive.activeTeams}</div>
                <div className="text-muted-foreground">Active teams</div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border/60">
                <div className="font-bold text-foreground">{deepDive.submissionsStarted}</div>
                <div className="text-muted-foreground">Drafts started</div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border/60">
                <div className="font-bold text-foreground">{deepDive.finalistCount}</div>
                <div className="text-muted-foreground">Finalists</div>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border/60">
                <div className="font-bold text-foreground">
                  {deepDive.averageScoringTurnaroundHours != null ? `${deepDive.averageScoringTurnaroundHours.toFixed(1)}h` : "—"}
                </div>
                <div className="text-muted-foreground">Avg scoring turnaround</div>
              </div>
              {deepDive.submissionsPerTrack.length > 0 && (
                <div className="col-span-2 sm:col-span-4 p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground mb-1.5">Submissions per track</div>
                  <div className="flex flex-wrap gap-2">
                    {deepDive.submissionsPerTrack.map((t) => (
                      <span key={t.trackId ?? "none"} className="px-2 py-1 rounded bg-muted text-foreground font-medium">
                        {t.trackName ?? "No track"}: {t.submissions}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {deepDive.topTechnologyTags.length > 0 && (
                <div className="col-span-2 sm:col-span-4 p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground mb-1.5">Top technology tags</div>
                  <div className="flex flex-wrap gap-2">
                    {deepDive.topTechnologyTags.map((t) => (
                      <span key={t.tag} className="px-2 py-1 rounded bg-muted text-foreground font-medium">{t.tag} ({t.count})</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrgAnalyticsPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { userContext } = useAuth();
  const canViewAnalytics = can(userContext, "analytics.view_org");
  const { data: overview } = useOrgAnalyticsOverview(orgId, { enabled: canViewAnalytics });
  const { data: challengeStats = [] } = useOrgChallengeAnalytics(orgId, { enabled: canViewAnalytics });
  const { data: portfolio } = useOrgPortfolioAnalytics(orgId, { enabled: canViewAnalytics });

  return (
    <OrgAccessGuard permission="analytics.view_org" title="Analytics Restricted" description="You require Organization Admin privileges to view analytics.">
      <PageContainer className="space-y-6">
        <PageHeader title="Analytics" description="Aggregate metrics across your organization's challenges." />

        {overview && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Members" value={overview.members} icon={Users} description="Total organization members" />
            <StatCard title="Registrations" value={overview.registrations} icon={FileCheck2} description={`${overview.approvedParticipants} approved`} />
            <StatCard title="Final Submissions" value={overview.finalSubmissions} icon={Award} description={`${(overview.completionRate * 100).toFixed(0)}% completion rate`} />
            <StatCard title="Judging Completion" value={`${(overview.judgingCompletion * 100).toFixed(0)}%`} icon={TrendingUp} description={`${overview.winnerCount} winners selected`} />
          </div>
        )}

        {overview && overview.topTechnologyTags.length > 0 && (
          <Card className="border-border">
            <CardHeader className="p-5 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Top Technology Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-wrap gap-2">
              {overview.topTechnologyTags.map((t) => (
                <span key={t.tag} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                  {t.tag} <span className="font-bold text-foreground">({t.count})</span>
                </span>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardHeader className="p-5 border-b border-border/60">
            <CardTitle className="text-sm font-bold">By Challenge</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {challengeStats.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No challenge data yet.</div>
            ) : (
              challengeStats.map((c) => <ChallengeAnalyticsRow key={c.challengeId} orgId={orgId} challenge={c} />)
            )}
          </CardContent>
        </Card>

        {portfolio && (
          <Card className="border-border">
            <CardHeader className="p-5 border-b border-border/60">
              <CardTitle className="text-sm font-bold">Innovation Portfolio</CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="text-xl font-bold text-foreground">{portfolio.totalInnovations}</div>
                <div className="text-muted-foreground">Total</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="text-xl font-bold text-foreground">{(portfolio.portfolioConversionRate * 100).toFixed(0)}%</div>
                <div className="text-muted-foreground">Conversion Rate</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="text-xl font-bold text-foreground">{portfolio.activeMilestones}</div>
                <div className="text-muted-foreground">Active Milestones</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="text-xl font-bold text-destructive">{portfolio.overdueMilestones}</div>
                <div className="text-muted-foreground">Overdue</div>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </OrgAccessGuard>
  );
}
