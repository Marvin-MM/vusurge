# ADR 0016 — Resend only; no Gmail SMTP fallback

Status: Accepted
Date: 2026-08-16

## Context

A common shortcut in early-stage backends is "use Resend in production, fall
back to Gmail SMTP / Nodemailer locally or if Resend is unreachable." It reads
as pragmatic and is explicitly forbidden by master prompt section 4.2.

## Decision

`shared/email` defines one interface, `EmailProvider`, with exactly two
implementations:

- `ResendEmailProvider` — the real provider, used whenever `EMAIL_ENABLED=true`
  (required in production; see `shared/config`).
- `NullEmailProvider` — logs instead of sending, used whenever email is
  disabled (local development, most of the test suite).

There is no third implementation backed by Gmail, SMTP, or any consumer email
service. `createEmailProvider` selects between exactly these two based on
configuration, and application code depends only on the `EmailProvider`
interface — never on Resend's SDK types directly outside
`resend-provider.ts`.

Tests substitute a third implementation, `FakeEmailProvider`
(`tests/helpers/fake-email-provider.ts`), which captures sent messages
in memory so E2E tests can recover a verification or invitation link. It
exists only in the test tree and is wired in exactly where `NullEmailProvider`
would otherwise be used — it is a test double at the provider boundary, not a
production fallback.

## Consequences

- A Resend outage degrades to `NullEmailProvider`'s behaviour only if an
  operator deliberately disables email — it does not silently reroute through
  a consumer mail service with none of Resend's deliverability
  infrastructure (SPF/DKIM/DMARC, bounce/complaint tracking, suppression).
- If contractual redundancy ever requires a second real transactional
  provider, it is a second `EmailProvider` implementation selected by
  configuration — the interface was designed for exactly that substitution
  and nothing about call sites changes.
- Nothing in this codebase can accidentally end up sending production email
  through a personal or shared Gmail account, because no code path to one
  exists.
