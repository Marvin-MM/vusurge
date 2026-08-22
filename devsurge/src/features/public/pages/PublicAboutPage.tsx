import * as React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, Target, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PublicAboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 text-foreground">
      {/* Hero */}
      <div className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
          <Sparkles className="h-3.5 w-3.5" />
          <span>About DevArena</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground leading-tight">
          A platform for running challenges end to end
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          DevArena gives organizations everything needed to host a challenge — from publishing details and managing
          teams to structured judging and published results — instead of stitching together spreadsheets, forms, and
          chat channels.
        </p>
      </div>

      {/* Core Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 rounded-2xl border border-border/80 bg-card space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-foreground">Multi-Tenant by Design</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Any organization can apply to host on DevArena. Each organization manages its own members, roles, and
            challenges, independent of every other organization on the platform.
          </p>
        </Card>

        <Card className="p-6 rounded-2xl border border-border/80 bg-card space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-foreground">Structured, Rubric-Based Judging</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every challenge is scored against a rubric its organizers define up front. Judges score assigned
            submissions against the same published criteria — no ad hoc evaluation.
          </p>
        </Card>

        <Card className="p-6 rounded-2xl border border-border/80 bg-card space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Target className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-foreground">A Full Lifecycle, Not Just a Form</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            From registration and team formation through submission, judging, and published results — the whole
            challenge lifecycle lives in one place.
          </p>
        </Card>
      </div>

      {/* Call to action */}
      <div className="p-8 sm:p-12 rounded-3xl border border-border/80 bg-muted/20 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">Ready to get involved?</h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
          Explore open challenges, or apply to host one for your own organization.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild className="gap-2">
            <Link to="/challenges">
              <span>Explore Challenges</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/apply-organization">
              <span>Apply as Organization</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
