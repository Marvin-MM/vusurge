import * as React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: string | number;
    positive?: boolean;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-150 relative overflow-hidden",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-xs",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 mt-1">
          <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
          {(description || trend) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center font-medium gap-0.5",
                    trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trend.value}
                </span>
              )}
              {description && <span>{description}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: "blue" | "emerald" | "amber" | "purple" | "slate";
}

export function MetricCard({ label, value, subtext, color = "blue" }: MetricCardProps) {
  const colorMap = {
    blue: "border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
    emerald: "border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300",
    purple: "border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300",
    slate: "border-border bg-card text-foreground",
  };

  return (
    <div className={cn("p-4 rounded-xl border", colorMap[color])}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1 text-foreground">{value}</div>
      {subtext && <div className="text-xs text-muted-foreground mt-0.5">{subtext}</div>}
    </div>
  );
}
