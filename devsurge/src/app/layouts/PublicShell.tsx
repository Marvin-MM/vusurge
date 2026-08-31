import * as React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Sparkles, Menu, ArrowRight, ShieldCheck, Trophy, Building2, LayoutDashboard, LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SearchDialog } from "@/components/shared/SearchDialog";
import { useAuth } from "@/context/AuthContext";
import GhostFibers from "@/features/public/components/GhostFibers";

export function PublicShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  // Ctrl/Cmd-K is the conventional shortcut for an in-place search palette.
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

  const navLinks = [
    { to: "/challenges", label: "Challenges", icon: Trophy },
    { to: "/organizations", label: "Community", icon: Building2 },
    { to: "/results", label: "Results", icon: Trophy },
    { to: "/how-it-works", label: "Learn", icon: Sparkles },
    // { to: "/about", label: "About", icon: ShieldCheck },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Public Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group cursor-pointer transition-opacity hover:opacity-90">
              <img src="/surgeLogo.png" alt="VUSurge" className="h-8 group-hover:scale-105 transition-transform" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm transition-colors ${isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Search">
                <Search className="h-4 w-4" />
              </Button>
              {isLoading ? (
                <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
              ) : isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                        {(user?.fullName || user?.email || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <span className="max-w-[120px] truncate">{user?.fullName || user?.email}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate("/app")} className="gap-2 cursor-pointer">
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      <span>My Workspace</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="p-5 px-8 uppercase" onClick={() => navigate("/auth/signin")}>
                    Sign In
                  </Button>
                  <Button size="sm" onClick={() => navigate("/auth/signup")} className="gap-1.5 p-5 px-8 uppercase shadow-xs rounded-full">
                    <span>Get Started</span>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 sm:w-80">
                  <SheetHeader className="text-left pb-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2 text-base">
                      <img src="/surgeLogo.png" alt="VUSurge" className="h-6" />
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-2 py-4">
                    {navLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            }`
                          }
                        >
                          <Icon className="h-4 w-4" />
                          <span>{link.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                  <div className="mt-auto pt-6 border-t border-border flex flex-col gap-2">
                    {isAuthenticated ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-center"
                          onClick={() => {
                            setMobileOpen(false);
                            navigate("/app");
                          }}
                        >
                          My Workspace
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-center text-destructive"
                          onClick={() => {
                            setMobileOpen(false);
                            void handleSignOut();
                          }}
                        >
                          Sign Out
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-center"
                          onClick={() => {
                            setMobileOpen(false);
                            navigate("/auth/signin");
                          }}
                        >
                          Sign In
                        </Button>
                        <Button
                          className="w-full justify-center"
                          onClick={() => {
                            setMobileOpen(false);
                            navigate("/auth/signup");
                          }}
                        >
                          Get Started
                        </Button>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Outlet */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Public Footer */}
      <footer className="relative overflow-hidden bg-background py-12 text-sm text-muted-foreground">
        <div
          className="absolute inset-0 pointer-events-none [mask-image:linear-gradient(to_bottom,transparent,black_20%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_20%)]"
          aria-hidden="true"
        >
          <GhostFibers
            lineColor="#140E35"
            glowColor="#3437A0"
            speed={0.2}
            scale={2}
            rotation={0}
            rotationSpeed={0.25}
            layers={4}
            waveAmplitude={0.015}
            waveFrequency={3}
            waveSpeed={0.15}
            layerSpeed={0.08}
            twist={0.1}
            twistFrequency={5}
            twistSpeed={1.2}
            lineFrequency={5}
            lineSpacing={2}
            lineSharpness={16}
            glowFalloff={10}
            glowIntensity={1.6}
            brightness={2}
            blueBoost={1.25}
            vignette={0.8}
            grain={0.05}
            dpr={1}
            lightMode
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <img src="/surgeLogo.png" alt="VUSurge" className="h-8" />
            </div>
            <p className="text-xs leading-relaxed max-w-xs">
              Multi-tenant challenge and hackathon platform: organizations run challenges, teams submit projects, and
              judges score them against structured rubrics.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/challenges" className="hover:text-foreground">Explore Challenges</Link></li>
              <li><Link to="/organizations" className="hover:text-foreground">Browse Organizations</Link></li>
              <li><Link to="/results" className="hover:text-foreground">Results & Winners</Link></li>
              <li><Link to="/how-it-works" className="hover:text-foreground">How It Works</Link></li>
              <li><Link to="/app/apply-organization" className="hover:text-foreground">Host a Challenge</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Governance & Trust</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/about" className="hover:text-foreground">About VUSurge</Link></li>
              <li><Link to="/faq" className="hover:text-foreground">FAQ & Rules</Link></li>
              <li><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to="/acceptable-use" className="hover:text-foreground">Acceptable Use Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Portals & Workspaces</h4>
            <div className="flex flex-col gap-1.5 text-xs">
              <Link to="/app" className="hover:text-primary transition-colors">Participant Dashboard</Link>
              <Link to="/onboarding/join-code" className="hover:text-primary transition-colors">Redeem Join Code</Link>
              <Link to="/judge" className="hover:text-primary transition-colors">Judge Evaluation Suite</Link>
              <Link to="/admin" className="hover:text-primary transition-colors">Platform Superadmin</Link>
            </div>
          </div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between text-xs gap-4">
          <p>© {new Date().getFullYear()} VUSurge Innovation Platform. All rights reserved.</p>
        </div>
      </footer>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
