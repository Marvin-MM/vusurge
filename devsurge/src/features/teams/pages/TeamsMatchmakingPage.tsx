import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Plus, Sparkles, UserPlus, Globe, Clock, Send, Pencil, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmActionDialog, DangerActionDialog } from "@/components/feedback/ConfirmActionDialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  useTeams,
  useCreateTeam,
  useMatchmakingPosts,
  useCreateMatchmakingPost,
  useInviteTeamMember,
  useExpressMatchmakingInterest,
  useUpdateMatchmakingPost,
  useCloseMatchmakingPost,
  useDeleteMatchmakingPost,
} from "@/features/teams/api/queries";
import { useMyChallengeParticipations } from "@/features/participant/api/queries";
import { useUserProfile } from "@/features/users/api/queries";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { MatchmakingPost } from "@/types";

function PosterName({ userId }: { userId: string }) {
  const { data: profile } = useUserProfile(userId);
  return <>{profile?.displayName || "Participant"}</>;
}

function MatchmakingCard({
  post,
  organizationId,
  challengeId,
  myTeamId,
  isOwn,
}: {
  post: MatchmakingPost;
  organizationId: string;
  challengeId: string;
  myTeamId?: string;
  isOwn: boolean;
}) {
  const { data: profile } = useUserProfile(post.posterUserId);
  const expressInterest = useExpressMatchmakingInterest(organizationId, challengeId, post.id);
  const inviteMember = useInviteTeamMember(organizationId, challengeId, myTeamId || "");
  const updatePost = useUpdateMatchmakingPost(organizationId, challengeId, post.id);
  const closePost = useCloseMatchmakingPost(organizationId, challengeId, post.id);
  const deletePost = useDeleteMatchmakingPost(organizationId, challengeId, post.id);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editMessage, setEditMessage] = React.useState(post.message);
  const [editSkills, setEditSkills] = React.useState(post.skillsOffered.join(", "));
  const [editRoles, setEditRoles] = React.useState(post.rolesSought.join(", "));
  const [editAvailability, setEditAvailability] = React.useState(post.availability || "");
  const [closeConfirmOpen, setCloseConfirmOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  const openEditDialog = () => {
    setEditMessage(post.message);
    setEditSkills(post.skillsOffered.join(", "));
    setEditRoles(post.rolesSought.join(", "));
    setEditAvailability(post.availability || "");
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editMessage.trim()) {
      toast.error("Please write a short introduction.");
      return;
    }
    updatePost.mutate(
      {
        message: editMessage,
        skillsOffered: editSkills.split(",").map((s) => s.trim()).filter(Boolean),
        rolesSought: editRoles.split(",").map((s) => s.trim()).filter(Boolean),
        availability: editAvailability || undefined,
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast.success("Matchmaking profile updated.");
        },
        onError: (err: any) => toast.error(err?.message || "Could not update profile."),
      }
    );
  };

  const handleClose = () => {
    closePost.mutate(undefined, {
      onSuccess: () => {
        setCloseConfirmOpen(false);
        toast.success("Matchmaking profile marked filled.");
      },
      onError: (err: any) => toast.error(err?.message || "Could not close profile."),
    });
  };

  const handleDelete = () => {
    deletePost.mutate(undefined, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        toast.success("Matchmaking profile deleted.");
      },
      onError: (err: any) => toast.error(err?.message || "Could not delete profile."),
    });
  };

  return (
    <Card className="p-5 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-foreground">
              <PosterName userId={post.posterUserId} />
              {isOwn && <span className="ml-1.5 text-[10px] font-semibold text-primary">(You)</span>}
            </h4>
            {profile?.location && <p className="text-[11px] text-muted-foreground">{profile.location}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="default" className="text-[10px] font-semibold">
              {post.posterTeamId ? "Team Recruiting" : "Looking for Team"}
            </Badge>
            {!post.isOpen && <Badge variant="outline" className="text-[10px] font-semibold">Filled</Badge>}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{post.message}</p>

        {post.skillsOffered.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-foreground">Skills Offered:</div>
            <div className="flex flex-wrap gap-1">
              {post.skillsOffered.map((s) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {post.rolesSought.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-primary">Roles Sought:</div>
            <div className="flex flex-wrap gap-1">
              {post.rolesSought.map((role) => (
                <span key={role} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">{role}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {post.availability && (
          <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
            <Clock className="h-3 w-3" />
            {post.availability}
          </span>
        )}
        {isOwn ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEditDialog} className="text-xs h-8 gap-1">
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </Button>
            {post.isOpen && (
              <Button variant="outline" size="sm" onClick={() => setCloseConfirmOpen(true)} className="text-xs h-8 gap-1">
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark Filled</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmOpen(true)} className="text-xs h-8 gap-1 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                expressInterest.mutate(undefined, {
                  onSuccess: () => toast.success("Interest sent."),
                  onError: (err: any) => toast.error(err?.message || "Could not send interest."),
                })
              }
              disabled={expressInterest.isPending}
              className="text-xs h-8 font-semibold gap-1"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Express Interest</span>
            </Button>
            {myTeamId && (
              <Button
                size="sm"
                onClick={() =>
                  inviteMember.mutate(
                    { userId: post.posterUserId },
                    {
                      onSuccess: () => toast.success("Invitation sent."),
                      onError: (err: any) => toast.error(err?.message || "Could not send invitation."),
                    }
                  )
                }
                disabled={inviteMember.isPending}
                className="text-xs h-8 font-semibold"
              >
                Invite to My Team
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Edit Matchmaking Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              <span>Edit Matchmaking Profile</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Introduction</label>
              <Textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} className="text-xs min-h-[70px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Skills Offered (comma-separated)</label>
                <Input value={editSkills} onChange={(e) => setEditSkills(e.target.value)} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Roles Sought (comma-separated)</label>
                <Input value={editRoles} onChange={(e) => setEditRoles(e.target.value)} className="text-xs h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Availability</label>
              <Input value={editAvailability} onChange={(e) => setEditAvailability(e.target.value)} className="text-xs h-9" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)} className="text-xs">Cancel</Button>
            <Button type="button" size="sm" onClick={handleSaveEdit} disabled={updatePost.isPending} className="text-xs font-semibold">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Mark Profile Filled"
        description="This marks your matchmaking profile as filled, hiding it from active searches. You can still delete it later."
        confirmLabel="Mark Filled"
        onConfirm={handleClose}
        loading={closePost.isPending}
      />

      <DangerActionDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Matchmaking Profile"
        description="This permanently deletes your matchmaking profile. This cannot be undone."
        confirmLabel="Delete Profile"
        onConfirm={handleDelete}
        loading={deletePost.isPending}
      />
    </Card>
  );
}

export function TeamsMatchmakingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: participations = [] } = useMyChallengeParticipations();
  const approvedParticipations = participations.filter((p) => p.status === "APPROVED");

  const paramChallengeId = searchParams.get("challengeId") || "";
  const selected = approvedParticipations.find((p) => p.challengeId === paramChallengeId) || approvedParticipations[0];
  const organizationId = selected?.organizationId || "";
  const challengeId = selected?.challengeId || "";

  const { data: teams = [] } = useTeams(organizationId, challengeId);
  const { data: posts = [] } = useMatchmakingPosts(organizationId, challengeId);
  const createTeamMutation = useCreateTeam(organizationId, challengeId);
  const createPostMutation = useCreateMatchmakingPost(organizationId, challengeId);

  const [createTeamOpen, setCreateTeamOpen] = React.useState(false);
  const [newTeamName, setNewTeamName] = React.useState("");

  const [createPostOpen, setCreatePostOpen] = React.useState(false);
  const [postMessage, setPostMessage] = React.useState("");
  const [postSkills, setPostSkills] = React.useState("");
  const [postRoles, setPostRoles] = React.useState("");
  const [postAvailability, setPostAvailability] = React.useState("");

  const myTeamId = teams[0]?.id;

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) {
      toast.error("Please provide a team name.");
      return;
    }
    createTeamMutation.mutate(
      { name: newTeamName },
      {
        onSuccess: (team) => {
          setCreateTeamOpen(false);
          setNewTeamName("");
          toast.success(`Team "${team.name}" created.`);
          navigate(`/app/teams/${team.id}?organizationId=${organizationId}&challengeId=${challengeId}`);
        },
        onError: (err: any) => toast.error(err?.message || "Could not create team."),
      }
    );
  };

  const handleCreatePost = () => {
    if (!postMessage.trim()) {
      toast.error("Please write a short introduction.");
      return;
    }
    createPostMutation.mutate(
      {
        posterTeamId: myTeamId,
        skillsOffered: postSkills.split(",").map((s) => s.trim()).filter(Boolean),
        rolesSought: postRoles.split(",").map((s) => s.trim()).filter(Boolean),
        message: postMessage,
        availability: postAvailability || undefined,
      },
      {
        onSuccess: () => {
          setCreatePostOpen(false);
          setPostMessage("");
          toast.success("Matchmaking profile published.");
        },
        onError: (err: any) => toast.error(err?.message || "Could not publish profile."),
      }
    );
  };

  if (approvedParticipations.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          title="No active challenge to browse teams for"
          description="Register for a challenge first — team formation and matchmaking are scoped to a specific challenge."
          action={{ label: "Browse Challenges", onClick: () => navigate("/app/challenges") }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Team Formation & Matchmaking"
        description="Find teammates or recruit specialists for your challenge."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreatePostOpen(true)} className="text-xs font-semibold gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Post Matchmaking Profile</span>
            </Button>
            <Button size="sm" onClick={() => setCreateTeamOpen(true)} className="text-xs font-semibold gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Create Team</span>
            </Button>
          </div>
        }
      />

      {approvedParticipations.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Challenge:</span>
          <Select value={challengeId} onValueChange={(val) => setSearchParams({ challengeId: val })}>
            <SelectTrigger className="h-8 text-xs w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {approvedParticipations.map((p) => (
                <SelectItem key={p.challengeId} value={p.challengeId}>{p.challengeTitle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Looking for a Team</h3>
            <p className="text-xs text-muted-foreground">Participants seeking collaborators for this challenge</p>
          </div>
          <div className="text-xs text-muted-foreground font-semibold">{posts.length} active profiles</div>
        </div>

        {posts.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">No matchmaking profiles posted yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <MatchmakingCard
                key={post.id}
                post={post}
                organizationId={organizationId}
                challengeId={challengeId}
                myTeamId={myTeamId}
                isOwn={post.posterUserId === user?.id}
              />
            ))}
          </div>
        )}

        <div className="pt-8 space-y-4">
          <h3 className="text-base font-bold text-foreground">Teams</h3>
          {teams.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">No teams formed yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {teams.map((t) => (
                <Card key={t.id} className="p-4 space-y-3 hover:border-primary/40 transition-colors">
                  <h4 className="text-xs font-bold text-foreground">{t.name}</h4>
                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t.members.length} member{t.members.length === 1 ? "" : "s"}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/app/teams/${t.id}?organizationId=${organizationId}&challengeId=${challengeId}`)}
                      className="text-xs h-7"
                    >
                      View Roster
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Create Team</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              You will automatically become the team captain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Team Name</label>
              <Input placeholder="e.g. NeuralMesh Agents" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className="text-xs h-9" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateTeamOpen(false)} className="text-xs">Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreateTeam} disabled={createTeamMutation.isPending} className="text-xs font-semibold">Create Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Matchmaking Profile Dialog */}
      <Dialog open={createPostOpen} onOpenChange={setCreatePostOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Publish Matchmaking Profile</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Introduction</label>
              <Textarea placeholder="Describe your background and what you're looking to build..." value={postMessage} onChange={(e) => setPostMessage(e.target.value)} className="text-xs min-h-[70px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Skills Offered (comma-separated)</label>
                <Input value={postSkills} onChange={(e) => setPostSkills(e.target.value)} className="text-xs h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Roles Sought (comma-separated)</label>
                <Input value={postRoles} onChange={(e) => setPostRoles(e.target.value)} className="text-xs h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Availability</label>
              <Input placeholder="e.g. 15 hrs/week" value={postAvailability} onChange={(e) => setPostAvailability(e.target.value)} className="text-xs h-9" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreatePostOpen(false)} className="text-xs">Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreatePost} disabled={createPostMutation.isPending} className="text-xs font-semibold gap-1.5">
              <Send className="h-3 w-3" />
              <span>Publish</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
