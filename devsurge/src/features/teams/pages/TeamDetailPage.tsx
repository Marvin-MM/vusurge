import * as React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, UserPlus, CheckCircle2, Crown, LogOut, AlertTriangle, Send, FileCheck2, Copy, UserMinus, Mail, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  useTeam,
  useInviteTeamMember,
  useLeaveTeam,
  useTransferCaptain,
  useTeamInvitations,
  useRevokeTeamInvitation,
  useRemoveTeamMember,
} from "@/features/teams/api/queries";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/features/users/api/queries";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "sonner";
import { TeamMember } from "@/types";

function MemberCard({
  member,
  isCaptain,
  onRemove,
}: {
  member: TeamMember;
  isCaptain: boolean;
  onRemove?: (userId: string) => void;
}) {
  const { data: profile } = useUserProfile(member.userId);
  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-foreground truncate">{profile?.displayName || "Participant"}</h4>
          {profile?.location && <p className="text-[11px] text-muted-foreground truncate">{profile.location}</p>}
        </div>
        <Badge variant={member.role === "CAPTAIN" ? "default" : "outline"} className="text-[10px] shrink-0 font-bold">
          {member.role === "CAPTAIN" ? "Captain" : "Member"}
        </Badge>
      </div>
      {profile && profile.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {profile.skills.slice(0, 3).map((s) => (
            <span key={s.id ?? s.name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.name}</span>
          ))}
        </div>
      )}
      {isCaptain && member.role !== "CAPTAIN" && onRemove && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRemove(member.userId)}
          className="text-[11px] h-7 w-full text-destructive hover:bg-destructive/10 gap-1.5"
        >
          <UserMinus className="h-3 w-3" />
          <span>Remove from Team</span>
        </Button>
      )}
    </div>
  );
}

