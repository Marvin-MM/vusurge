import * as React from "react";
import { NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import type { Permission } from "@/types/permissions";

export interface SectionTab {
  /** Route path relative to the shell (e.g. "members"). */
  to: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Hides the tab when the viewer lacks this permission. */
  permission?: Permission;
}

/**
 * A pathless route layout that groups closely-related pages behind one nav
 * entry, with in-page tabs to move between them.
 *
 * Each child keeps its own route, URL, and permission guard — so existing
 * links, bookmarks, and deep links keep working exactly as before, and a tab
 * the viewer cannot use is simply not offered (the child's own guard still
 * enforces it if they navigate directly). The tab strip sits above the child's
 * own PageContainer and matches its horizontal padding so the two align.
 */
export function SectionTabsLayout({
  tabs,
  basePath,
}: {
  tabs: SectionTab[];
  /** Absolute prefix the tabs' `to` values are resolved against, e.g. "/org/123". */
  basePath: string;
}) {
  const { userContext } = useAuth();
  const location = useLocation();

  const visibleTabs = tabs.filter(
    (tab) => !tab.permission || can(userContext, tab.permission)
  );

  // Every tab in this group is gated away — let the child's own guard render
  // the standard "restricted" screen rather than showing an empty strip.
  if (visibleTabs.length === 0) return <Outlet />;

  // Landing on the group's base path with no section selected: send the
  // viewer to the first section they can actually see.
  if (location.pathname === basePath || location.pathname === `${basePath}/`) {
    return <Navigate to={`${basePath}/${visibleTabs[0].to}`} replace />;
  }

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <nav
          className="flex items-center gap-1 overflow-x-auto border-b border-border/80 scrollbar-none"
          aria-label="Section"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={`${basePath}/${tab.to}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </>
  );
}
