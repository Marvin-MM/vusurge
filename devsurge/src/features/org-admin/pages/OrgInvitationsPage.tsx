import * as React from "react";
import { useParams } from "react-router-dom";
import {
  Mail,
  Copy,
  Check,
  UserPlus,
  Clock,
  Send,
  Trash2,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import {
  useOrgInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  useResendInvitation,
} from "@/features/org-admin/api/queries";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { OrgRole } from "@/types";

export function OrgInvitationsPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { userContext } = useAuth();
  const { items: invitations, isLoading, hasMore, loadMore, isLoadingMore } = useOrgInvitations(orgId, {
    enabled: can(userContext, "organization.manage_members"),
  });
  const createInviteMutation = useCreateInvitation(orgId);
  const revokeInviteMutation = useRevokeInvitation(orgId);
  const resendInviteMutation = useResendInvitation(orgId);

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<OrgRole>("CHALLENGE_MANAGER");
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setFeedback({ type: "error", text: "Please provide a valid recipient email address." });
      return;
    }

    try {
      await createInviteMutation.mutateAsync({ email, role });
      setFeedback({
        type: "success",
        text: `Invitation successfully dispatched to ${email} with assigned role ${role}.`,
      });
      setEmail("");
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Failed to issue invitation.",
      });
    }
  };

  const handleResend = async (inviteId: string) => {
    try {
      await resendInviteMutation.mutateAsync(inviteId);
      setFeedback({ type: "success", text: "Invitation resent." });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to resend invitation." });
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInviteMutation.mutateAsync(inviteId);
      setFeedback({ type: "success", text: "Invitation revoked." });
    } catch (err: any) {
      setFeedback({ type: "error", text: "Failed to revoke invitation." });
    }
  };

  return (
    <OrgAccessGuard
      permission="organization.manage_members"
      title="Member Invitations Restricted"
      description="You require Organization Admin privileges to create and manage member invitations."
    >
      <PageContainer className="space-y-6">
        <PageHeader
          title="Organization Member Invitations"
          description="Send direct role-delegated invitations to team managers, hackathon organizers, and evaluation staff."
        />

        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Dispatch Form */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-border">
              <CardHeader className="p-5 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Issue New Invitation
                </CardTitle>
                <CardDescription className="text-xs">
                  The recipient will receive an onboarding email containing a single-use claim link.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Recipient Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colleague@organization.com"
                      className="text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Assigned Role</label>
                    <Select value={role} onValueChange={(val: OrgRole) => setRole(val)}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORG_ADMIN" className="text-xs">
                          ORG_ADMIN (Co-Administrator)
                        </SelectItem>
                        <SelectItem value="CHALLENGE_MANAGER" className="text-xs">
                          CHALLENGE_MANAGER (Hackathon Manager)
                        </SelectItem>
                        <SelectItem value="MEMBER" className="text-xs">
                          MEMBER (Standard Seat)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Note: Ownership cannot be invited directly; transfer ownership via Settings.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={createInviteMutation.isPending}
                    className="w-full text-xs font-semibold gap-1.5 h-9 mt-2"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{createInviteMutation.isPending ? "Sending..." : "Dispatch Invitation"}</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right: Pending Invitations Table */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-border">
              <CardHeader className="p-5 border-b border-border/60 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Pending & Active Invitations</CardTitle>
                  <CardDescription className="text-xs">
                    {invitations.length} issued invitations recorded for this organization.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60">
                {invitations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    No invitations have been issued yet.
                  </div>
                ) : (
                  invitations.map((inv) => {
                    const isPending = inv.status === "PENDING";
                    const isExpired = new Date(inv.expiresAt).getTime() < Date.now();

                    return (
                      <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground truncate">{inv.email}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {inv.role}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] font-mono ${
                                isPending
                                  ? "bg-amber-500/10 text-amber-600"
                                  : inv.status === "ACCEPTED"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isExpired && isPending ? "EXPIRED" : inv.status}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                            {inv.resendCount > 0 && (
                              <>
                                <span>•</span>
                                <span>Resent {inv.resendCount}x</span>
                              </>
                            )}
                          </div>
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResend(inv.id)}
                              disabled={resendInviteMutation.isPending}
                              className="text-xs h-7 gap-1"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>Resend</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRevoke(inv.id)}
                              disabled={revokeInviteMutation.isPending}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              title="Revoke invitation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
            <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
          </div>
        </div>
      </PageContainer>
    </OrgAccessGuard>
  );
}

