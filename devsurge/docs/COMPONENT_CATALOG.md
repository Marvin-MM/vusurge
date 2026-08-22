# DevArena — Reusable Component Catalog

This catalog documents the core atomic and shared components built for the DevArena platform.

---

## 1. Shared Domain Components (`@/components/shared`)

| Component | Props / Signature | Usage Description |
| :--- | :--- | :--- |
| `StatusBadge` | `status: string, variant?: string` | Displays color-coded, accessible status indicators for submissions, challenges, and applications. |
| `RoleBadge` | `role: string` | Renders styled badges for `PLATFORM_SUPERADMIN`, `ORG_OWNER`, `ORG_ADMIN`, `CHALLENGE_MANAGER`, `JUDGE`, `PARTICIPANT`. |
| `SkillBadge` | `skill: Skill, onRemove?: () => void` | Tag pill for developer capabilities with optional dismiss button. |
| `SkillPicker` | `selectedSkills, onSkillsChange` | Multi-select dialog and autocomplete for selecting participant skills. |
| `PersonaSwitcher` | None | Dev-mode floating floating HUD with dual **Scenarios** and **Personas** switching tabs. |
| `OrganizationSwitcher` | `className?: string` | Tenant selector dropdown in shell headers for switching active organization contexts. |
| `ResultsPodium` | `winners: AwardedSubmission[]` | Visual 1st, 2nd, 3rd place podium component with prize amounts and team avatars. |
| `PrizeCard` | `prize: ChallengePrize` | Structured cash and perks prize tier card. |
| `FeaturedChallengeCard`| `challenge: Challenge` | High-impact hero card for featured competitions. |
| `PublicChallengeCard` | `challenge: Challenge` | Grid card for catalog browsing with deadlines and prize pools. |
| `InnovationCard` | `item: InnovationItem` | Card displaying promoted submissions in the public innovation portfolio. |
| `ChallengeTimeline` | `stages: ChallengeStage[]` | Horizontal / vertical chronological progress tracker for challenge stages. |

---

## 2. Feedback & Error Components (`@/components/feedback`)

| Component | Description |
| :--- | :--- |
| `ConfirmActionDialog` | Destructive/sensitive action confirmation dialog requiring explicit intent or reason text. |
| `EmptyState` | Consistent zero-data placeholder with contextual icons, title, description, and primary CTA. |
| `ErrorBoundary` | React class component catching uncaught client errors with reload and recovery actions. |
| `NotFoundPage` (404) | Polished missing route page with navigation shortcuts. |
| `ForbiddenPage` (403) | Access restricted landing with active persona details and quick-switch advice. |
| `UnauthorizedPage` (401) | Authentication required prompt with sign-in and signup routes. |
| `OrganizationSuspendedPage` | Notice for frozen or suspended organization workspaces. |
| `InvitationExpiredPage` | Notice for invalid or expired invitation tokens. |

---

## 3. UI Primitives (`@/components/ui`)

Built on top of accessible Radix UI primitives and styled with Tailwind CSS:
* `button`, `badge`, `card`, `dialog`, `dropdown-menu`, `input`, `textarea`, `select`, `tabs`, `table`, `sheet`, `avatar`, `switch`, `scroll-area`, `popover`, `tooltip`, `sonner`.
