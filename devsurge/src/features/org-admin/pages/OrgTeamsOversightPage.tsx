import * as React from "react";
import { useParams } from "react-router-dom";
import { Search, Crown, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useAdminTeams } from "@/features/org-admin/api/queries";
import { useUserProfile } from "@/features/users/api/queries";
import { useTeamOrganizerException } from "@/features/teams/api/queries";
import { toast } from "sonner";
import { Team, TeamMember } from "@/types";

function MemberChip({ member }: { member: TeamMember }) {
  const { data: profile } = useUserProfile(member.userId);
  return (
    <div className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
          {(profile?.displayName || "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-foreground truncate">{profile?.displayName || "Participant"}</span>
            {member.role === "CAPTAIN" && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Org-admin-only post-deadline roster correction — the one write action this
 * oversight page has (`POST .../teams/:teamId/organizer-exception`, gated
 * server-side on `Permission.ChallengeManageTeams`, same permission as this
 * page's `OrgAccessGuard`). Intentionally the only mutation on this page —
 * there is no disband/lock endpoint to wire up.
 */
function OrganizerExceptionDialog({
  organizationId,
  challengeId,
  team,
  open,
  onOpenChange,
}: {
  organizationId: string;
  challengeId: string;
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useTeamOrganizerException(organizationId, challengeId, team.id);
  const [action, setAction] = React.useState<"ADD_MEMBER" | "REMOVE_MEMBER">("ADD_MEMBER");
  const [userId, setUserId] = React.useState("");
  const [reason, setReason] = React.useState("");

  const reset = () => {
    setAction("ADD_MEMBER");
    setUserId("");
    setReason("");
  };

  const handleSubmit = () => {
    if (!userId.trim()) {
      toast.error("Please provide the participant's user ID.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason — it's recorded in the audit trail.");
      return;
    }
    mutation.mutate(
      { action, userId: userId.trim(), reason: reason.trim() },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
          toast.success("Organizer exception applied.");
        },
        onError: (err: any) => toast.error(err?.message || "Could not apply organizer exception."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span>Organizer Exception — {team.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A post-deadline roster correction outside the normal invite/leave flow. Every use is recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Action</label>
            <Select value={action} onValueChange={(v) => setAction(v as "ADD_MEMBER" | "REMOVE_MEMBER")}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADD_MEMBER">Add member to team</SelectItem>
                <SelectItem value="REMOVE_MEMBER">Remove member from team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">User ID</label>
            <Input placeholder="e.g. 0193f2a5-4c3a-7c1b-9e2d-6f8a1b2c3d4e" value={userId} onChange={(e) => setUserId(e.target.value)} className="text-xs h-9 font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Reason</label>
            <Textarea placeholder="Why this action is being taken — recorded in the audit trail." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="text-xs" />
          </div>
        </div>
        <DialogFooter className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">Cancel</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={mutation.isPending} className="text-xs font-semibold">Apply Exception</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrgTeamsOversightPage() {
  const { orgId = "", challengeId = "" } = useParams<{ orgId: string; challengeId: string }>();
  const { data: teams = [], isLoading } = useAdminTeams(orgId, challengeId);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [exceptionTeam, setExceptionTeam] = React.useState<Team | null>(null);

  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <OrgAccessGuard permission="challenge.manage_teams" title="Team Oversight Restricted" description="You require Challenge Manager or Organization Admin privileges to view team rosters.">
      <PageContainer className="space-y-6">
        <PageHeader title="Team Rosters" description="Teams formed for this challenge." />

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search teams..." className="pl-8 h-8 text-xs bg-background" />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">{[1, 2].map((n) => <div key={n} className="h-32 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
          ) : filteredTeams.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-xs border-border">No teams formed yet.</Card>
          ) : (
            filteredTeams.map((team) => (
              <Card key={team.id} className="border-border shadow-2xs">
                <CardHeader className="p-5 flex flex-row items-center justify-between border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">{team.name}</CardTitle>
                    {team.isSolo && <Badge variant="outline" className="text-[10px]">Solo</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{team.members.length} member{team.members.length === 1 ? "" : "s"}</span>
                    <Button variant="outline" size="sm" onClick={() => setExceptionTeam(team)} className="text-xs h-7 gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                      <span>Organizer Exception</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 bg-muted/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {team.members.map((m) => (
                      <MemberChip key={m.userId} member={m} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {exceptionTeam && (
          <OrganizerExceptionDialog
            organizationId={orgId}
            challengeId={challengeId}
            team={exceptionTeam}
            open={exceptionTeam !== null}
            onOpenChange={(open) => !open && setExceptionTeam(null)}
          />
        )}
      </PageContainer>
    </OrgAccessGuard>
  );
}
