import * as React from "react";
import { Search, Filter, X, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DetailItem {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  colSpan?: 1 | 2 | 3;
}

export function DetailList({
  items,
  columns = 2,
  className,
}: {
  items: DetailItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", colClasses[columns], className)}>
      {items.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <div className="text-sm font-medium text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
  status: "COMPLETED" | "CURRENT" | "UPCOMING";
}

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <div className={cn("space-y-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border", className)}>
      {events.map((event) => {
        const dotStyles = {
          COMPLETED: "bg-emerald-500 ring-4 ring-emerald-500/20",
          CURRENT: "bg-primary ring-4 ring-primary/25 animate-pulse",
          UPCOMING: "bg-muted-foreground/40 ring-4 ring-muted",
        };

        return (
          <div key={event.id} className="relative group">
            <div
              className={cn(
                "absolute -left-[22px] top-1 h-3 w-3 rounded-full transition-all",
                dotStyles[event.status]
              )}
            />
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{event.title}</span>
                <span className="text-xs text-muted-foreground font-mono">{event.date}</span>
              </div>
              {event.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Filter records...",
  onExport,
  actions,
  filterControls,
}: {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  onExport?: () => void;
  actions?: React.ReactNode;
  filterControls?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
      <div className="flex flex-1 items-center gap-2 max-w-sm">
        {onSearchChange && (
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {filterControls}
      </div>
      <div className="flex items-center gap-2">
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} className="h-9 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
