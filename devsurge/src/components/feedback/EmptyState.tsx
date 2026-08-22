import * as React from "react";
import { LucideIcon, Inbox, AlertTriangle, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  title = "No records found",
  description = "There are no items matching your criteria in this workspace.",
  icon: Icon = Inbox,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed bg-card/50", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
        {(action || secondaryAction) && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {action && (
              <Button size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | { message?: string; status?: number } | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Unable to load data",
  description = "A network or server error occurred while retrieving this resource.",
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Card className={cn("border-rose-500/20 bg-rose-50/20 dark:bg-rose-950/10", className)}>
      <CardContent className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 mb-3">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-md">
          {error?.message || description}
        </p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="mt-4 gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PermissionDeniedState({
  title = "Access Restricted",
  description = "You do not possess the required permissions or role assignments to view this management section.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <Card className={cn("border-amber-500/20 bg-amber-50/20 dark:bg-amber-950/10", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
        {action && (
          <Button size="sm" onClick={action.onClick} className="mt-5">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function LoadingState({
  message = "Loading workspace data...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 gap-3", className)}>
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="text-xs font-medium text-muted-foreground">{message}</span>
    </div>
  );
}
