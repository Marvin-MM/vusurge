import * as React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, Trophy, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}

export function AuthLayout({ children, title, subtitle, className }: AuthLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-12 bg-background">
      {/* Left Form Canvas */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-4 sm:px-8 lg:px-12 xl:px-16 py-12">
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-2 group">
              <img src="/surgeLogo.png" alt="VUSurge" className="h-8 group-hover:scale-105 transition-transform" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div className={cn("space-y-6", className)}>{children}</div>
        </div>
      </div>

      {/* Right Product Showcase Canvas (Desktop only) */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-muted/40 border-l border-border/80 p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 max-w-lg space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Enterprise Innovation Protocol</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight">
              A unified operating system for high-stakes open challenges.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Join thousands of developers, researchers, and enterprise organizers building the next generation of deep-tech ventures with auditable scoring rubrics.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              "Multi-tenant challenge management with custom submission requirements",
              "Multi-criteria weighted rubric evaluations with blind scoring options",
              "Skill-based team discovery, matchmaking, and collaboration tools",
              "Direct venture incubation pathways, cloud compute credits, and grants",
            ].map((bullet, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs text-foreground font-medium leading-relaxed">
                  {bullet}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Testimonial / Credibility Box */}
        <div className="relative z-10 p-6 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md space-y-3 max-w-lg">
          <p className="text-xs text-foreground/90 italic leading-relaxed">
            "VUSurge solved the chaos of coordinating 800+ international researchers and 24 expert judges across 4 continents. The scoring audit trail is second to none."
          </p>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
            <div>
              <span className="font-bold text-foreground">Dr. Elena Rostova</span>
              <span className="text-muted-foreground block text-[11px]">
                Principal Researcher, Oxford Ventures
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              Verified Organizer
            </span>
          </div>
        </div>

        {/* Subtle decorative background geometry */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}
