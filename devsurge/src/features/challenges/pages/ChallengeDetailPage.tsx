import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Share2,
  FileCheck2,
  Megaphone,
  Layers,
  AlertTriangle,
  XCircle,
  Undo2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  useOrgChallenge,
  usePublicChallengeTracks,
  usePublicChallengeAnnouncements,
} from "@/features/challenges/api/queries";
import { usePublicOrganization } from "@/features/organizations/api/queries";
import { useChallengeParticipationFlow } from "@/features/challenges/hooks/useChallengeParticipationFlow";
import { useTeams } from "@/features/teams/api/queries";
import { useMySubmission } from "@/features/submissions/api/queries";
import { useAssetUrl } from "@/lib/assetUrl";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";
import { getDisplayStatus } from "@/lib/challengeStatus";
import { PageContainer } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/feedback/EmptyState";
import { DynamicFormRenderer } from "@/components/forms/DynamicFormRenderer";
import { toast } from "sonner";

export function ChallengeDetailPage() {
  const { organizationSlug = "", challengeId = "" } = useParams<{ organizationSlug: string; challengeId: string }>();
  const navigate = useNavigate();

  const { data: organization } = usePublicOrganization(organizationSlug);
  const organizationId = organization?.id || "";
  const { data: challenge, isLoading } = useOrgChallenge(organizationId, challengeId);
  const { data: tracks = [] } = usePublicChallengeTracks(organizationSlug, challenge?.slug || "");
  const { data: announcements = [] } = usePublicChallengeAnnouncements(organizationSlug, challenge?.slug || "");
  const { data: teams = [] } = useTeams(organizationId, challengeId);
  const { data: mySubmission } = useMySubmission(organizationId, challengeId);
  const { url: coverUrl } = useAssetUrl(challenge?.coverAssetId, "public");

  const {
    participation,
    applicationForm,
    registerMutation,
    submitApplicationMutation,
    withdrawMutation,
    applicationDialogOpen,
    setApplicationDialogOpen,
    withdrawDialogOpen,
    setWithdrawDialogOpen,
    handleRegister,
    handleSubmitApplication,
    handleConfirmWithdraw,
  } = useChallengeParticipationFlow(organizationId, challengeId);

  if (isLoading || !organization) {
    return (
      <PageContainer>
        <div className="py-20 text-center text-xs text-muted-foreground">Loading challenge...</div>
      </PageContainer>
    );
  }

  if (!challenge) {
    return (
      <PageContainer>
        <EmptyState
          title="Challenge Not Found"
          description="The requested challenge could not be loaded or may have been archived."
          action={{ label: "Back to Explore", onClick: () => navigate("/app/challenges") }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      {/* Top Navigation & Quick Actions */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/challenges")} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Challenges</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              toast.success("Challenge link copied to clipboard.");
            }}
            className="text-xs h-8 gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </Button>

          {participation?.status === "APPROVED" && (
            <Button
              size="sm"
              onClick={() =>
                mySubmission
                  ? navigate(`/app/submissions/${mySubmission.id}/edit`)
                  : navigate(`/app/submissions/new?organizationId=${organizationId}&challengeId=${challengeId}`)
              }
              className="text-xs h-8 font-semibold gap-1.5"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>{mySubmission ? "Edit Submission" : "Start Submission"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Hero Banner Header */}
      <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm space-y-0">
        <div className="h-56 sm:h-72 relative bg-slate-950">
          <img src={coverUrl || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80"} alt={challenge.title} className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl text-white">
              <div className="flex items-center gap-2">
                <ChallengeStatusBadge status={getDisplayStatus(challenge)} />
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {organization.name}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">{challenge.title}</h1>
              <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">{challenge.summary}</p>
            </div>
          </div>
        </div>

        {/* Timeline & Metadata Strip */}
        <div className="p-4 bg-muted/40 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          {challenge.submissionDeadline && (
            <div>
              <div className="text-muted-foreground font-medium">Submissions Close</div>
              <div className="font-bold text-foreground mt-0.5">{new Date(challenge.submissionDeadline).toLocaleDateString()}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground font-medium">Team Size Allowed</div>
            <div className="font-bold text-foreground mt-0.5">
              {challenge.soloParticipationAllowed ? "Solo or " : ""}
              {challenge.minTeamSize}-{challenge.maxTeamSize}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground font-medium">Screening Policy</div>
            <div className="font-bold text-foreground mt-0.5">
              {challenge.screeningRequired ? "Application Required" : "Instant Enrollment"}
            </div>
          </div>
        </div>
      </div>

      {/* PARTICIPATION LIFECYCLE BAR */}
      <div className="rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card">
        {!participation || participation.status === "WITHDRAWN" ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{participation ? "Withdrawn" : "Not Registered"}</Badge>
                <h3 className="text-sm font-bold text-foreground">
                  {participation ? "You withdrew from this challenge" : "You have not registered for this challenge yet"}
                </h3>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleRegister}
              disabled={registerMutation.isPending || submitApplicationMutation.isPending}
              className="text-xs font-semibold gap-1.5 shrink-0"
            >
              {participation ? <Undo2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{challenge.screeningRequired ? "Submit Application" : participation ? "Re-register" : "Register"}</span>
            </Button>
          </div>
        ) : participation.status === "PENDING" ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full bg-amber-500/5 -m-1 p-3 rounded-lg border border-amber-500/20">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-600">
                <Clock className="h-3.5 w-3.5" />
                Application Under Review
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setWithdrawDialogOpen(true)} className="text-xs h-8 text-destructive hover:bg-destructive/10">
              <span>Withdraw Application</span>
            </Button>
          </div>
        ) : participation.status === "APPROVED" ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Registered
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => navigate("/app/teams")} className="text-xs h-8 gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>Teams & Matchmaking</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setWithdrawDialogOpen(true)} className="text-xs h-8 text-muted-foreground hover:text-destructive">
                <span>Withdraw</span>
              </Button>
            </div>
          </div>
        ) : participation.status === "REJECTED" ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full bg-rose-500/5 -m-1 p-3 rounded-lg border border-rose-500/20">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600">
                <XCircle className="h-3.5 w-3.5" />
                Application Not Accepted
              </span>
              {participation.decisionReason && <p className="text-xs text-muted-foreground">{participation.decisionReason}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/app/support")} className="text-xs h-8 shrink-0">
              <span>Contact Support</span>
            </Button>
          </div>
        ) : (
          <Badge variant="secondary" className="text-xs">Disqualified</Badge>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 h-auto rounded-none gap-6">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 text-xs font-bold">
            Overview
          </TabsTrigger>
          {tracks.length > 0 && (
            <TabsTrigger value="tracks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 text-xs font-bold">
              Tracks ({tracks.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="teams" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 text-xs font-bold">
            Teams ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="announcements" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 text-xs font-bold">
            Announcements ({announcements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="border-border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold text-foreground">Challenge Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {challenge.description}
            </CardContent>
          </Card>
        </TabsContent>

        {tracks.length > 0 && (
          <TabsContent value="tracks" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tracks.map((track) => (
                <Card key={track.id} className="border-border">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      {track.name}
                    </CardTitle>
                  </CardHeader>
                  {track.description && (
                    <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">{track.description}</CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="teams" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Teams</h3>
              <p className="text-xs text-muted-foreground">Teams formed for this challenge</p>
            </div>
            <Button size="sm" onClick={() => navigate("/app/teams")} className="text-xs font-semibold gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>Matchmaking & Team Finder</span>
            </Button>
          </div>

          {teams.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">No teams formed yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {teams.map((team) => (
                <Card key={team.id} className="border-border">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold text-foreground">{team.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{team.members.length} member{team.members.length === 1 ? "" : "s"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/app/teams/${team.id}?organizationId=${organizationId}&challengeId=${challengeId}`)} className="w-full text-xs h-8">
                      <span>View Roster</span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">No official announcements posted yet.</div>
          ) : (
            announcements.map((ann: any) => (
              <Card key={ann.id} className="border-border">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Megaphone className="h-3.5 w-3.5 text-primary" />
                    {ann.title}
                  </CardTitle>
                  {ann.publishedAt && <span className="text-[11px] text-muted-foreground">{new Date(ann.publishedAt).toLocaleDateString()}</span>}
                </CardHeader>
                <CardContent className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed">{ann.body}</CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Withdrawal Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Confirm Challenge Withdrawal</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to withdraw from <strong>{challenge.title}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setWithdrawDialogOpen(false)} className="text-xs">
              Keep Registration
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleConfirmWithdraw} disabled={withdrawMutation.isPending} className="text-xs font-semibold">
              Yes, Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screening Application Dialog */}
      <Dialog open={applicationDialogOpen} onOpenChange={setApplicationDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Screening Application</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This challenge requires organizer approval. Complete the application below to be considered.
            </DialogDescription>
          </DialogHeader>

          {applicationForm === null || applicationForm === undefined ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              This challenge's screening application isn't configured yet — please check back later or contact the organizer.
            </div>
          ) : (
            <DynamicFormRenderer
              schema={{ fields: applicationForm.fields }}
              onSubmit={handleSubmitApplication}
              submitLabel="Submit Application"
              isSubmitting={submitApplicationMutation.isPending}
              onCancel={() => setApplicationDialogOpen(false)}
              organizationId={organizationId}
              formDefinitionId={applicationForm.formDefinitionId}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
