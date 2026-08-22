import * as React from "react";
import { Link, NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import {
  Sparkles,
  LayoutDashboard,
  Trophy,
  Users,
  Send,
  Gavel,
  BarChart3,
  Download,
  History,
  Settings,
  Mail,
  PanelLeftClose,
  PanelLeft,
  Briefcase,
  FileText,
  ChevronRight,
  Shield,
  ArrowLeft,
  Bell,
  CheckCircle2,
  LogOut,
  KeyRound,
  UserCheck,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OrganizationSwitcher } from "@/components/shared/OrganizationSwitcher";
import { RoleBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { useUiStore } from "@/stores/useUiStore";
import { useOrganization } from "@/features/organizations/api/queries";
import { can } from "@/types/permissions";
import { cn } from "@/lib/utils";

export function OrganizationAdminShell() {
  const { orgId = "" } = useParams();
  const { data: organization } = useOrganization(orgId);
  const { user, userContext, logout } = useAuth();
  const { sidebarCollapsed, toggleSidebar, setWorkspace, activeOrganizationId, setActiveOrganizationId } = useUiStore();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // The org-scoped role/permission checks throughout this shell (and every
  // page it hosts) key off `userContext.orgRole`, which AuthContext derives
  // from `activeOrganizationId` in the UI store — not from this route's
  // `:orgId` param. That store value is only otherwise written by the
  // OrganizationSwitcher, so a direct visit, deep link, or page refresh on
  // `/org/:orgId/*` left it pointing at whatever org was last active,
  // making every permission check here resolve to "no role" even for the
  // organization's own owner. Keep it in lockstep with the URL whenever
  // they diverge.
  React.useEffect(() => {
    if (orgId && orgId !== activeOrganizationId) {
      setActiveOrganizationId(orgId);
    }
  }, [orgId, activeOrganizationId, setActiveOrganizationId]);

  const orgName = organization?.name || "Apex Global Labs";

  const adminNavItems = [
    { to: `/org/${orgId}`, label: "Overview", icon: LayoutDashboard, end: true, permission: "organization.view_private" as const },
    { to: `/org/${orgId}/challenges`, label: "Challenges", icon: Trophy, permission: "challenge.view" as const },
    { to: `/org/${orgId}/submissions`, label: "Submissions Pool", icon: Send, permission: "submission.view_all" as const },
    { to: `/org/${orgId}/judging`, label: "Judging & Rubrics", icon: Gavel, permission: "challenge.manage_judges" as const },
    { to: `/org/${orgId}/members`, label: "Members & Access", icon: Users, permission: "organization.manage_members" as const },
    { to: `/org/${orgId}/invitations`, label: "Invitations", icon: Mail, permission: "organization.manage_members" as const },
    { to: `/org/${orgId}/join-codes`, label: "Join Codes", icon: KeyRound, permission: "organization.manage_join_codes" as const },
    { to: `/org/${orgId}/join-requests`, label: "Join Requests", icon: UserCheck, permission: "organization.review_join_requests" as const },
    { to: `/org/${orgId}/portfolio`, label: "Innovation Portfolio", icon: Briefcase, permission: "innovation.view" as const },
    { to: `/org/${orgId}/forms`, label: "Custom Forms", icon: FileText, permission: "organization.manage_forms" as const },
    { to: `/org/${orgId}/analytics`, label: "Analytics & Telemetry", icon: BarChart3, permission: "analytics.view_org" as const },
    { to: `/org/${orgId}/exports`, label: "Data Exports & Archives", icon: Download, permission: "organization.manage_settings" as const },
    { to: `/org/${orgId}/audit`, label: "Audit Logs", icon: History, permission: "organization.view_audit" as const },
    { to: `/org/${orgId}/settings`, label: "Org Settings", icon: Settings, permission: "organization.manage_settings" as const },
  ];

  const visibleNavItems = adminNavItems.filter((item) => can(userContext, item.permission));

  return (
    <div className="h-screen overflow-hidden flex bg-background text-foreground">
      {/* Sidebar 07 adapted for DevArena Organization Admin */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 z-30 shrink-0",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 border-b border-sidebar-border px-3 flex items-center justify-between gap-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs tracking-tight truncate text-sidebar-foreground">
                  {orgName}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                  Admin Console
                </span>
              </div>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground mx-auto">
              <Sparkles className="h-4 w-4" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        {/* Org Switcher Quick Bar */}
        {!sidebarCollapsed && (
          <div className="p-3 border-b border-sidebar-border/60">
            <OrganizationSwitcher className="w-full justify-between bg-sidebar-accent/50" />
          </div>
        )}

        {/* Nav Items */}
        <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Management
            </div>
          )}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer: Return to Participant Workspace */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setWorkspace("participant");
              navigate("/app");
            }}
            className={cn("w-full justify-center text-xs gap-2 text-muted-foreground hover:text-foreground", sidebarCollapsed && "px-0")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {!sidebarCollapsed && <span>Exit to Participant View</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile nav trigger — the sidebar is desktop-only (`hidden md:flex`
                above), so below that breakpoint this Sheet is the only way to
                reach any org-admin nav item. */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Toggle navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar text-sidebar-foreground">
                <SheetHeader className="text-left px-4 pt-4 pb-3 border-b border-sidebar-border">
                  <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-xs">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs tracking-tight truncate">{orgName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Admin Console</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3 border-b border-sidebar-border/60">
                  <OrganizationSwitcher className="w-full justify-between bg-sidebar-accent/50" />
                </div>
                <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                  <div className="px-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Management</div>
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileNavOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer",
                            isActive
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-sidebar-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setWorkspace("participant");
                      navigate("/app");
                    }}
                    className="w-full justify-center text-xs gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Exit to Participant View</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
              Org Admin Workspace
            </span>
            <span className="text-muted-foreground text-xs hidden sm:inline">•</span>
            <span className="text-xs text-muted-foreground font-medium truncate max-w-xs hidden sm:inline">
              {orgName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/app")}
              className="text-xs h-8 gap-1.5 hidden sm:flex"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Participant Portal</span>
            </Button>

            {/* Persona Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <Avatar className="h-8 w-8 ring-1 ring-border">
                    <AvatarImage src={user?.avatarUrl} alt={user?.fullName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="text-xs">
                      {(user?.fullName || user?.email || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs">
                  <div className="font-semibold text-foreground">{user?.fullName || user?.email}</div>
                  <div className="text-muted-foreground font-normal">{userContext.orgRole || "Member"}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/app")} className="text-xs cursor-pointer">
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                  <span>Go to Participant Workspace</span>
                </DropdownMenuItem>
                {userContext.globalRole === "PLATFORM_SUPERADMIN" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} className="text-xs cursor-pointer text-amber-600">
                    <Shield className="h-3.5 w-3.5 mr-2" />
                    <span>Go to Superadmin Console</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate("/auth/signin");
                  }}
                  className="text-xs cursor-pointer text-rose-600 dark:text-rose-400"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Workspace Outlet */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
