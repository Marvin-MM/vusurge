import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skill, User } from "@/types";
import { cn } from "@/lib/utils";

export interface SkillBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  skill: Skill | string;
  className?: string;
}

export function SkillBadge({ skill, className, ...props }: SkillBadgeProps) {
  const name = typeof skill === "string" ? skill : skill.name;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/60",
        className
      )}
      {...props}
    >
      {name}
    </span>
  );
}

export function TagList({ tags, limit = 5, className }: { tags: string[]; limit?: number; className?: string }) {
  const visible = tags.slice(0, limit);
  const remaining = tags.length - limit;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-muted text-muted-foreground"
        >
          #{tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground font-medium pl-0.5">+{remaining} more</span>
      )}
    </div>
  );
}

export function UserAvatarGroup({
  users,
  max = 4,
  size = "sm",
}: {
  users: Array<{ id?: string; fullName?: string; name?: string; avatarUrl?: string }>;
  max?: number;
  size?: "sm" | "md";
}) {
  const visibleUsers = users.slice(0, max);
  const remaining = users.length - max;
  const sizeClasses = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <div className="flex items-center -space-x-2 overflow-hidden">
      {visibleUsers.map((user, idx) => {
        const name = user.fullName || user.name || "User";
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return (
          <Avatar key={user.id || idx} className={cn("ring-2 ring-background", sizeClasses)}>
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={name} referrerPolicy="no-referrer" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        );
      })}
      {remaining > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background font-semibold",
            sizeClasses
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

export function CountdownDisplay({ targetDate, label }: { targetDate: string; label?: string }) {
  const [timeLeft, setTimeLeft] = React.useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });

  React.useEffect(() => {
    function calculate() {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        ended: false,
      });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.ended) {
    return (
      <div className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
        <span>Deadline Ended</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>}
      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
        <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{timeLeft.days}d</span>
        <span>:</span>
        <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{String(timeLeft.hours).padStart(2, "0")}h</span>
        <span>:</span>
        <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{String(timeLeft.minutes).padStart(2, "0")}m</span>
        <span>:</span>
        <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{String(timeLeft.seconds).padStart(2, "0")}s</span>
      </div>
    </div>
  );
}
