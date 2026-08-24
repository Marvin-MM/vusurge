import * as React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, MessageSquare } from "lucide-react";
import { FAQList, FAQItem } from "@/components/shared/FAQList";
import { Button } from "@/components/ui/button";

// Platform-wide FAQ is editorial content, not backend-driven — the
// backend's FAQ resource is scoped per-challenge only (see
// GET /public/organizations/:slug/challenges/:slug/faqs, shown on each
// challenge's own detail page), there is no concept of a platform-level FAQ
// database record.
const FAQS: FAQItem[] = [
  {
    question: "How does VUSurge work?",
    answer:
      "Organizations create accounts and run challenges — hackathons, bounties, or open innovation calls. Anyone can browse public challenges without an account; to participate, you sign up, join or register for a challenge, optionally form a team, and submit your project before the deadline. Judges assigned by the organizer score submissions against a rubric, and results are published once judging is finalized.",
    category: "General",
  },
  {
    question: "Do I need to join an organization to participate?",
    answer:
      "It depends on the challenge's participation policy. Some challenges are open to any authenticated user; others require you to first be an approved member of the hosting organization (via invitation, join code, or a request-to-join flow, depending on how that organization is configured).",
    category: "General",
  },
  {
    question: "Can I compete solo, or do I need a team?",
    answer:
      "Each challenge sets its own team size rules and whether solo participation is allowed. Check the challenge's detail page — team size limits and solo eligibility are shown there.",
    category: "Challenges & Submissions",
  },
  {
    question: "What happens after the submission deadline?",
    answer:
      "Once a challenge's submission deadline passes, the challenge closes to new or edited submissions and moves into judging. Assigned judges score finalized submissions against the challenge's rubric; once judging is finalized and results are published, rankings appear on the challenge's Results tab.",
    category: "Judging & Rubrics",
  },
  {
    question: "How is judging conducted?",
    answer:
      "Organizations assign judges to a challenge and define a weighted scoring rubric. Judges score each assigned submission against every rubric criterion; an organizer finalizes and publishes results once scoring is complete.",
    category: "Judging & Rubrics",
  },
  {
    question: "How do I host a challenge for my organization?",
    answer:
      "Apply to create an organization from the Organizations page. Once your application is reviewed and approved by the platform team, you become the organization's owner and can invite admins, publish challenges, and manage the full lifecycle from your organization's admin dashboard.",
    category: "Organizations & Hosting",
  },
  {
    question: "Can I edit my submission after finalizing it?",
    answer:
      "A finalized submission is locked for judging integrity. If you need changes, contact the organizing team before the deadline — some organizers allow a submission to be reopened at their discretion.",
    category: "Challenges & Submissions",
  },
];

export function PublicFAQPage() {
  const categories = ["General", "Challenges & Submissions", "Judging & Rubrics", "Organizations & Hosting"];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 text-foreground">
      {/* Header */}
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Knowledge Base</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Frequently Asked Questions
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          How challenges, teams, submissions, and judging work on VUSurge. Looking for rules on a specific
          challenge? Check its own FAQ tab.
        </p>
      </div>

      <FAQList items={FAQS} categories={categories} allowSearch />

      {/* Still need help box */}
      <div className="p-6 rounded-2xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">Have a question not answered here?</h4>
          <p className="text-xs text-muted-foreground">Reach out and we'll point you in the right direction.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
          <Link to="/about">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Contact Support</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
