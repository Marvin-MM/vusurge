import * as React from "react";
import { Check, ChevronsUpDown, Building2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/useUiStore";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function OrganizationSwitcher({ className }: { className?: string }) {
  const { activeOrganizationId, setActiveOrganizationId } = useUiStore();
  const { memberships } = useAuth();
  const navigate = useNavigate();

  // "My organizations" is exactly GET /me/organizations (already fetched
  // once in AuthContext, not re-fetched here).
  const organizations = memberships.map((m) => ({ id: m.organizationId, name: m.organizationName, visibility: "" }));

  if (organizations.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("/app/apply-organization")}
        className={cn("h-8 text-xs gap-1.5 border-dashed", className)}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span>Create Organization</span>
      </Button>
    );
  }

  const activeOrg = organizations.find((o) => o.id === activeOrganizationId) || organizations[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 px-2.5 gap-2 border-border/80 bg-background/80 hover:bg-accent font-medium text-xs justify-between max-w-[200px] shrink-0",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{activeOrg?.name || "Select Organization"}</span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => {
          const isSelected = org.id === activeOrganizationId;
          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                setActiveOrganizationId(org.id);
                // navigate if in org context
                if (window.location.pathname.startsWith("/org/")) {
                  navigate(`/org/${org.id}`);
                }
              }}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="font-medium text-foreground truncate">{org.name}</span>
                {org.visibility && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ({org.visibility.toLowerCase()})
                  </span>
                )}
              </div>
              {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/app/apply-organization")}
          className="text-xs text-primary font-medium cursor-pointer flex items-center gap-2"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Apply to Create New Org</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
