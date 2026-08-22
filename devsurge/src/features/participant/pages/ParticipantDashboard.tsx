import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Trophy,
  Users,
  Bell,
  ArrowRight,
  Sparkles,
  PlusCircle,
  Building2,
  KeyRound,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/shared/PageContainer";
import { StatCard } from "@/components/shared/StatCard";
import { JoinCodeRedemptionDialog } from "@/components/shared/JoinCodeRedemptionDialog";
import { useAuth } from "@/context/AuthContext";
import { usePublicChallenges } from "@/features/challenges/api/queries";
import { useMyChallengeParticipations } from "@/features/participant/api/queries";
import { useUnreadNotificationCount } from "@/features/notifications/api/queries";

export function ParticipantDashboard() {
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const { data: myParticipations = [] } = useMyChallengeParticipations();
  const { items: publicChallenges } = usePublicChallenges();
  const { data: unreadData } = useUnreadNotificationCount();

  const [joinCodeDialogOpen, setJoinCodeDialogOpen] = React.useState(false);

  const isZeroOrgUser = memberships.length === 0;
  const activeParticipations = myParticipations.filter((p) => p.status === "APPROVED" || p.status === "PENDING");

  return (
    <PageContainer className="space-y-8">
      {/* 1. Welcome & Context Header */}
      <div className="rounded-2xl bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isZeroOrgUser ? "Individual Participant Workspace" : `${memberships.length} Organization${memberships.length === 1 ? "" : "s"}`}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Welcome back, {(user?.fullName || user?.email || "").split(" ")[0]}!
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isZeroOrgUser
              ? "Discover open public challenges, join organization cohorts, or build your own innovation challenge team."
              : `You are participating in ${activeParticipations.length} challenge${activeParticipations.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button size="sm" onClick={() => navigate("/app/challenges")} className="text-xs font-semibold gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            <span>Discover Challenges</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setJoinCodeDialogOpen(true)} className="text-xs font-medium gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            <span>Redeem Join Code</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/app/apply-organization")} className="text-xs font-medium gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span>Apply to Host</span>
          </Button>
        </div>
      </div>

      {/* ZERO-ORGANIZATION GUIDANCE */}
      {isZeroOrgUser && (
        <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-background text-primary text-[11px] font-bold border-primary/30">
                  Getting Started
                </Badge>
                <h2 className="text-sm font-bold text-foreground">You are exploring as an independent participant</h2>
              </div>
              <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                Without an organization membership, you can still register for any challenge open to authenticated
                users, form or join a team, and redeem an organization join code.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/app/organizations")} className="text-xs h-8 shrink-0 gap-1 self-start">
              <span>Explore Organizations</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button onClick={() => navigate("/app/challenges")} className="p-3.5 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-all group">
              <Trophy className="h-4 w-4 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="text-xs font-bold text-foreground">1. Browse Challenges</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">See what's open for registration</p>
            </button>
            <button onClick={() => navigate("/app/teams")} className="p-3.5 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-all group">
              <Users className="h-4 w-4 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="text-xs font-bold text-foreground">2. Find Teammates</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Post or browse matchmaking listings</p>
            </button>
            <button onClick={() => setJoinCodeDialogOpen(true)} className="p-3.5 rounded-lg border border-border bg-card hover:border-primary/50 text-left transition-all group">
              <KeyRound className="h-4 w-4 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="text-xs font-bold text-foreground">3. Have a Join Code?</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Redeem an organization invite code</p>
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="My Challenges"
          value={activeParticipations.length}
          icon={Trophy}
          description="Active participations"
        />
        <StatCard title="Organizations" value={memberships.length} icon={Building2} description="Memberships" />
        <StatCard title="Unread Alerts" value={unreadData?.count ?? 0} icon={Bell} description="Inbox messages" />
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Challenges / Discovery */}
          <Card className="border-border">
            <CardHeader className="p-5 flex flex-row items-center justify-between space-y-0 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  {activeParticipations.length > 0 ? "My Active Challenges" : "Featured Open Challenges"}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeParticipations.length > 0 ? "Challenges you're registered for" : "Open for registration right now"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(activeParticipations.length > 0 ? "/app/my-challenges" : "/app/challenges")} className="text-xs gap-1">
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {activeParticipations.length > 0
                ? activeParticipations.slice(0, 3).map((p) => (
                    <div key={p.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <Badge variant="outline" className="text-[10px] font-mono">{p.status}</Badge>
                        <h3 className="text-sm font-bold text-foreground truncate">{p.challengeTitle}</h3>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate("/app/my-challenges")} className="text-xs h-8 shrink-0">
                        <span>View</span>
                      </Button>
                    </div>
                  ))
                : publicChallenges.slice(0, 3).map((chal) => (
                    <div key={chal.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <span className="text-[11px] font-semibold text-primary">{chal.organizationName}</span>
                        <h3
                          onClick={() => navigate(`/challenges/${chal.organizationSlug}/${chal.slug}`)}
                          className="text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer truncate"
                        >
                          {chal.title}
                        </h3>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/challenges/${chal.organizationSlug}/${chal.slug}`)} className="text-xs h-8 shrink-0">
                        <span>View Challenge</span>
                      </Button>
                    </div>
                  ))}
              {activeParticipations.length === 0 && publicChallenges.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">No challenges available yet.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-foreground">Participant Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/app/teams")} className="w-full justify-between text-xs h-9">
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Browse Matchmaking Board</span>
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setJoinCodeDialogOpen(true)} className="w-full justify-between text-xs h-9">
                <span className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>Enter Organization Join-Code</span>
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/app/support")} className="w-full justify-between text-xs h-9">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Contact Support</span>
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-foreground">Host An Innovation Sprint?</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apply to create your own organization to publish and manage challenges.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/app/apply-organization")} className="w-full text-xs font-semibold gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Apply for Organization</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Join Code Dialog */}
      <JoinCodeRedemptionDialog open={joinCodeDialogOpen} onOpenChange={setJoinCodeDialogOpen} />
    </PageContainer>
  );
}
