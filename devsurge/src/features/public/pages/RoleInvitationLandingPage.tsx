import * as React from "react";
import { ArrowRight, CheckCircle2, Gavel, Users, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import {
  useAcceptStaffInvitation,
  useAcceptTeamInvitation,
  useDeclineStaffInvitation,
  useDeclineTeamInvitation,
} from "@/features/public/api/queries";

export function RoleInvitationLandingPage({ kind }: { kind: "team" | "staff" }) {
  const { token = "" } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading } = useAuth();
  const acceptTeam = useAcceptTeamInvitation();
  const declineTeam = useDeclineTeamInvitation();
  const acceptStaff = useAcceptStaffInvitation();
  const declineStaff = useDeclineStaffInvitation();
  const [outcome, setOutcome] = React.useState<
    { type: "accepted"; role?: "JUDGE" | "MENTOR" } | { type: "declined" } | { type: "error"; message: string } | null
  >(null);

  const accept = kind === "team" ? acceptTeam : acceptStaff;
  const decline = kind === "team" ? declineTeam : declineStaff;
  const destination = outcome?.type === "accepted" && outcome.role === "JUDGE" ? "/judge" : kind === "team" ? "/app/teams" : "/app";
  const returnTo = `/${kind === "team" ? "team-invitations" : "challenge-staff-invitations"}/${token}/accept`;
  const Icon = kind === "team" ? Users : Gavel;
  const label = kind === "team" ? "Team Invitation" : "Challenge Staff Invitation";

  const handleAccept = () => {
    accept.mutate(token, {
      onSuccess: (result: any) => setOutcome({ type: "accepted", role: result?.role }),
      onError: (error: any) => setOutcome({ type: "error", message: error?.message || "Could not accept this invitation." }),
    });
  };

  const handleDecline = () => {
    decline.mutate(token, {
      onSuccess: () => setOutcome({ type: "declined" }),
      onError: (error: any) => setOutcome({ type: "error", message: error?.message || "Could not decline this invitation." }),
    });
  };

  if (outcome) {
    const accepted = outcome.type === "accepted";
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mx-auto ${accepted ? "bg-emerald-500/10 text-emerald-600" : outcome.type === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {accepted ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {accepted ? "Invitation Accepted" : outcome.type === "declined" ? "Invitation Declined" : "Invitation Could Not Be Processed"}
        </h2>
        {outcome.type === "error" && <p className="text-xs text-muted-foreground">{outcome.message}</p>}
        <Button asChild variant={accepted ? "default" : "outline"}>
          <Link to={accepted ? destination : "/"}>{accepted ? "Continue" : "Return Home"}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-foreground">
      <Card className="p-8 rounded-3xl border-border space-y-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{label}</span>
          <h1 className="text-2xl font-extrabold">You've Been Invited</h1>
          <p className="text-xs text-muted-foreground">Sign in with the invited account, then accept or decline.</p>
        </div>
        {isLoading ? (
          <div className="h-10 rounded-md bg-muted/40 animate-pulse" />
        ) : isAuthenticated ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleAccept} disabled={accept.isPending || !token} className="flex-1 gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {accept.isPending ? "Accepting..." : "Accept Invitation"}
            </Button>
            <Button variant="outline" onClick={handleDecline} disabled={decline.isPending || !token}>Decline</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button asChild className="w-full gap-2">
              <Link to={`/auth/signup?returnTo=${encodeURIComponent(returnTo)}`}>Create Account <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to={`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`}>Sign In</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
