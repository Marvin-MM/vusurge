# DevArena — Build Contract & Architecture Principles

This document defines the foundational engineering standards and architectural rules governing the DevArena frontend platform.

---

## 1. Core Principles

1. **Strict User Intent & Scope Discipline**:
   * Every component, layout, and interaction directly maps to defined domain requirements.
   * No unrequested external widgets, unsolicited artificial marketing fluff, or arbitrary third-party APIs.

2. **Clean Transport Isolation**:
   * UI components interact with domain data exclusively via typed TanStack Query hooks in feature `/api/queries.ts` modules.
   * Direct fixture imports into React components are strictly banned.
   * Mock responses accurately mirror future `/api/v1` backend schemas.

3. **Type Safety & Zero Runtime Warnings**:
   * 100% TypeScript type safety with complete enum fidelity.
   * No loose `any` casts to suppress compiler checks.

4. **Accessibility First (WCAG AA)**:
   * Accessible keyboard navigation with visible focus indicators.
   * Explicit `aria-label` tags on icon buttons.
   * High-contrast text compliance without relying on color as the sole indicator of status.

---

## 2. Design System Tokens & Archetype

* **Primary Palette**: Deep slate `#020817` canvas paired with vibrant Indigo/Violet accent highlights (`#6366f1` / `#7c3aed`), emerald status signals (`#10b981`), amber cautions (`#f59e0b`), and rose critical flags (`#ef4444`).
* **Density Scalability**:
  * Public Discovery: Spacious, consumer-friendly layout with readable typography.
  * Participant Workspace: Focused, streamlined single-view navigation with responsive team collaboration panels.
  * Org & Superadmin Consoles: High-density data tables, priority column responsive transformations, and real-time status pills.
