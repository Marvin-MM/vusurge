import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy, Users, Plus, ArrowRight, Clock, ChevronRight, Sparkles, Layers, BarChart3, Activity, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { StatCard } from "@/components/shared/StatCard";
import { useOrganization, useOrganizationMembers } from "@/features/organizations/api/queries";
import { useOrgChallenges, useOrgAuditEvents } from "@/features/org-admin/api/queries";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";
import { getDisplayStatus } from "@/lib/challengeStatus";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";

export function OrgDashboard() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { data: organization } = useOrganization(orgId);
  const { items: challenges } = useOrgChallenges(orgId);
  const { userContext } = useAuth();

  // Members and audit are org-governance data (CHALLENGE_MANAGER runs
  // challenges but doesn't govern the organization — see
  // backend/src/shared/authorization/roles.ts). Fetching them unconditionally
  // for every viewer 403s on the server for anyone below ORG_ADMIN and shows
  // a misleading "0" instead of "you can't see this," so both queries and
  // the widgets that display them are gated the same way the sidebar nav
  // already gates the Members/Audit pages.
  const canViewMembers = can(userContext, "organization.manage_members");
  const canViewAudit = can(userContext, "organization.view_audit");
  const { data: members = [] } = useOrganizationMembers(canViewMembers ? orgId : "");
  const { items: auditEvents } = useOrgAuditEvents(orgId, { enabled: canViewAudit });

  const openChallenges = challenges.filter((c) => c.status === "OPEN" || c.status === "JUDGING");

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={`${organization?.name || "Organization"} Workspace`}
        description="Monitor your challenges, members, and recent activity."
        actions={
          <div className="flex items-center gap-2">
            {can(userContext, "organization.manage_invitations") && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/org/${orgId}/invitations`)} className="text-xs h-8">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Invite Members
              </Button>
            )}
            {can(userContext, "challenge.create") && (
              <Button size="sm" onClick={() => navigate(`/org/${orgId}/challenges/new`)} className="text-xs font-semibold gap-1.5 h-8 shadow-xs">
                <Plus className="h-4 w-4" />
                <span>New Challenge</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Challenges" value={challenges.length} icon={Trophy} description={`${openChallenges.length} open or judging`} />
        {canViewMembers && (
          <StatCard title="Members" value={members.length} icon={Users} description="Organization members" />
        )}
        {canViewAudit && (
          <StatCard title="Recent Activity" value={auditEvents.length} icon={Activity} description="Recent audited actions" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border">
            <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold text-foreground">Challenges</CardTitle>
                <CardDescription className="text-xs mt-0.5">Challenges hosted by this organization.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/challenges`)} className="text-xs gap-1 text-primary hover:text-primary">
                <span>Manage All</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {challenges.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-xl bg-muted/20">
                  <Trophy className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-xs text-muted-foreground">No challenges yet.</p>
                  <Button size="sm" className="mt-3 text-xs" onClick={() => navigate(`/org/${orgId}/challenges/new`)}>
                    Create Your First Challenge
                  </Button>
                </div>
              ) : (
                challenges.slice(0, 5).map((c) => (
                  <div key={c.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <ChallengeStatusBadge status={getDisplayStatus(c)} />
                        <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
                        {c.summary && <p className="text-xs text-muted-foreground line-clamp-1">{c.summary}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/org/${orgId}/challenges/${c.id}/edit`)} className="text-xs h-8">
                          Edit
                        </Button>
                        <Button size="sm" onClick={() => navigate(`/org/${orgId}/challenges/${c.id}/participants`)} className="text-xs h-8 font-semibold shadow-2xs">
                          Participants
                        </Button>
                      </div>
                    </div>
                    {c.submissionDeadline && (
                      <div className="pt-2 border-t border-border/50 flex items-center gap-2 text-xs">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-muted-foreground">Deadline:</span>
                        <span className="font-semibold text-foreground">{new Date(c.submissionDeadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border">
            <CardHeader className="p-5 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground">Operational Workspaces</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2">
              {[
                { icon: UserCheck, label: "Participant Screening", path: "participants" },
                { icon: Users, label: "Team Oversight", path: "teams" },
                { icon: Sparkles, label: "Announcements", path: "announcements" },
                { icon: Layers, label: "Innovation Portfolio", path: "portfolio" },
                { icon: BarChart3, label: "Exports", path: "exports" },
              ].map((item) => (
                <Button key={item.path} variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/${item.path}`)} className="w-full justify-between text-xs h-9 text-foreground hover:bg-muted font-medium">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-primary" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/audit`)} className="text-[11px] h-6 px-1.5 text-muted-foreground hover:text-foreground">
                Full Log
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {auditEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent activity.</p>
              ) : (
                auditEvents.slice(0, 5).map((ev) => (
                  <div key={ev.id} className="text-xs space-y-1 pb-2 border-b border-border/40 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{ev.summary}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{ev.action}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
