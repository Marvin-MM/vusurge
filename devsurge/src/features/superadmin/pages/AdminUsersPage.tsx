import * as React from "react";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { PlatformAccessGuard } from "@/features/superadmin/components/PlatformAccessGuard";
import {
  type PlatformRole,
  type PlatformUser,
  useGrantPlatformRole,
  usePlatformUsers,
  useRevokePlatformRole,
} from "@/features/superadmin/api/queries";

type RoleAction = { kind: "grant" | "revoke"; user: PlatformUser; role: PlatformRole };

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : ((error as { message?: string } | null)?.message ?? "The role change could not be completed.");
}

function AdminUsersContent() {
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const { items, isLoading, hasMore, loadMore, isLoadingMore } = usePlatformUsers({
    search: deferredSearch || undefined,
  });
  const grantRole = useGrantPlatformRole();
  const revokeRole = useRevokePlatformRole();
  const [action, setAction] = React.useState<RoleAction | null>(null);
  const [reason, setReason] = React.useState("");

  const submitAction = () => {
    if (!action || reason.trim().length < 10) return;
    const mutation = action.kind === "grant" ? grantRole : revokeRole;
    mutation.mutate(
      { userId: action.user.id, role: action.role, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`Platform role ${action.kind === "grant" ? "granted" : "revoked"}.`);
          setAction(null);
          setReason("");
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Platform Users"
        description="Search verified accounts and administer explicitly audited platform roles."
      />

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
          maxLength={200}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-24 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted-foreground border-dashed">No users match this search.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((user) => {
            const roles = new Set(user.platformRoles.map((assignment) => assignment.role));
            return (
              <Card key={user.id} className="p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><UserRound className="h-4 w-4" /></div>
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-sm truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant="outline" className="text-[10px]">{user.emailVerified ? "Email verified" : "Email unverified"}</Badge>
                      <Badge variant="outline" className="text-[10px]">{user.twoFactorEnabled ? "2FA enabled" : "2FA disabled"}</Badge>
                      {user.platformRoles.map((assignment) => (
                        <Badge key={assignment.id} className="text-[10px]">{assignment.role.replace("PLATFORM_", "")}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {(["PLATFORM_SUPPORT_AGENT", "PLATFORM_SUPERADMIN"] as const).map((role) =>
                    roles.has(role) ? (
                      <Button key={role} variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setAction({ kind: "revoke", user, role })}>
                        Revoke {role === "PLATFORM_SUPERADMIN" ? "superadmin" : "support"}
                      </Button>
                    ) : (
                      <Button
                        key={role}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={role === "PLATFORM_SUPERADMIN" && !user.twoFactorEnabled}
                        title={role === "PLATFORM_SUPERADMIN" && !user.twoFactorEnabled ? "2FA is required for superadmins" : undefined}
                        onClick={() => setAction({ kind: "grant", user, role })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                        Grant {role === "PLATFORM_SUPERADMIN" ? "superadmin" : "support"}
                      </Button>
                    ),
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />

      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{action?.kind === "grant" ? "Grant" : "Revoke"} platform role</DialogTitle>
            <DialogDescription>
              This is a high-privilege, audited action. A recently authenticated session is required.
            </DialogDescription>
          </DialogHeader>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Reason (at least 10 characters)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button
              variant={action?.kind === "revoke" ? "destructive" : "default"}
              disabled={reason.trim().length < 10 || grantRole.isPending || revokeRole.isPending}
              onClick={submitAction}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export function AdminUsersPage() {
  return <PlatformAccessGuard anyOf={["platform.manage_roles"]}><AdminUsersContent /></PlatformAccessGuard>;
}
