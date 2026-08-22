import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Crown,
  ShieldAlert,
  MoreHorizontal,
  Lock,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import {
  useOrgAdminMembers,
  useChangeMemberRole,
  useRemoveMember,
  useReactivateMember,
} from "@/features/org-admin/api/queries";
import { UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { OrgRole, Membership } from "@/types";

const ROLE_DESCRIPTIONS: Record<OrgRole, { label: string; desc: string; badgeClass: string; icon: any }> = {
  ORG_OWNER: {
    label: "Organization Owner",
    desc: "Full administrative ownership, billing, legal terms, settings, integrations, and member management.",
    badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    icon: Crown,
  },
  ORG_ADMIN: {
    label: "Organization Admin",
    desc: "Member invites, integrations, challenge management, and full audit logs review.",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    icon: Shield,
  },
  CHALLENGE_MANAGER: {
    label: "Challenge Manager",
    desc: "Operational challenge configuration, screening applicants, rubrics, and judging supervision.",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: Users,
  },
  MEMBER: {
    label: "Member / Participant",
    desc: "Standard organization membership with hackathon enrollment and team creation capabilities.",
    badgeClass: "bg-muted text-muted-foreground border-border",
    icon: Users,
  },
};

export function OrgMembersPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { userContext } = useAuth();
  const canManageMembers = can(userContext, "organization.manage_members");
  const { data: members = [], isLoading } = useOrgAdminMembers(orgId, "ACTIVE", { enabled: canManageMembers });
  const { data: removedMembers = [] } = useOrgAdminMembers(orgId, "INACTIVE", { enabled: canManageMembers });
  const updateRoleMutation = useChangeMemberRole(orgId);
  const removeMemberMutation = useRemoveMember(orgId);
  const reactivateMutation = useReactivateMember(orgId);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");
  const [feedbackMessage, setFeedbackMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dialog state
  const [confirmRoleChange, setConfirmRoleChange] = React.useState<{
    member: Membership;
    newRole: OrgRole;
  } | null>(null);

  const [confirmRemoveMember, setConfirmRemoveMember] = React.useState<Membership | null>(null);

  // Filtered members
  const filteredMembers = members.filter((m) => {
    const matchesSearch = (m.displayName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const ownerCount = members.filter((m) => m.role === "ORG_OWNER").length;

  const handleRoleSelection = (member: Membership, newRole: OrgRole) => {
    if (member.role === newRole) return;

    // Safety: check if attempting to demote last owner
    if (member.role === "ORG_OWNER" && newRole !== "ORG_OWNER" && ownerCount <= 1) {
      setFeedbackMessage({
        type: "error",
        text: "Cannot demote the only remaining Organization Owner. Assign another owner first in Organization Settings.",
      });
      return;
    }

    setConfirmRoleChange({ member, newRole });
  };

  const executeRoleChange = async () => {
    if (!confirmRoleChange) return;
    try {
      await updateRoleMutation.mutateAsync({
        userId: confirmRoleChange.member.userId,
        role: confirmRoleChange.newRole,
      });
      setFeedbackMessage({
        type: "success",
        text: `Successfully updated ${confirmRoleChange.member.displayName || "Unnamed member"}'s role to ${ROLE_DESCRIPTIONS[confirmRoleChange.newRole].label}.`,
      });
      setConfirmRoleChange(null);
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Failed to update member role.",
      });
    }
  };

  const executeRemoveMember = async () => {
    if (!confirmRemoveMember) return;
    if (confirmRemoveMember.role === "ORG_OWNER" && ownerCount <= 1) {
      setFeedbackMessage({
        type: "error",
        text: "Cannot remove the only primary Organization Owner.",
      });
      setConfirmRemoveMember(null);
      return;
    }

    try {
      await removeMemberMutation.mutateAsync(confirmRemoveMember.userId);
      setFeedbackMessage({
        type: "success",
        text: `Removed ${confirmRemoveMember.displayName || "the member"} from the organization.`,
      });
      setConfirmRemoveMember(null);
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Failed to remove member.",
      });
    }
  };

  return (
    <OrgAccessGuard
      permission="organization.manage_members"
      title="Member Administration Restricted"
      description="You require Organization Owner or Organization Admin permissions to manage member roles and seat allocations."
    >
      <PageContainer className="space-y-6">
        <PageHeader
          title="Organization Member Governance"
          description="Enforce role-based access control (RBAC). Assign administrators, operational challenge managers, and general members with strict owner-protection rules."
          actions={
            <Button
              onClick={() => navigate(`/org/${orgId}/invitations`)}
              className="text-xs font-semibold gap-1.5 h-8 shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Invite New Members</span>
            </Button>
          }
        />

        {feedbackMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              feedbackMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-muted-foreground hover:text-foreground font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Roles Policy Callout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.entries(ROLE_DESCRIPTIONS) as [OrgRole, any][]).map(([key, meta]) => {
            const Icon = meta.icon;
            const count = members.filter((m) => m.role === key).length;
            return (
              <div key={key} className="p-3.5 rounded-xl border border-border bg-card/60 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold">{meta.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {count} {count === 1 ? "seat" : "seats"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  {meta.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member by name, email, username..."
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 text-xs w-48 bg-background">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Roles ({members.length})</SelectItem>
                <SelectItem value="ORG_OWNER" className="text-xs">Organization Owners</SelectItem>
                <SelectItem value="ORG_ADMIN" className="text-xs">Organization Admins</SelectItem>
                <SelectItem value="CHALLENGE_MANAGER" className="text-xs">Challenge Managers</SelectItem>
                <SelectItem value="MEMBER" className="text-xs">General Members</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Members Roster Table */}
        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">Assigned Members Roster</CardTitle>
              <CardDescription className="text-xs">
                {filteredMembers.length} active seat assignments in this tenant.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono">
              Owner Protections Active
            </Badge>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {filteredMembers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">
                No members found matching your search query.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const roleMeta = ROLE_DESCRIPTIONS[member.role] || ROLE_DESCRIPTIONS.MEMBER;
                const isOnlyOwner = member.role === "ORG_OWNER" && ownerCount <= 1;

                return (
                  <div
                    key={member.userId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full border border-border bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {(member.displayName || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground truncate">
                            {member.displayName || "Unnamed member"}
                          </span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${roleMeta.badgeClass}`}>
                            {member.role}
                          </Badge>
                          {isOnlyOwner && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <Lock className="h-2.5 w-2.5 mr-1" />
                              Primary Owner
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                      <Select
                        value={member.role}
                        onValueChange={(val: OrgRole) => handleRoleSelection(member, val)}
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="h-8 text-xs w-44 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ORG_OWNER" className="text-xs">
                            ORG_OWNER (Owner)
                          </SelectItem>
                          <SelectItem value="ORG_ADMIN" className="text-xs">
                            ORG_ADMIN (Administrator)
                          </SelectItem>
                          <SelectItem value="CHALLENGE_MANAGER" className="text-xs">
                            CHALLENGE_MANAGER (Manager)
                          </SelectItem>
                          <SelectItem value="MEMBER" className="text-xs">
                            MEMBER (Standard)
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isOnlyOwner || removeMemberMutation.isPending}
                        onClick={() => setConfirmRemoveMember(member)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={isOnlyOwner ? "Cannot remove the only Organization Owner" : "Remove member"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Removed Members — reactivation */}
        {removedMembers.length > 0 && (
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold">Removed Members</CardTitle>
              <CardDescription className="text-xs">
                {removedMembers.length} previously removed — reactivate to restore access.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {removedMembers.map((member) => (
                <div key={member.userId} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-bold text-foreground">{member.displayName || "Unnamed member"}</div>
                    <div className="text-muted-foreground">
                      {member.removedAt ? `Removed ${new Date(member.removedAt).toLocaleDateString()}` : "Removed"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reactivateMutation.isPending}
                    onClick={() =>
                      reactivateMutation.mutate(
                        { userId: member.userId },
                        {
                          onSuccess: () => setFeedbackMessage({ type: "success", text: `Reactivated ${member.displayName || "member"}.` }),
                          onError: (err: any) => setFeedbackMessage({ type: "error", text: err?.message || "Failed to reactivate." }),
                        },
                      )
                    }
                    className="text-xs h-8 gap-1.5"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Reactivate
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Confirm Role Change Dialog */}
        <Dialog open={Boolean(confirmRoleChange)} onOpenChange={(open) => !open && setConfirmRoleChange(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Confirm Role Modification
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                You are about to change the organizational permissions for <strong>{confirmRoleChange?.member.displayName || "this member"}</strong>.
              </DialogDescription>
            </DialogHeader>

            {confirmRoleChange && (
              <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Role:</span>
                  <span className="font-mono font-semibold">{confirmRoleChange.member.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Assigned Role:</span>
                  <span className="font-mono font-bold text-primary">{confirmRoleChange.newRole}</span>
                </div>
                <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                  {ROLE_DESCRIPTIONS[confirmRoleChange.newRole].desc}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRoleChange(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={executeRoleChange}
                disabled={updateRoleMutation.isPending}
                className="text-xs font-semibold px-4"
              >
                {updateRoleMutation.isPending ? "Updating..." : "Confirm Role Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Remove Member Dialog */}
        <Dialog open={Boolean(confirmRemoveMember)} onOpenChange={(open) => !open && setConfirmRemoveMember(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Remove Organization Member
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                Are you sure you want to revoke organizational membership for <strong>{confirmRemoveMember?.displayName || "this member"}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
              This action will immediately revoke all tenant administrative capabilities, challenge management rights, and access to internal dashboards.
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveMember(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={executeRemoveMember}
                disabled={removeMemberMutation.isPending}
                className="text-xs font-semibold px-4"
              >
                {removeMemberMutation.isPending ? "Removing..." : "Confirm Member Removal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}

