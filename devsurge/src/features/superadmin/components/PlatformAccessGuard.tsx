import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { can, Permission } from "@/types/permissions";

interface PlatformAccessGuardProps {
  /** Access is granted if the user holds ANY of these permissions. */
  anyOf: Permission[];
  children: React.ReactNode;
  title?: string;
  description?: string;
}

/** Gates a platform-admin page by real `platform.*` permissions — distinct from `PlatformAdminShell`'s coarser "holds some platform role" entry check, since `PLATFORM_SUPPORT_AGENT` only holds `platform.support`+`platform.moderate`. */
export function PlatformAccessGuard({
  anyOf,
  children,
  title = "Restricted Access",
  description = "Your platform role does not include the permissions required to view this section.",
}: PlatformAccessGuardProps) {
  const { user, userContext } = useAuth();
  const navigate = useNavigate();

  const hasAccess = anyOf.some((permission) => can(userContext, permission));

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
          Required: {anyOf.join(" or ")}
        </span>
      </p>
      <div className="p-4 rounded-xl border border-border bg-card/60 w-full mb-6 text-left space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signed in as</div>
        <div className="text-xs font-bold">{user?.fullName || user?.email}</div>
        <div className="text-[11px] text-muted-foreground">{userContext.globalRole}</div>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="text-xs gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Overview
      </Button>
    </div>
  );
}
