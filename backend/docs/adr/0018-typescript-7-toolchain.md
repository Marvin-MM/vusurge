# ADR 0018 — TypeScript 7 as the typechecker

Status: Accepted
Date: 2026-08-16

## Context

The implementation contract requires current stable releases, pinned, and
forbids alpha/beta/RC versions for core production dependencies. At
implementation time the `latest` tag for `typescript` is **7.0.2** — the native
(Go) compiler port. TypeScript 5.9.3 and 6.0.3 also exist.

TypeScript 7 is a rewrite of the compiler, and this codebase leans on some of
the heaviest type inference in the ecosystem: Elysia's chained-generic route
builder, Prisma 7's generated client types, and Better Auth's plugin typing. A
compiler regression in any of those would be a hard blocker, not a nuisance.

## Decision

Pin `typescript@7.0.2`, after empirical verification rather than assumption.

Before any application code was written, a probe module exercised the risky
surface together — Elysia route chaining with `t` schemas, a `macro` with a
`resolve` that returns `status(401)`, typed `params`/`body`/`response`, the
OpenAPI and CORS plugins, `betterAuth` with `prismaAdapter` and the `twoFactor`
plugin, BullMQ `Queue`/`Worker`, and `PrismaPg`. It typechecked cleanly, and a
deliberately introduced type error was correctly reported, confirming the check
was real rather than silently skipped.

One genuine breaking change was encountered and accommodated:

> **`baseUrl` was removed in TypeScript 7.** Path mappings are now resolved
> relative to the `tsconfig.json` that declares them. `tsconfig.json` therefore
> declares `paths` with no `baseUrl`.

The fallback, had verification failed, was `typescript@5.9.3`. It was not
needed.

## Consequences

- Typechecking is dramatically faster (a full pass on the codebase is
  sub-second), which makes `tsc --noEmit` cheap enough to run on every change
  and inside the Docker image build.
- The pin is exact in `package.json`. A TypeScript upgrade is a deliberate,
  reviewed change, re-verified against the same surface.
- `strict` is on, plus `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `noImplicitReturns`, and
  `verbatimModuleSyntax`. `noUncheckedIndexedAccess` in particular forces array
  and record access to be narrowed, which has already caught real absent-value
  handling in pagination and configuration parsing.
