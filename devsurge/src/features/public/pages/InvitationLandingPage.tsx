import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { Building2, CheckCircle2, ArrowRight, XCircle, Mail } from "lucide-react";
import { useAcceptInvitation, useDeclineInvitation } from "../api/queries";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The backend has no invitation-preview-by-token endpoint — only blind
 * accept/decline actions (`POST /invitations/:token/accept|decline`). There
 * is no organization name, inviter, or role to show before the user
 * decides; the accept response only returns `{organizationId,
 * organizationSlug}` once it succeeds.
 */
export function InvitationLandingPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading } = useAuth();

  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const [outcome, setOutcome] = React.useState<
    | { type: "accepted"; organizationSlug: string }
    | { type: "declined" }
    | { type: "error"; message: string }
    | null
  >(null);

  const handleAccept = () => {
    acceptMutation.mutate(token, {
      onSuccess: (res: any) => setOutcome({ type: "accepted", organizationSlug: res.organizationSlug }),
      onError: (err: any) => setOutcome({ type: "error", message: err?.message || "Could not accept this invitation." }),
    });
  };

  const handleDecline = () => {
    declineMutation.mutate(token, {
      onSuccess: () => setOutcome({ type: "declined" }),
      onError: (err: any) => setOutcome({ type: "error", message: err?.message || "Could not decline this invitation." }),
    });
  };

  if (outcome?.type === "accepted") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Invitation Accepted</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">You've joined the organization.</p>
        <Button asChild className="gap-2">
          <Link to="/app">
            <span>Go to My Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  if (outcome?.type === "declined") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
          <XCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Invitation Declined</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Return to Homepage</Link>
        </Button>
      </div>
    );
  }

  if (outcome?.type === "error") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <XCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Invitation Could Not Be Processed</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">{outcome.message}</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Return to Homepage</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-8 text-foreground">
      <Card className="p-8 rounded-3xl border border-border/80 bg-card space-y-6 shadow-md text-center">
        <div className="space-y-3 pb-6 border-b border-border/60">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Mail className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Organization Invitation</span>
            <h1 className="text-2xl font-extrabold text-foreground">You've Been Invited</h1>
            <p className="text-xs text-muted-foreground">Accept to join the organization that sent this invitation.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-10 rounded-md bg-muted/40 animate-pulse" />
        ) : isAuthenticated ? (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button onClick={handleAccept} className="w-full sm:flex-1 h-10 font-bold text-xs gap-2" disabled={acceptMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              <span>{acceptMutation.isPending ? "Joining..." : "Accept & Join"}</span>
            </Button>
            <Button variant="outline" onClick={handleDecline} className="w-full sm:w-auto h-10 text-xs font-semibold text-muted-foreground hover:text-destructive" disabled={declineMutation.isPending}>
              <span>Decline</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button asChild className="w-full h-10 font-bold text-xs gap-2">
              <Link to={`/auth/signup?inviteToken=${token}&returnTo=${encodeURIComponent(`/invitations/${token}`)}`}>
                <span>Create Account to Accept</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-10 text-xs font-semibold">
              <Link to={`/auth/signin?returnTo=${encodeURIComponent(`/invitations/${token}`)}`}>
                <span>Sign In to Accept</span>
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
