import * as React from "react";
import { FileCheck, Shield, Award } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PublicTermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 text-foreground">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
          <FileCheck className="h-3.5 w-3.5" />
          <span>Legal Agreement</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="text-xs text-muted-foreground">
          Effective Date: February 15, 2026 • Enterprise Platform Edition
        </p>
      </div>

      <Card className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or creating an account on VUSurge, you agree to be bound by these Terms of Service and all competition-specific rules established by host organizations.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">2. Innovator IP Ownership Guarantee</h2>
          <p>
            Unless explicitly designated under custom enterprise sponsor terms agreed upon at registration, participants retain complete ownership of all pre-existing and generated intellectual property, code, algorithms, models, and presentation artifacts.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">3. Judging & Score Deliberation Finality</h2>
          <p>
            All evaluations conducted through VUSurge rubrics are scored by assigned domain experts. Published winners represent final, verified allocations compliant with platform audit requirements.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">4. Prize Distribution & Compliance</h2>
          <p>
            Organizers are legally bound to distribute specified prize pools to verified winners upon the conclusion of evaluation and identity verification audits.
          </p>
        </section>
      </Card>
    </div>
  );
}
