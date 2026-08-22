import * as React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Gavel, ClipboardList, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export function JudgeShell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const judgeNavItems = [
    { to: "/judge", label: "My Assignments", icon: ClipboardList, end: true },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Judge Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/judge" className="flex items-center gap-2 group">
              <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <Gavel className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-foreground">
                  DevArena Judge Suite
                </span>
                <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-widest leading-none">
                  Evaluation Workspace
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1">
              {judgeNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        isActive
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                      )
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/app")}
              className="text-xs h-8 gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Participant Portal</span>
            </Button>

            <Avatar className="h-8 w-8 ring-1 ring-purple-400/40">
              <AvatarImage src={user?.avatarUrl} alt={user?.fullName} referrerPolicy="no-referrer" />
              <AvatarFallback className="text-xs">
                {(user?.fullName || user?.email || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Main Outlet */}
      <main className="flex-1 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>

    </div>
  );
}
