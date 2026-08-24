import * as React from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Sparkles,
  Trophy,
  Users,
  Send,
  Bell,
  Search,
  Building2,
  Inbox,
  User as UserIcon,
  LogOut,
  Menu,
  Shield,
  Gavel,
  Briefcase,
  Compass,
  HelpCircle,
  ChevronDown,
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
import { SearchDialog } from "@/components/shared/SearchDialog";
import { OrganizationSwitcher } from "@/components/shared/OrganizationSwitcher";
import { useAuth } from "@/context/AuthContext";
import { useUnreadNotificationCount } from "@/features/notifications/api/queries";
import { useNotificationStream } from "@/lib/useNotificationStream";
import { RoleBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

/** A standard click-based dropdown for the navigation bar */
function NavDropdown({
  label,
  icon: Icon,
  active,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
            active
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ParticipantShell() {
  const { user, userContext, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useNotificationStream(isAuthenticated);
  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.count ?? 0;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // share one nav-bar slot each (click dropdown) rather than crowding the
  // bar with separate top-level links; Teams & Matchmaking is grouped under
  // Challenges; Organizations was dropped entirely since the
  // OrganizationSwitcher already covers that; Inbox/Support Desk
  // moved into the user dropdown (Inbox is redundant with the bell icon,
  // which stays as the one entry point for notifications).
  const challengesGroup = [
    { to: "/app/challenges", label: "Explore Challenges", icon: Trophy },
    { to: "/app/my-challenges", label: "My Challenges", icon: Briefcase },
    { to: "/app/teams", label: "Teams & Matchmaking", icon: Users },
  ];
  const submissionsGroup = [
    { to: "/app/submissions", label: "Submissions", icon: Send },
    { to: "/app/results", label: "Results", icon: Sparkles },
  ];
  const isChallengesGroupActive = challengesGroup.some((i) => location.pathname.startsWith(i.to));
  const isSubmissionsGroupActive = submissionsGroup.some((i) => location.pathname.startsWith(i.to));

  // Flat item list still used for the mobile Sheet nav (a flat scrollable list is simpler).
  const mobileNavItems: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean; badge?: number }[] = [
    { to: "/app", label: "Dashboard", icon: Compass, end: true },
    ...challengesGroup,
    ...submissionsGroup,
    { to: "/app/inbox", label: "Inbox & Support", icon: Inbox, badge: unreadCount > 0 ? unreadCount : undefined },
    { to: "/app/profile", label: "Profile & Account", icon: UserIcon },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link to="/app" className="flex items-center gap-2 group">
              <img src="/surgeLogo.png" alt="VUSurge" className="h-8 group-hover:scale-105 transition-transform" />
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-1">
              <NavLink
                to="/app"
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )
                }
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </NavLink>

              <NavDropdown label="Challenges" icon={Trophy} active={isChallengesGroupActive}>
                {challengesGroup.map((item) => (
                  <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)} className="text-xs cursor-pointer gap-2">
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
              </NavDropdown>

              <NavDropdown label="Submissions" icon={Send} active={isSubmissionsGroupActive}>
                {submissionsGroup.map((item) => (
                  <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)} className="text-xs cursor-pointer gap-2">
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
              </NavDropdown>
            </nav>
          </div>

          {/* Right Area: Org Switcher, Notifications, User Menu */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* The switcher renders a full organization name, which alone is
                wider than a phone's remaining header space — it moves into
                the mobile sheet below rather than overflowing the bar. */}
            <div className="hidden sm:block">
              <OrganizationSwitcher />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchOpen(true)}
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>

            {/* Notification Bell */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/app/inbox")}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
              <span className="sr-only">Notifications</span>
            </Button>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full ring-offset-background transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer">
                  <Avatar className="h-8 w-8 ring-1 ring-border">
                    <AvatarImage src={user?.avatarUrl} alt={user?.fullName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="text-xs">
                      {(user?.fullName || user?.email || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-xl">
                <DropdownMenuLabel className="font-normal px-2 py-1.5">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold leading-none text-foreground truncate">
                        {user?.fullName || user?.email}
                      </p>
                      <RoleBadge
                        role={userContext.globalRole === "PLATFORM_SUPERADMIN" ? "PLATFORM_SUPERADMIN" : userContext.orgRole}
                        className="text-[10px] py-0 h-4"
                      />
                    </div>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Workspace quick toggles */}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
                  Switch Workspace
                </DropdownMenuLabel>
                {userContext.orgRole && userContext.orgRole !== "MEMBER" && userContext.activeOrgId && (
                  <DropdownMenuItem
                    onClick={() => navigate(`/org/${userContext.activeOrgId}`)}
                    className="text-xs flex items-center gap-2 cursor-pointer text-primary font-medium"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Organization Admin Workspace</span>
                  </DropdownMenuItem>
                )}
                {userContext.challengeRoles && Object.values(userContext.challengeRoles).includes("JUDGE") && (
                  <DropdownMenuItem
                    onClick={() => navigate("/judge")}
                    className="text-xs flex items-center gap-2 cursor-pointer text-purple-600 dark:text-purple-400 font-medium"
                  >
                    <Gavel className="h-3.5 w-3.5" />
                    <span>Judge Workspace</span>
                  </DropdownMenuItem>
                )}
                {userContext.globalRole === "PLATFORM_SUPERADMIN" && (
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="text-xs flex items-center gap-2 cursor-pointer text-amber-600 dark:text-amber-400 font-medium"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Platform Superadmin Workspace</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/app/inbox")} className="text-xs cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-3.5 w-3.5" />
                    <span>Inbox</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuItem>
                {/* Inbox/Support Desk and Profile/Settings are each one
                    grouped page with in-page tabs now (see
                    src/app/layouts/sections.tsx) — these link to the group's
                    first tab, and the sibling is a tab away. */}
                <DropdownMenuItem onClick={() => navigate("/app/profile")} className="text-xs cursor-pointer gap-2">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>Profile & Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/support")} className="text-xs cursor-pointer gap-2">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Support Desk</span>
                </DropdownMenuItem>
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

            {/* Mobile Sheet Nav */}
            <div className="flex lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Toggle navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <SheetHeader className="text-left pb-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2 text-base">
                      <img src="/surgeLogo.png" alt="VUSurge" className="h-6" />
                      <span className="text-muted-foreground text-sm">Participant</span>
                    </SheetTitle>
                  </SheetHeader>
                  {/* Carries the organization switcher that the header hides
                      below the sm breakpoint. */}
                  <div className="pt-4 sm:hidden">
                    <OrganizationSwitcher className="w-full justify-between" />
                  </div>
                  <div className="flex flex-col gap-1.5 py-4">
                    {mobileNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )
                          }
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className="h-4 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Workspace Outlet */}
      <main className="flex-1">
        <Outlet />
      </main>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