export function TeamDetailPage() {
  const { teamId = "" } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get("organizationId") || "";
  const challengeId = searchParams.get("challengeId") || "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: team, isLoading } = useTeam(organizationId, challengeId, teamId);
  // Computed ahead of the loading/not-found early returns below so hook call
  // order stays stable across renders; `team` may still be undefined here.
  const isCaptainForQuery = Boolean(team?.members.some((m) => m.userId === user?.id && m.role === "CAPTAIN"));

  const inviteMutation = useInviteTeamMember(organizationId, challengeId, teamId);
  const leaveMutation = useLeaveTeam(organizationId, challengeId, teamId);
  const transferMutation = useTransferCaptain(organizationId, challengeId, teamId);
  const revokeInvitationMutation = useRevokeTeamInvitation(organizationId, challengeId, teamId);
  const removeMemberMutation = useRemoveTeamMember(organizationId, challengeId, teamId);
  const { data: invitations = [] } = useTeamInvitations(organizationId, challengeId, teamId, { enabled: isCaptainForQuery });

  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [inviteUserId, setInviteUserId] = React.useState("");

  const [leaveDialogOpen, setLeaveDialogOpen] = React.useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [selectedNewCaptain, setSelectedNewCaptain] = React.useState("");

  const [revokeTarget, setRevokeTarget] = React.useState<{ id: string; invitedUserId: string } | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="py-20 text-center text-xs text-muted-foreground">Loading team...</div>
      </PageContainer>
    );
  }

  if (!team) {
    return (
      <PageContainer>
        <EmptyState
          title="Team Not Found"
          description="This team may have been dissolved or does not exist."
          action={{ label: "Back to Teams & Matchmaking", onClick: () => navigate("/app/teams") }}
        />
      </PageContainer>
    );
  }

  const isCaptain = team.members.some((m) => m.userId === user?.id && m.role === "CAPTAIN");
  const isMember = team.members.some((m) => m.userId === user?.id);

  const handleSendInvite = () => {
    if (!inviteUserId.trim()) {
      toast.error("Please enter a user ID to invite.");
      return;
    }
    inviteMutation.mutate(
      { userId: inviteUserId.trim() },
      {
        onSuccess: () => {
          setInviteDialogOpen(false);
          setInviteUserId("");
          toast.success("Invitation sent.");
        },
        onError: (err: any) => toast.error(err?.message || "Could not send invitation."),
      }
    );
  };

  const handleConfirmLeave = () => {
    leaveMutation.mutate(undefined, {
      onSuccess: () => {
        setLeaveDialogOpen(false);
        toast.info("You have left the team.");
        navigate("/app/teams");
      },
      onError: (err: any) => toast.error(err?.message || "Could not leave team."),
    });
  };

  const handleConfirmTransfer = () => {
    if (!selectedNewCaptain) {
      toast.error("Please select a team member to promote to Captain.");
      return;
    }
    transferMutation.mutate(
      { newCaptainUserId: selectedNewCaptain },
      {
        onSuccess: () => {
          setTransferDialogOpen(false);
          toast.success("Team captaincy transferred.");
        },
        onError: (err: any) => toast.error(err?.message || "Could not transfer captaincy."),
      }
    );
  };

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return;
    revokeInvitationMutation.mutate(revokeTarget.id, {
      onSuccess: () => {
        setRevokeTarget(null);
        toast.success("Invitation revoked.");
      },
      onError: (err: any) => toast.error(err?.message || "Could not revoke invitation."),
    });
  };

  const handleConfirmRemove = () => {
    if (!removeTarget) return;
    removeMemberMutation.mutate(removeTarget, {
      onSuccess: () => {
        setRemoveTarget(null);
        toast.success("Member removed from team.");
      },
      onError: (err: any) => toast.error(err?.message || "Could not remove member."),
    });
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/teams")} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Teams</span>
        </Button>
        <div className="flex items-center gap-2">
          {isCaptain && (
            <>
              <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(true)} className="text-xs h-8 gap-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span>Transfer Captaincy</span>
              </Button>
              <Button size="sm" onClick={() => setInviteDialogOpen(true)} className="text-xs h-8 font-semibold gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                <span>Invite Collaborator</span>
              </Button>
            </>
          )}
          {isMember && (
            <Button variant="outline" size="sm" onClick={() => setLeaveDialogOpen(true)} className="text-xs h-8 text-destructive hover:bg-destructive/10 gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              <span>Leave Team</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="p-6 border-border space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {team.isSolo && <Badge variant="outline" className="text-xs">Solo</Badge>}
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {team.members.length} member{team.members.length === 1 ? "" : "s"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">{team.name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/60 text-xs">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast.success("Team page URL copied.");
              }}
              className="text-xs h-8 gap-1.5"
            >
              <Copy className="h-3 w-3" />
              <span>Share Team URL</span>
            </Button>
            {/* A submission belongs to the caller's own team, so this is only
                meaningful — and only permitted by the backend — for an actual
                member of this team who is an approved challenge participant. */}
            {isMember && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/submissions/new?organizationId=${organizationId}&challengeId=${challengeId}`)}
                className="text-xs h-8 gap-1.5"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                <span>Open Team Submission Draft</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-border">
        <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-bold text-foreground">Active Roster</CardTitle>
          </div>
          {isCaptain && (
            <Button size="sm" variant="outline" onClick={() => setInviteDialogOpen(true)} className="text-xs h-8 gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-primary" />
              <span>Invite Member</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {team.members.map((m) => (
              <MemberCard key={m.userId} member={m} isCaptain={isCaptain} onRemove={(userId) => setRemoveTarget(userId)} />
            ))}
          </div>
        </CardContent>
      </Card>

      {isCaptain && (
        <Card className="border-border">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span>Pending Invitations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {invitations.filter((inv) => inv.status === "PENDING").length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">No pending invitations.</div>
            ) : (
              <div className="space-y-2">
                {invitations
                  .filter((inv) => inv.status === "PENDING")
                  .map((inv) => (
                    <div key={inv.id} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-foreground truncate">{inv.invitedUserId}</p>
                        <p className="text-[11px] text-muted-foreground">Expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokeTarget({ id: inv.id, invitedUserId: inv.invitedUserId })}
                        className="text-xs h-7 shrink-0 text-destructive hover:bg-destructive/10 gap-1.5"
                      >
                        <Ban className="h-3 w-3" />
                        <span>Revoke</span>
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              <span>Invite Collaborator</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Invite by user ID — find one from a matchmaking profile, or ask your collaborator for theirs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">User ID</label>
              <Input placeholder="e.g. 0193f2a5-4c3a-7c1b-9e2d-6f8a1b2c3d4e" value={inviteUserId} onChange={(e) => setInviteUserId(e.target.value)} className="text-xs h-9 font-mono" />
            </div>
          </div>

          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setInviteDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button type="button" size="sm" onClick={handleSendInvite} disabled={inviteMutation.isPending} className="text-xs font-semibold gap-1.5">
              <Send className="h-3 w-3" />
              <span>Send Invitation</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Captaincy Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span>Transfer Team Captaincy</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {team.members
              .filter((m) => m.userId !== user?.id)
              .map((m) => (
                <label key={m.userId} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="newCaptain" value={m.userId} checked={selectedNewCaptain === m.userId} onChange={(e) => setSelectedNewCaptain(e.target.value)} className="text-primary" />
                    <span className="text-xs font-mono text-foreground">{m.userId}</span>
                  </div>
                </label>
              ))}
          </div>

          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setTransferDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button type="button" size="sm" onClick={handleConfirmTransfer} disabled={!selectedNewCaptain || transferMutation.isPending} className="text-xs font-semibold">Confirm Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Team Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Leave Team</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to leave <strong>{team.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setLeaveDialogOpen(false)} className="text-xs">Stay in Team</Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleConfirmLeave} disabled={leaveMutation.isPending} className="text-xs font-semibold">Yes, Leave Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Invitation Dialog */}
      <ConfirmActionDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke Invitation"
        description={revokeTarget ? `Revoke the pending invitation for ${revokeTarget.invitedUserId}? They will no longer be able to accept it.` : ""}
        confirmLabel="Revoke Invitation"
        onConfirm={handleConfirmRevoke}
        loading={revokeInvitationMutation.isPending}
      />

      {/* Remove Member Dialog */}
      <ConfirmActionDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove Team Member"
        description={removeTarget ? `Remove ${removeTarget} from ${team.name}? This cannot be undone — they will need a new invitation to rejoin.` : ""}
        confirmLabel="Remove Member"
        onConfirm={handleConfirmRemove}
        loading={removeMemberMutation.isPending}
      />
    </PageContainer>
  );
}
