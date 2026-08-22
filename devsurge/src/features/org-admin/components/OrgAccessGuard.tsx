import * as React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { can, Permission } from "@/types/permissions";
import { useNavigate, useParams } from "react-router-dom";

interface OrgAccessGuardProps {
  permission: Permission;
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function OrgAccessGuard({
  permission,
  children,
  title = "Restricted Access",
  description = "Your current role within this organization does not possess the permissions required to view or manage this section.",
}: OrgAccessGuardProps) {
  const { user, userContext } = useAuth();
  const navigate = useNavigate();
  const { orgId = "" } = useParams();

  const hasAccess = can(userContext, permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4 ring-8 ring-destructive/5">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <h2 className="text-xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-xs text-muted-foreground leading-relaxed mb-6">
        {description}
        <br />
        <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded mt-2 inline-block">
          Required permission: {permission}
        </span>
      </p>

      <div className="p-4 rounded-xl border border-border bg-card/60 w-full mb-6 text-left space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Signed in as
        </div>
        <div className="flex items-center gap-3">
          <img
            src={user?.avatarUrl || "https://api.dicebear.com/7.x/initials/svg?seed=" + (user?.fullName || "?")}
            alt={user?.fullName}
            className="h-9 w-9 rounded-full object-cover border border-border"
          />
          <div>
            <div className="text-xs font-bold">{user?.fullName || user?.email}</div>
            <div className="text-[11px] text-muted-foreground">{userContext.orgRole || "No role in this organization"}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/org/${orgId}`)}
          className="text-xs gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Overview
        </Button>
      </div>
    </div>
  );
}
