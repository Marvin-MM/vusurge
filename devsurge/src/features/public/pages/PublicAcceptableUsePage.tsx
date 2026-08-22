import * as React from "react";
import { ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PublicAcceptableUsePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 text-foreground">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Platform Standards</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Acceptable Use Policy
        </h1>
        <p className="text-xs text-muted-foreground">
          Standard code of conduct and engineering guidelines across all challenges.
        </p>
      </div>

      <Card className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">Permitted & Encouraged Activities</h2>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Building open-source, reproducible technical architectures and prototypes.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Collaborating with international teammates and engaging in respectful discourse.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Leveraging permitted foundational models and open libraries with appropriate citations.</span>
            </li>
          </ul>
        </section>

        <section className="space-y-2 pt-4 border-t border-border/60">
          <h2 className="text-base font-bold text-foreground">Strictly Prohibited Conduct</h2>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>Submitting plagiarized, unauthorized, or pre-built turnkey commercial software without proper declaration.</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>Attempting to manipulate or influence judges or tampering with automated score telemetry.</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>Deploying malware, destructive scripts, or non-consensual tracking code in demonstration sandboxes.</span>
            </li>
          </ul>
        </section>
      </Card>
    </div>
  );
}
