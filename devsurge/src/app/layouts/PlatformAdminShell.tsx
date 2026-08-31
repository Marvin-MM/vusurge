import * as React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  Building2,
  Trophy,
  History,
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  LifeBuoy,
  Activity,
  Menu,
  UserRound,
  BarChart3,
  Settings,
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
import { useAuth } from "@/context/AuthContext";
import { useUiStore } from "@/stores/useUiStore";
import { can } from "@/types/permissions";
import { cn } from "@/lib/utils";
import { MfaEnrollmentGate } from "@/features/superadmin/components/MfaEnrollmentGate";

export function PlatformAdminShell() {
  const { user, userContext, logout } = useAuth();
  const { sidebarCollapsed, toggleSidebar, setWorkspace } = useUiStore();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Any platform role (SUPERADMIN or SUPPORT_AGENT) may enter the shell —
  // PLATFORM_SUPPORT_AGENT holds only `platform.support`+`platform.moderate`,
  // a strict subset of superadmin's permissions.
  const hasAnyPlatformRole =
    userContext.globalRole === "PLATFORM_SUPERADMIN" || userContext.globalRole === "PLATFORM_SUPPORT_AGENT";

  // Each destination declares the permission that actually admits the viewer,
  // so a support agent is not shown entries whose pages (and whose backend
  // routes) will refuse them. Entries without a permission are reachable by
  // any platform role: the overview is a summary of whatever the viewer can
  // already see, while the health page hits the unauthenticated readiness probe.
  const adminNavItems = [
    { to: "/admin", label: "Global Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/organizations", label: "Org Vetting & Tenants", icon: Building2, permission: "platform.manage_organizations" as const },
    { to: "/admin/moderation", label: "Content Moderation", icon: ShieldAlert, permission: "platform.moderate" as const },
    { to: "/admin/support", label: "Support & Operations", icon: LifeBuoy, permission: "platform.support" as const },
    { to: "/admin/challenges", label: "Global Challenges", icon: Trophy, permission: "platform.manage_organizations" as const },
    { to: "/admin/users", label: "Platform Users", icon: UserRound, permission: "platform.manage_roles" as const },
    { to: "/admin/analytics", label: "Platform Analytics", icon: BarChart3, permission: "platform.manage_organizations" as const },
    { to: "/admin/platform-settings", label: "Platform Settings", icon: Settings, permission: "platform.manage_feature_flags" as const },
    { to: "/admin/health", label: "Infrastructure Telemetry", icon: Activity },
    { to: "/admin/audit-logs", label: "Global Audit Trail", icon: History, permission: "platform.view_audit" as const },
  ].filter((item) => !item.permission || can(userContext, item.permission));

  if (!hasAnyPlatformRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Access Required</h1>
        <p className="text-sm text-muted-foreground max-w-md mt-2">
          Your account ({user?.email || "signed in"}) does not hold a platform role (Superadmin or Support Agent).
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => navigate("/app")}>Go to Participant Portal</Button>
          <Button variant="outline" onClick={() => navigate("/public/challenges")}>
            Explore Public Challenges
          </Button>
        </div>
      </div>
    );
  }

  // Superadmins must have 2FA enrolled before accessing the portal.
  // Support agents are not subject to this requirement.
  if (
    userContext.globalRole === "PLATFORM_SUPERADMIN" &&
    !user?.twoFactorEnabled
  ) {
    return <MfaEnrollmentGate email={user?.email} />;
  }

  return (
    <div className="h-screen overflow-hidden flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-slate-950 text-slate-100 transition-all duration-300 z-30 shrink-0",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="h-16 border-b border-slate-800 px-3 flex items-center justify-between gap-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <img src="/surgeLogo.png" alt="VUSurge" className="h-8" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-amber-400 uppercase font-semibold tracking-wider">
                  Platform Admin
                </span>
              </div>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 mx-auto">
              <Shield className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Governance & Oversight
            </div>
          )}
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between py-2 rounded-md text-xs font-medium transition-colors cursor-pointer group",
                    isActive
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-300 hover:text-white hover:bg-slate-900",
                    sidebarCollapsed ? "justify-center px-0" : "px-3"
                  )
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
              </NavLink>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setWorkspace("participant");
              navigate("/app");
            }}
            className={cn(
              "w-full justify-center text-xs gap-2 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white",
              sidebarCollapsed && "px-0"
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {!sidebarCollapsed && <span>Participant View</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile nav trigger — the sidebar is desktop-only (`hidden md:flex`
                above); below that breakpoint this Sheet is the only way to
                reach any platform-admin nav item. */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Toggle navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col bg-slate-950 text-slate-100 border-slate-800">
                <SheetHeader className="text-left px-4 pt-4 pb-3 border-b border-slate-800">
                  <SheetTitle className="flex items-center gap-2 text-white">
                    <img src="/surgeLogo.png" alt="VUSurge" className="h-6" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-amber-400 uppercase font-semibold tracking-wider">Platform Admin</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                  <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Governance & Oversight</div>
                  {adminNavItems.map((item) => {
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
                              ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                              : "text-slate-300 hover:text-white hover:bg-slate-900"
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setWorkspace("participant");
                      navigate("/app");
                    }}
                    className="w-full justify-center text-xs gap-2 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Participant View</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
              {userContext.globalRole === "PLATFORM_SUPERADMIN" ? "SUPERADMIN CONSOLE" : "SUPPORT AGENT CONSOLE"}
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
              Multi-tenant Platform Governance & Global Controls
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/app")}
              className="text-xs h-8 gap-1.5"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Participant Portal</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <Avatar className="h-8 w-8 ring-2 ring-amber-500/50">
                    <AvatarImage src={user?.avatarUrl} alt={user?.fullName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="text-xs font-bold">
                      {(user?.fullName || user?.email || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs">
                  <div className="font-semibold text-foreground">{user?.fullName || user?.email}</div>
                  <div className="text-muted-foreground font-normal">
                    {userContext.globalRole === "PLATFORM_SUPERADMIN" ? "Platform Superadmin" : "Platform Support Agent"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate("/auth/signin");
                  }}
                  className="text-xs cursor-pointer text-rose-600 dark:text-rose-400"
                >
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
