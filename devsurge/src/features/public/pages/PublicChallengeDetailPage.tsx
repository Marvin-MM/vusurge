import * as React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Trophy,
  Building2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Layers,
  FileText,
  HelpCircle,
  Megaphone,
  Award,
  Share2,
  Check,
  Medal,
  Clock,
  XCircle,
  Undo2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  usePublicChallenge,
  usePublicChallengeTracks,
  usePublicChallengeFaqs,
  usePublicChallengeAnnouncements,
  usePublicChallengeResults,
} from "@/features/challenges/api/queries";
import { usePublicOrganization } from "@/features/organizations/api/queries";
import { useChallengeParticipationFlow } from "@/features/challenges/hooks/useChallengeParticipationFlow";
import { useAuth } from "@/context/AuthContext";
import { useAssetUrl } from "@/lib/assetUrl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";
import { getDisplayStatus } from "@/lib/challengeStatus";
import { ChallengeTimeline } from "@/components/shared/ChallengeTimeline";
import { FAQList } from "@/components/shared/FAQList";
import { ReportContentDialog } from "@/components/shared/ReportContentDialog";
import { DynamicFormRenderer } from "@/components/forms/DynamicFormRenderer";

export function PublicChallengeDetailPage() {
  const { organizationSlug = "", challengeSlug = "" } = useParams<{
    organizationSlug: string;
    challengeSlug: string;
  }>();
  const navigate = useNavigate();
  const { user, memberships } = useAuth();
  const isMember = memberships.some((m) => m.organizationSlug === organizationSlug);

  const { data: challenge, isLoading } = usePublicChallenge(organizationSlug, challengeSlug);
  const { data: organization } = usePublicOrganization(organizationSlug);
  const { data: tracks = [] } = usePublicChallengeTracks(organizationSlug, challengeSlug);
  const { data: faqs = [] } = usePublicChallengeFaqs(organizationSlug, challengeSlug);
  const { data: announcements = [] } = usePublicChallengeAnnouncements(organizationSlug, challengeSlug);
  const { data: results = [] } = usePublicChallengeResults(organizationSlug, challengeSlug);
  const { url: coverUrl } = useAssetUrl(challenge?.coverAssetId, "public");

  // Empty organizationId keeps the underlying hooks' own `enabled` guard off
  // until we actually have a signed-in user and a resolved org id — avoids
  // firing authenticated requests (and their console-logged 401s) for
  // anonymous visitors or before the org lookup resolves.
  const participationOrgId = user && organization ? organization.id : "";
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
  } = useChallengeParticipationFlow(participationOrgId, challenge?.id || "");

  const [activeTab, setActiveTab] = React.useState<
    "overview" | "tracks" | "faq" | "announcements" | "results"
  >("overview");
  const [copied, setCopied] = React.useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-8 animate-pulse">
        <div className="h-64 rounded-3xl bg-muted/40" />
        <div className="h-8 w-1/3 bg-muted/40 rounded-md" />
        <div className="h-4 w-2/3 bg-muted/40 rounded-md" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
          <Trophy className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Challenge Not Found</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The requested challenge does not exist, may have been archived, or is not publicly visible.
        </p>
        <Button asChild variant="outline">
          <Link to="/challenges">Back to Challenges Directory</Link>
        </Button>
      </div>
    );
  }

  const isCompleted = challenge.status === "RESULTS_PUBLISHED";

  return (
    <div className="space-y-8 pb-20 text-foreground">
      {/* 1. Header Banner & Hero Canvas */}
      <div className="relative bg-slate-950 text-white overflow-hidden border-b border-border/80">
        <div className="absolute inset-0 z-0">
          <img
            src={coverUrl || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80"}
            alt={challenge.title}
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Link to="/challenges" className="hover:text-white transition-colors">
                Challenges
              </Link>
              <span>/</span>
              <span className="text-slate-100 font-semibold truncate max-w-[240px]">{challenge.title}</span>
            </div>

            <div className="flex items-center gap-2">
              <ChallengeStatusBadge status={getDisplayStatus(challenge)} />
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                className="h-7 text-xs gap-1.5 bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                <span>{copied ? "Link Copied" : "Share"}</span>
              </Button>
              <ReportContentDialog
                targetType="CHALLENGE"
                targetId={challenge.id}
                targetLabel="this challenge"
                triggerClassName="h-7 bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
              />
            </div>
          </div>

          <div className="space-y-4 max-w-4xl">
            {challenge.organizationName && (
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-primary" />
                <Link
                  to={`/organizations/${challenge.organizationSlug}`}
                  className="text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition-colors underline-offset-4 hover:underline"
                >
                  Hosted by {challenge.organizationName}
                </Link>
              </div>
            )}

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              {challenge.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
              {challenge.summary || challenge.description}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-xs border border-white/10">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Team Size Rules</div>
              <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                {challenge.soloParticipationAllowed
                  ? `Solo or ${challenge.minTeamSize}-${challenge.maxTeamSize}`
                  : `${challenge.minTeamSize}-${challenge.maxTeamSize} per team`}
              </div>
            </div>

            {challenge.submissionDeadline && (
              <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-xs border border-white/10">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Submission Deadline
                </div>
                <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {new Date(challenge.submissionDeadline).toLocaleDateString()}
                </div>
              </div>
            )}

            {tracks.length > 0 && (
              <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-xs border border-white/10">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tracks</div>
                <div className="text-base sm:text-lg font-bold text-white mt-0.5">{tracks.length} Available</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Content Grid & Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center gap-1.5 border-b border-border/80 overflow-x-auto pb-2 scrollbar-none">
              {[
                { id: "overview", label: "Overview", icon: FileText },
                ...(tracks.length > 0 ? [{ id: "tracks", label: `Tracks (${tracks.length})`, icon: Layers }] : []),
                { id: "faq", label: `FAQ (${faqs.length})`, icon: HelpCircle },
                { id: "announcements", label: `Announcements (${announcements.length})`, icon: Megaphone },
                ...(isCompleted || results.length > 0
                  ? [{ id: "results", label: "Results & Winners", icon: Award }]
                  : []),
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === "overview" && (
              <Card className="p-6 rounded-2xl border border-border/80 bg-card space-y-4">
                <h3 className="text-lg font-bold text-foreground">Challenge Overview</h3>
                <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {challenge.description || challenge.summary}
                </div>
              </Card>
            )}

            {activeTab === "tracks" && (
              <div className="grid grid-cols-1 gap-4">
                {tracks.map((track) => (
                  <Card key={track.id} className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
                    <span className="text-base font-bold text-foreground">{track.name}</span>
                    {track.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{track.description}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "faq" && <FAQList items={faqs} allowSearch />}

            {activeTab === "announcements" && (
              <div className="space-y-4">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                    No announcements posted yet. Check back during the active challenge phase.
                  </div>
                ) : (
                  announcements.map((ann: any) => (
                    <Card key={ann.id} className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">Organizer Broadcast</span>
                        {ann.publishedAt && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(ann.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-foreground">{ann.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{ann.body}</p>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div className="space-y-3">
                {results.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-2xl p-6">
                    <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-foreground">Official Results Pending</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Final rankings will be published once judging and the results audit period completes.
                    </p>
                  </div>
                ) : (
                  [...results]
                    .sort((a: any, b: any) => (a.rank ?? 999) - (b.rank ?? 999))
                    .map((result: any) => (
                      <Card
                        key={result.id}
                        className="p-4 rounded-xl border border-border/80 bg-card flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Medal className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-bold text-foreground">
                            {result.rankLabel || (result.rank ? `Rank #${result.rank}` : "Recognized")}
                          </span>
                        </div>
                        {result.aggregateScore != null && (
                          <span className="text-xs font-mono text-muted-foreground">
                            Score: {result.aggregateScore.toFixed(1)}
                          </span>
                        )}
                      </Card>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 rounded-2xl border-2 border-primary/30 bg-card space-y-5 shadow-xs">
              <div className="space-y-2 text-center">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Challenge Status
                </div>
                <div className="text-base font-black text-foreground">{challenge.status.replace("_", " ")}</div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60">
                {!user ? (
                  <>
                    <Button
                      className="w-full font-bold h-11 text-sm shadow-xs"
                      onClick={() =>
                        navigate(`/auth/signup?returnTo=${encodeURIComponent(`/challenges/${organizationSlug}/${challengeSlug}`)}`)
                      }
                    >
                      <span>Register as Innovator</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-xs font-semibold"
                      onClick={() =>
                        navigate(`/auth/signin?returnTo=${encodeURIComponent(`/challenges/${organizationSlug}/${challengeSlug}`)}`)
                      }
                    >
                      <span>Sign In to Your Account</span>
                    </Button>
                  </>
                ) : isMember || participation?.status === "APPROVED" ? (
                  <Button
                    className="w-full font-bold h-11 text-sm shadow-xs"
                    onClick={() => navigate(`/app/challenges/${organizationSlug}/${challenge.id}`)}
                  >
                    <span>Enter Innovator Workspace</span>
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : participation?.status === "PENDING" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Application Under Review</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWithdrawDialogOpen(true)}
                      className="w-full text-xs text-destructive hover:bg-destructive/10"
                    >
                      <span>Withdraw Application</span>
                    </Button>
                  </div>
                ) : participation?.status === "REJECTED" ? (
                  <div className="space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Application Not Accepted</span>
                    </div>
                    {participation.decisionReason && (
                      <p className="text-[11px] text-muted-foreground">{participation.decisionReason}</p>
                    )}
                  </div>
                ) : participation?.status === "DISQUALIFIED" ? (
                  <Badge variant="secondary" className="w-full justify-center text-xs py-1.5">
                    Disqualified
                  </Badge>
                ) : (
                  <Button
                    className="w-full font-bold h-11 text-sm shadow-xs gap-1.5"
                    onClick={handleRegister}
                    disabled={registerMutation.isPending || submitApplicationMutation.isPending}
                  >
                    {participation?.status === "WITHDRAWN" ? (
                      <Undo2 className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span>
                      {applicationForm
                        ? "Submit Application"
                        : participation?.status === "WITHDRAWN"
                          ? "Re-register"
                          : "Register as Innovator"}
                    </span>
                  </Button>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Free to participate. Retain 100% intellectual property ownership.
              </div>
            </Card>

            <Card className="p-6 rounded-2xl border border-border/80 bg-card">
              <ChallengeTimeline challenge={challenge} />
            </Card>

            {organization && (
              <Card className="p-6 rounded-2xl border border-border/80 bg-card space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Host Organization
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                    {organization.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-foreground truncate">{organization.name}</h4>
                    <p className="text-xs text-muted-foreground">{organization.organizationType}</p>
                  </div>
                </div>
                {organization.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {organization.description}
                  </p>
                )}
                <Button asChild variant="outline" size="sm" className="w-full text-xs">
                  <Link to={`/organizations/${organization.slug}`}>
                    <span>View Organization Profile</span>
                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Confirm Application Withdrawal</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to withdraw your application for <strong>{challenge.title}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setWithdrawDialogOpen(false)} className="text-xs">
              Keep Application
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
              organizationId={participationOrgId}
              formDefinitionId={applicationForm.formDefinitionId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
