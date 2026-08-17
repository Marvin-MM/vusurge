export type RequirementStatus = 'implemented' | 'conditional' | 'not-applicable'

export interface RequirementCoverageGroup {
  readonly id: string
  readonly sections: readonly number[]
  readonly status: RequirementStatus
  readonly enforcement: readonly string[]
  readonly provingTests: readonly string[]
  readonly note: string
}

/**
 * Reviewable source for the generated master-prompt requirement matrix.
 *
 * Coverage is classified at every numbered contract section. Endpoint-level
 * requirements are additionally proven by runtime/OpenAPI parity, and every
 * domain event/scheduler is checked against its executable catalogue.
 */
export const REQUIREMENT_COVERAGE_GROUPS: readonly RequirementCoverageGroup[] = [
  {
    id: 'mission-and-product',
    sections: [0, 1, 59],
    status: 'implemented',
    enforcement: ['README.md', 'src/app.ts', 'src/modules/register.ts'],
    provingTests: ['tests/e2e/health.test.ts', 'tests/e2e/identity-and-tenancy-workflows.test.ts'],
    note: 'The modular backend and its complete product surface are composed through one API/worker infrastructure graph.',
  },
  {
    id: 'architecture-and-stack',
    sections: [2, 3, 4, 45, 47, 48],
    status: 'implemented',
    enforcement: [
      'package.json',
      'src/modules/register.ts',
      'src/shared/database/tenant-transaction.ts',
      'Dockerfile',
      'docker-compose.yml',
    ],
    provingTests: ['tests/unit/config.test.ts', 'tests/e2e/health.test.ts'],
    note: 'Bun/Elysia/Prisma modular-monolith boundaries, provider abstractions, deployment artifacts, and explicit non-goals are present.',
  },
  {
    id: 'authorization-and-authentication',
    sections: [5, 7, 36, 37, 54, 55],
    status: 'implemented',
    enforcement: [
      'src/shared/auth',
      'src/shared/authorization',
      'src/shared/http/route-policy.ts',
      'src/shared/security/csrf.ts',
      'src/shared/rate-limit',
    ],
    provingTests: [
      'tests/authorization/permission-matrix.test.ts',
      'tests/security/route-policy-matrix.test.ts',
      'tests/security/cross-tenant-idor.test.ts',
      'tests/unit/security-primitives.test.ts',
    ],
    note: 'Deny-by-default permissions, server-owned session assurance, CSRF, freshness, independent limit dimensions, and adversarial authorization tests are enforced centrally.',
  },
  {
    id: 'tenant-and-relational-integrity',
    sections: [6, 30, 31, 32, 43],
    status: 'implemented',
    enforcement: [
      'prisma/schema',
      'prisma/migrations',
      'src/shared/database/tenant-transaction.ts',
      'docs/adr/0015-runtime-db-role-and-rls.md',
    ],
    provingTests: [
      'tests/integration/row-level-security.test.ts',
      'tests/integration/database-privileges.test.ts',
      'tests/integration/idempotency.test.ts',
      'tests/concurrency/transaction-runner.test.ts',
    ],
    note: 'Composite scope constraints, FORCE RLS, narrow resolver functions, purpose-bound maintenance access, database time, and transactional idempotency form the integrity baseline.',
  },
  {
    id: 'organization-and-challenge-workflows',
    sections: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    status: 'implemented',
    enforcement: [
      'src/modules/organizations',
      'src/modules/challenges',
      'src/modules/forms',
      'src/modules/participation',
      'src/modules/teams',
      'src/modules/submissions',
      'src/modules/judging',
      'src/modules/announcements',
    ],
    provingTests: [
      'tests/e2e/challenge-lifecycle.test.ts',
      'tests/e2e/forms.test.ts',
      'tests/e2e/participation.test.ts',
      'tests/e2e/teams.test.ts',
      'tests/e2e/submissions.test.ts',
      'tests/e2e/judging.test.ts',
      'tests/concurrency/team-capacity.test.ts',
    ],
    note: 'The complete organization-to-results lifecycle uses immutable/versioned records, guarded state transitions, same-scope relations, and durable workflow events.',
  },
  {
    id: 'delivery-storage-and-reporting',
    sections: [19, 20, 21, 22, 23, 24, 38, 39, 49, 50, 52],
    status: 'implemented',
    enforcement: [
      'src/shared/outbox',
      'src/shared/email',
      'src/modules/files',
      'src/modules/media',
      'src/modules/analytics',
      'src/workers/scheduled-jobs.ts',
    ],
    provingTests: [
      'tests/queue/outbox-dispatch.test.ts',
      'tests/queue/event-catalog.test.ts',
      'tests/queue/scheduled-jobs.test.ts',
      'tests/integration/email-delivery.test.ts',
      'tests/integration/reminders-analytics-rollups.test.ts',
      'tests/e2e/files.test.ts',
      'tests/e2e/media.test.ts',
      'tests/e2e/analytics.test.ts',
      'tests/e2e/exports.test.ts',
    ],
    note: 'External effects are durable obligations; private storage, malware scanning, delivery retries, schedulers, rollups, and quota/fairness controls are implemented.',
  },
  {
    id: 'product-maturity-modules',
    sections: [25, 26, 27, 28, 29],
    status: 'implemented',
    enforcement: [
      'src/modules/support',
      'src/modules/innovation-portfolio',
      'src/modules/search',
      'src/modules/moderation',
      'src/modules/audit',
    ],
    provingTests: [
      'tests/e2e/support.test.ts',
      'tests/e2e/innovation-portfolio.test.ts',
      'tests/e2e/search.test.ts',
      'tests/e2e/moderation.test.ts',
      'tests/e2e/audit.test.ts',
      'tests/integration/database-privileges.test.ts',
    ],
    note: 'Support, portfolio, discovery, moderation, and append-only audit workflows have route-level and database-level proof.',
  },
  {
    id: 'api-contract',
    sections: [33, 34, 35, 51],
    status: 'implemented',
    enforcement: ['src/modules', 'src/shared/http/route-policy.ts', 'docs/openapi.json'],
    provingTests: [
      'tests/security/route-policy-matrix.test.ts',
      'tests/security/response-hardening.test.ts',
      'tests/e2e/health.test.ts',
    ],
    note: 'Runtime routes, canonical endpoint shapes, Problem Details, projections, and generated OpenAPI are checked for exact parity.',
  },
  {
    id: 'observability-testing-and-ci',
    sections: [40, 41, 46, 58],
    status: 'implemented',
    enforcement: [
      'src/shared/observability',
      'tests',
      '../.github/workflows/ci.yml',
      'scripts/generate-release-evidence.ts',
    ],
    provingTests: [
      'tests/unit/http-primitives.test.ts',
      'tests/concurrency/transaction-runner.test.ts',
      'tests/queue/event-catalog.test.ts',
      'tests/security/route-policy-matrix.test.ts',
    ],
    note: 'Static, database, authorization, concurrency, queue, E2E, security, generated-contract, vulnerability, and container gates are mandatory.',
  },
  {
    id: 'privacy-and-operations',
    sections: [42, 44],
    status: 'implemented',
    enforcement: [
      'src/shared/account-deletion',
      'src/shared/retention',
      'docs/runbooks/deployment-rollback.md',
      'docs/runbooks/backup-restore.md',
      'docs/runbooks/queue-provider-recovery.md',
      'docs/runbooks/key-rotation-break-glass.md',
    ],
    provingTests: [
      'tests/integration/retention-sweep.test.ts',
      'tests/e2e/users.test.ts',
      'tests/queue/outbox-dispatch.test.ts',
    ],
    note: 'Retention, legal holds, pseudonymization, restore ownership, rollback, outage recovery, and break-glass procedures are explicit and test-linked.',
  },
  {
    id: 'architecture-decisions-and-documentation',
    sections: [56, 57],
    status: 'implemented',
    enforcement: ['README.md', 'docs/adr', 'docs'],
    provingTests: ['tests/e2e/health.test.ts', 'tests/security/route-policy-matrix.test.ts'],
    note: 'All required ADR and operator/developer documentation classes are checked into the repository; generated claims are validated separately.',
  },
  {
    id: 'optional-capabilities',
    sections: [53],
    status: 'conditional',
    enforcement: [
      'src/modules/meta',
      'src/modules/files',
      'src/modules/notifications',
      'src/shared/config',
    ],
    provingTests: [
      'tests/e2e/meta.test.ts',
      'tests/e2e/files.test.ts',
      'tests/e2e/notifications.test.ts',
    ],
    note: 'SSE and document uploads advertise operational readiness only when their required infrastructure is healthy; polling remains available.',
  },
] as const
