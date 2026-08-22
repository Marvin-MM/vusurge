import * as React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  {
    num: "01",
    title: "Discover & Register",
    desc: "Browse public challenges by organization or status. Register solo or with a team, depending on what each challenge allows.",
    details: [
      "Filter challenges by status and hosting organization",
      "Post or browse team-formation matchmaking listings for a challenge",
      "Check team size limits and eligibility before registering",
    ],
  },
  {
    num: "02",
    title: "Build & Submit",
    desc: "Work with your team through the challenge window, then submit your project with repository, demo, and pitch links before the deadline.",
    details: [
      "Save a submission as a draft and keep editing until you finalize it",
      "Attach a repository, live demo, and pitch/presentation links",
      "Read organizer FAQs and announcements posted for the challenge",
    ],
  },
  {
    num: "03",
    title: "Judging",
    desc: "Once submissions are finalized, assigned judges score them against the rubric the organizer published for the challenge.",
    details: [
      "Every submission is scored against the same weighted criteria",
      "Organizers can enable blind judging to reduce evaluator bias",
      "Judges' scorecards feed into each submission's aggregate score",
    ],
  },
  {
    num: "04",
    title: "Results",
    desc: "Once judging is finalized, the organizer publishes rankings — visible on the challenge's public Results tab.",
    details: [
      "Final rankings and, where set, prize allocations are published",
      "Standout submissions can be promoted into the organization's innovation portfolio",
      "All actions are recorded in the organization's audit log",
    ],
  },
];

export function PublicHowItWorksPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 text-foreground">
      {/* Header */}
      <div className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
          <Sparkles className="h-3.5 w-3.5" />
          <span>The Challenge Lifecycle</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground leading-tight">
          How DevArena Works
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          A step-by-step walkthrough of how a challenge runs, from registration to published results.
        </p>
      </div>

      {/* Lifecycle Steps */}
      <div className="space-y-6">
        {steps.map((st) => (
          <Card key={st.num} className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Phase {st.num}</span>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">{st.title}</h3>
              </div>
              <span className="font-mono text-3xl sm:text-4xl font-black text-muted-foreground/30">{st.num}</span>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{st.desc}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
              {st.details.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <div className="p-8 rounded-3xl border border-border/80 bg-muted/20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Ready to compete or host a challenge?</h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="gap-2">
            <Link to="/challenges">
              <span>Browse Open Challenges</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/apply-organization">
              <span>Apply for Organization Host</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
