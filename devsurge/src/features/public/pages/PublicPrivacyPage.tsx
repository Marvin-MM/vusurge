import * as React from "react";
import { ShieldCheck, Lock, Eye, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PublicPrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 text-foreground">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
          <Lock className="h-3.5 w-3.5" />
          <span>Data Privacy & Security</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="text-xs text-muted-foreground">
          Last Updated: February 15, 2026 • Version 2.4 (Enterprise Multi-Tenant Protocol)
        </p>
      </div>

      <Card className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">1. Overview & Commitment</h2>
          <p>
            VUSurge ("Platform", "we", "us") values the privacy of innovators, judges, and organizing institutions. This policy details how participant profiles, team rosters, submission artifacts, and evaluation scores are processed and protected.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Identity & Account Details:</strong> Full name, professional email address, avatar, timezone, and biographical profile links (GitHub, LinkedIn, Portfolio).</li>
            <li><strong>Challenge Submissions:</strong> Code repositories, architecture diagrams, demo videos, and technical descriptions submitted to active sprints.</li>
            <li><strong>Institutional Affiliation:</strong> Verified organization join codes, invitation tokens, and role assignments.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">3. Intellectual Property and Code Privacy</h2>
          <p>
            Submissions uploaded to private or restricted challenges are shared exclusively with verified judges and organizers assigned to that specific tournament. Code and algorithm IP remains 100% the property of the innovator teams.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">4. Data Storage & Security Standards</h2>
          <p>
            All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Multi-tenant organizational workspaces enforce strict cryptographic isolation boundaries.
          </p>
        </section>
      </Card>
    </div>
  );
}
