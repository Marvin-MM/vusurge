import * as React from "react";
import { CheckCircle2, Clock, Calendar, AlertCircle } from "lucide-react";
import { Challenge } from "@/types";
import { cn } from "@/lib/utils";

export interface ChallengeTimelineProps {
  challenge: Challenge;
  className?: string;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ChallengeTimeline({ challenge, className }: ChallengeTimelineProps) {
  const now = new Date().getTime();

  const regStart = challenge.registrationOpenAt ? new Date(challenge.registrationOpenAt).getTime() : null;
  const regEnd = challenge.registrationCloseAt ? new Date(challenge.registrationCloseAt).getTime() : null;
  const subStart = challenge.submissionOpenAt ? new Date(challenge.submissionOpenAt).getTime() : null;
  const subEnd = challenge.submissionDeadline ? new Date(challenge.submissionDeadline).getTime() : null;
  const judgeEnd = challenge.judgingEndAt ? new Date(challenge.judgingEndAt).getTime() : null;
  const resPublish = challenge.resultsPublishedAt ? new Date(challenge.resultsPublishedAt).getTime() : null;

  const milestones = [
    {
      id: "reg-start",
      label: "Registration Opens",
      date: fmt(challenge.registrationOpenAt),
      isPassed: regStart != null && now >= regStart,
      isCurrent: regStart != null && now >= regStart && (regEnd == null || now < regEnd),
    },
    {
      id: "sub-start",
      label: "Submissions Open",
      date: fmt(challenge.submissionOpenAt),
      isPassed: subStart != null && now >= subStart,
      isCurrent: subStart != null && now >= subStart && (subEnd == null || now < subEnd),
    },
    {
      id: "sub-end",
      label: "Submission Deadline",
      date: fmt(challenge.submissionDeadline),
      isPassed: subEnd != null && now >= subEnd,
      isCurrent: subEnd != null && now >= subEnd && (judgeEnd == null || now < judgeEnd),
    },
    {
      id: "judge-end",
      label: "Evaluation & Deliberation",
      date: `${fmt(challenge.submissionDeadline)} - ${fmt(challenge.judgingEndAt)}`,
      isPassed: judgeEnd != null && now >= judgeEnd,
      isCurrent: subEnd != null && now >= subEnd && judgeEnd != null && now < judgeEnd,
    },
    {
      id: "results-pub",
      label: "Results & Winner Announcement",
      date: fmt(challenge.resultsPublishedAt),
      isPassed: resPublish != null && now >= resPublish,
      isCurrent: resPublish != null && now >= resPublish,
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Competition Lifecycle
        </h4>
        <span className="text-xs font-medium text-primary">Informational Schedule</span>
      </div>

      <div className="relative border-l-2 border-border/80 ml-3.5 pl-6 space-y-6">
        {milestones.map((m, idx) => {
          return (
            <div key={m.id} className="relative group">
              {/* Node indicator */}
              <div
                className={cn(
                  "absolute -left-[31px] top-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs transition-colors",
                  m.isPassed
                    ? "bg-primary text-primary-foreground border-primary"
                    : m.isCurrent
                    ? "bg-background border-primary text-primary animate-pulse"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                {m.isPassed ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : m.isCurrent ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-[10px] font-bold">{idx + 1}</span>
                )}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-bold",
                      m.isCurrent
                        ? "text-primary font-extrabold"
                        : m.isPassed
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {m.label}
                  </span>
                  {m.isCurrent && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                      Active Phase
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{m.date}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
