import * as React from "react";
import { Trophy, Award, Medal, Gift } from "lucide-react";
import { Prize } from "@/types";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface PrizeCardProps {
  key?: React.Key;
  prize: Prize;
  /** 0-indexed position within the prize list — used only to pick a rank icon (1st/2nd/3rd), not persisted. */
  position?: number;
  className?: string;
}

export function PrizeCard({ prize, position = 3, className }: PrizeCardProps) {
  const getRankBadge = (pos: number) => {
    switch (pos) {
      case 0:
        return { icon: Trophy, label: "1st Place", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
      case 1:
        return { icon: Award, label: "2nd Place", color: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30" };
      case 2:
        return { icon: Medal, label: "3rd Place", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30" };
      default:
        return { icon: Gift, label: "Prize", color: "bg-primary/10 text-primary border-primary/20" };
    }
  };

  const badgeInfo = getRankBadge(position);
  const Icon = badgeInfo.icon;

  return (
    <Card
      className={cn(
        "p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 shadow-xs",
        className
      )}
    >
      <div className="space-y-3">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border w-fit", badgeInfo.color)}>
          <Icon className="h-3.5 w-3.5" />
          <span>{badgeInfo.label}</span>
        </span>

        <div>
          <h4 className="text-base font-bold text-foreground leading-snug">{prize.title}</h4>
          <div className="text-xl sm:text-2xl font-extrabold text-foreground mt-1">{prize.valueLabel}</div>
        </div>

        {prize.description && <p className="text-xs text-muted-foreground leading-relaxed">{prize.description}</p>}
      </div>
    </Card>
  );
}
