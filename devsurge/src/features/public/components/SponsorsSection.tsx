"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";

// ─── Sponsor Data ──────────────────────────────────────────────────────────────
// To add more sponsors: append to this array.
// Set `featured: true` for sponsors that power/anchor the platform.
interface Sponsor {
  name: string;
  logoUrl: string;
  url: string;
  featured?: boolean;
}

const sponsors: Sponsor[] = [
  {
    name: "Victoria University Kampala",
    logoUrl: "https://vu.ac.ug/_nuxt/vu-logo-with-words.D9F_ScYN.png",
    url: "https://vu.ac.ug/",
    featured: true,
  },
  // Future sponsors go here:
  // { name: "Acme Corp", logoUrl: "/sponsors/acme.svg", url: "https://acme.com" },
];

const featuredSponsor = sponsors.find((s) => s.featured);
const otherSponsors = sponsors.filter((s) => !s.featured);

// ─── Animated Ticker (for when more sponsors are present) ─────────────────────
function SponsorTicker({ items }: { items: Sponsor[] }) {
  // Duplicate items so the ticker loops seamlessly
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden w-full [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <motion.div
        className="flex gap-12 items-center w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity }}
      >
        {doubled.map((s, i) => (
          <a
            key={`${s.name}-${i}`}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.name}
            className="flex items-center justify-center opacity-50 grayscale hover:opacity-90 hover:grayscale-0 transition-all duration-300 shrink-0"
          >
            <img
              src={s.logoUrl}
              alt={s.name}
              className="h-7 max-w-[160px] object-contain"
            />
          </a>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export function SponsorsSection() {
  const ref = React.useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section
      ref={ref}
      className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      aria-label="Partners & Sponsors"
    >
      {/* Section label */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Backed &amp; Powered by
        </p>

        {/* ── Featured sponsor (full, prominent) ── */}
        {featuredSponsor && (
          <motion.a
            href={featuredSponsor.url}
            target="_blank"
            rel="noopener noreferrer"
            title={featuredSponsor.name}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            whileHover={{ scale: 1.03 }}
            className="group relative flex flex-col items-center gap-2 outline-none"
          >
            {/* Soft glow halo that appears on hover */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl bg-primary/10 pointer-events-none"
            />
            <img
              src={featuredSponsor.logoUrl}
              alt={featuredSponsor.name}
              className="h-10 sm:h-12 w-auto object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
            />
          </motion.a>
        )}

        {/* ── Separator ── */}
        {otherSponsors.length > 0 && (
          <>
            <div className="w-px h-5 bg-border/60 mt-1" aria-hidden="true" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Sponsors
            </p>
            {/* Ticker for additional sponsors */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="w-full mt-2"
            >
              <SponsorTicker items={otherSponsors} />
            </motion.div>
          </>
        )}
      </motion.div>
    </section>
  );
}
