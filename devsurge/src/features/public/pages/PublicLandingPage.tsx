import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Trophy,
  ShieldCheck,
  ArrowRight,
  Building2,
  Compass,
  Cpu,
  FileCheck2,
  TrendingUp,
  CheckCircle2,
  Briefcase,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePublicChallenges } from "@/features/challenges/api/queries";
import { usePublicOrganizations } from "@/features/organizations/api/queries";
import { PublicChallengeCard } from "@/components/shared/PublicChallengeCard";
import { FeaturedChallengeCard } from "@/components/shared/FeaturedChallengeCard";
import { OrganizationCard } from "@/components/shared/OrganizationCard";
import { FAQList, FAQItem } from "@/components/shared/FAQList";

const previewFAQs: FAQItem[] = [
  {
    question: "How does DevArena work?",
    answer:
      "Organizations run challenges — hackathons, bounties, or open calls. You browse public challenges, register solo or with a team, submit your project before the deadline, and assigned judges score it against a published rubric.",
  },
  {
    question: "Do I need to join an organization to participate?",
    answer:
      "Depends on the challenge. Some are open to any authenticated user; others require approved membership in the hosting organization first.",
  },
  {
    question: "How can my organization host a challenge?",
    answer:
      "Apply to create an organization from the Organizations page. Once approved, you can publish and manage challenges from your own admin dashboard.",
  },
];

export function PublicLandingPage() {
  const navigate = useNavigate();
  const { items: challenges } = usePublicChallenges();
  const { items: organizations } = usePublicOrganizations();

  const featuredChallenge = challenges[0];
  const previewChallenges = challenges.slice(featuredChallenge ? 1 : 0, featuredChallenge ? 4 : 3);
  const previewOrgs = organizations.slice(0, 3);

  return (
    <div className="space-y-24 pb-24 text-foreground selection:bg-primary/20">
      {/* 1. Hero & Value Proposition */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Multi-Tenant Challenge & Hackathon Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-foreground">
            Run challenges. Build teams. <span className="text-primary">Judge fairly.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
            DevArena is where organizations host hackathons and innovation challenges, participants form teams and
            submit projects, and judges score them against structured, weighted rubrics — end to end.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button size="lg" onClick={() => navigate("/challenges")} className="gap-2 shadow-xs font-semibold">
              <span>Explore Challenges</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/app/apply-organization")}
              className="gap-2 font-medium"
            >
              <Building2 className="h-4 w-4 text-primary" />
              <span>Host a Challenge</span>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Featured / Active Challenge Spotlight */}
      {featuredChallenge && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Spotlight</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Recently Published Challenge
              </h2>
            </div>
            <Link to="/challenges" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              <span>View All Challenges</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <FeaturedChallengeCard challenge={featuredChallenge} />
        </section>
      )}

      {/* 3. How DevArena Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">How It Works</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            From Registration to Results
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: "01",
              title: "Discover & Register",
              desc: "Browse public challenges, check team size and eligibility rules, and register solo or with a team.",
              icon: Compass,
            },
            {
              step: "02",
              title: "Build & Submit",
              desc: "Work with your team, then submit your project — repository, demo links, and a description — before the deadline.",
              icon: Cpu,
            },
            {
              step: "03",
              title: "Judging",
              desc: "Assigned judges score finalized submissions against the challenge's published rubric.",
              icon: FileCheck2,
            },
            {
              step: "04",
              title: "Results",
              desc: "Once judging is finalized, the organizer publishes rankings and winners on the challenge's Results tab.",
              icon: TrendingUp,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.step} className="p-6 rounded-2xl border border-border/80 bg-card hover:border-primary/50 transition-all space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xl font-black text-muted-foreground/40">{item.step}</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4. Dual Benefits (Participants vs Organizations) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl border border-border/80 bg-card space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>For Participants</span>
            </div>
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              Find a challenge, build with a team, get judged fairly.
            </h3>
            <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Browse challenges hosted by any organization on the platform, filtered by status and org.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Form or join a team, then submit your project with repository, demo, and pitch links.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Every submission is scored against the same published rubric — no hidden criteria.</span>
              </div>
            </div>
            <Button onClick={() => navigate("/challenges")} className="gap-2">
              <span>Browse Active Challenges</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="p-8 rounded-3xl border border-border/80 bg-card space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-500/20">
              <Briefcase className="h-3.5 w-3.5" />
              <span>For Organizations</span>
            </div>
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              Host a challenge and manage the whole lifecycle.
            </h3>
            <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Author challenge details, tracks, prizes, sponsors, and terms of participation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Assign judges and build a weighted scoring rubric before submissions open.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Manage members, review join requests, and track submissions from one dashboard.</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/app/apply-organization")} className="gap-2">
              <span>Apply for Organization Account</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* 5. Active Challenges Directory Preview */}
      {previewChallenges.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Directory</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Open Challenges
              </h2>
            </div>
            <Link to="/challenges" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              <span>Explore All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {previewChallenges.map((chal) => (
              <PublicChallengeCard key={chal.id} challenge={chal} layout="grid" />
            ))}
          </div>
        </section>
      )}

      {/* 6. Featured Organizations Preview */}
      {previewOrgs.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Ecosystem</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Host Organizations
              </h2>
            </div>
            <Link to="/organizations" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
              <span>Browse All Organizations</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {previewOrgs.map((org) => (
              <OrganizationCard key={org.id} organization={org} />
            ))}
          </div>
        </section>
      )}

      {/* 7. FAQ Preview */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="space-y-1 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Frequently Asked Questions</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Everything You Need to Know
          </h2>
        </div>

        <FAQList items={previewFAQs} allowSearch={false} />

        <div className="text-center pt-2">
          <Link to="/faq" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
            <span>View Full Knowledge Base</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* 8. Final CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border/80 bg-linear-to-r from-primary/10 via-card to-card p-8 sm:p-12 lg:p-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 shadow-md">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Ready to get started?
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Create your account, find a challenge or a team, or apply to host your organization's next challenge.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button size="lg" onClick={() => navigate("/auth/signup")} className="gap-2 font-semibold">
              <span>Get Started Free</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/app/apply-organization")} className="font-medium">
              <span>Host a Challenge</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
