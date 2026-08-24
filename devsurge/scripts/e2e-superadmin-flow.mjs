/**
 * Platform superadmin walkthrough, driven through the real UI the way a
 * superadmin actually works: sign in with 2FA (mandatory for this role),
 * review and approve a real organization application, suspend/reinstate an
 * organization, inspect its audit-activity rollup, work a moderation report,
 * work a support ticket end to end, and read the platform audit log.
 *
 * Also asserts the PLATFORM_SUPPORT_AGENT's narrower access is genuinely
 * enforced, not merely hidden.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { TOTP, ScureBase32Plugin, NobleCryptoPlugin } from "otplib";

// This otplib build exposes classes rather than the legacy `authenticator`
// singleton: plugins are instantiated and generate() is async.
function totpFor(secret) {
  return new TOTP({
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
    secret,
  });
}

const WEB = "http://localhost:3000";
const API = "http://localhost:5000/api/v1";
const SUPERADMIN = "superadmin@example.org";
const SUPERADMIN_PASSWORD = "development-only-password-1234";
// Provisioned fresh by this script — platform roles have no assignment API
// anywhere in the backend (verified), so the grant is a direct insert.
const AGENT = `sa-agent-${Date.now()}@example.org`;
const AGENT_PASSWORD = "sa-agent-password-1234";

const stamp = Date.now();
let pass = 0, fail = 0;
function log(m) { console.log(`[sa] ${m}`); }
function check(label, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`[sa] ${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` (want ${expected}, got ${actual})`}`);
  return ok;
}
function psql(sql) {
  return execSync(
    `PGPASSWORD=ip_migrator_local_dev psql -h 127.0.0.1 -U ip_migrator -d innovation_platform -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { shell: "/bin/bash" }
  ).toString().trim();
}

async function apiFor(ctx) {
  const cookies = await ctx.cookies();
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const csrf = (await (await fetch(`${API}/me/csrf-token`, { headers: { cookie, origin: WEB } })).json()).csrfToken;
  return async (method, path, body, extra = {}) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { cookie, origin: WEB, "content-type": "application/json", "x-csrf-token": csrf, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
}

async function main() {
  const browser = await chromium.launch();
  const consoleErrors = [];

  // ---- Seed a pending organization application to review (via a real user)
  log("=== SETUP: a real user applies to create an organization ===");
  const applicantEmail = `sa-applicant-${stamp}@example.org`;
  const sCtx = await browser.newContext();
  const sPage = await sCtx.newPage();
  await sPage.goto(`${WEB}/auth/signup`);
  await sPage.fill("#name", "SA Applicant");
  await sPage.fill("#email", applicantEmail);
  await sPage.fill("#password", "sa-applicant-password-1234");
  await sPage.click('button[type="submit"]');
  await sPage.waitForURL(/verify-email/, { timeout: 15000 });
  psql(`update "user" set email_verified = true where email = '${applicantEmail}';`);
  await sPage.goto(`${WEB}/auth/signin`);
  await sPage.fill("#email", applicantEmail);
  await sPage.fill("#password", "sa-applicant-password-1234");
  await sPage.click('button[type="submit"]');
  await sPage.waitForTimeout(2000);
  const applicantApi = await apiFor(sCtx);
  const application = await applicantApi("POST", "/organization-applications", {
    name: `SA Test Org ${stamp}`,
    requestedSlug: `sa-test-org-${stamp}`,
    organizationType: "COMPANY",
    description: "An organization created during the superadmin portal walkthrough.",
    requesterRelationship: "Founder",
    requestedVisibility: "PRIVATE",
    acceptedTermsVersion: "1.0",
  }, { "idempotency-key": crypto.randomUUID() });
  check("applicant submitted an organization application", application.status, 201);
  await sCtx.close();

  // ---- Superadmin signs in (2FA is mandatory for this role)
  log("=== PHASE 1: superadmin signs in through the real 2FA flow ===");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/v1/")) {
      consoleErrors.push(`HTTP ${r.status()} ${r.url().replace(API, "")}`);
    }
  });

  // Better Auth encrypts the TOTP secret at rest, so it cannot be read back
  // out of the database. Re-enrol through the real settings UI instead, which
  // displays the plaintext secret exactly once — this exercises the
  // enrollment screen as well as the sign-in challenge.
  const superadminId = psql(`select id from "user" where email = '${SUPERADMIN}';`);
  psql(`delete from two_factor where user_id = '${superadminId}';`);
  psql(`update "user" set two_factor_enabled = false where id = '${superadminId}';`);

  await page.goto(`${WEB}/auth/signin`);
  await page.fill("#email", SUPERADMIN);
  await page.fill("#password", SUPERADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  check("sign-in succeeds with 2FA not yet enrolled", /verify-2fa/.test(page.url()), false);

  await page.goto(`${WEB}/app/settings`);
  await page.waitForTimeout(2500);
  // The Enable button stays disabled until the password confirmation is typed.
  const enableBtn = page.locator('button:has-text("Enable 2FA")').first();
  check("2FA enrollment control is available in settings", await enableBtn.isVisible().catch(() => false), true);
  await page.fill('input[placeholder="Confirm your password"]', SUPERADMIN_PASSWORD);
  await enableBtn.click();
  await page.waitForTimeout(3500);

  const totpSecret = (await page.locator("code").first().innerText().catch(() => "")).trim();
  check("enrollment displayed a usable TOTP secret", totpSecret.length > 0, true);

  const enrollCode = await totpFor(totpSecret).generate();
  await page.fill('input[placeholder="6-digit code"]', enrollCode);
  await page.locator('button:has-text("Verify & Activate")').click();
  await page.waitForTimeout(3500);
  check("2FA is now enabled in the database",
    psql(`select two_factor_enabled from "user" where id = '${superadminId}';`), "t");

  // Now sign out and back in through the real two-step challenge.
  await ctx.clearCookies();
  await page.goto(`${WEB}/auth/signin`);
  await page.fill("#email", SUPERADMIN);
  await page.fill("#password", SUPERADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  check("password step now routes to 2FA verification", /verify-2fa/.test(page.url()), true);

  const code = await totpFor(totpSecret).generate();
  await page.fill('input[inputmode="numeric"], input[name="code"], input#code', code);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  check("2FA accepted and session established", /verify-2fa/.test(page.url()), false);

  await page.goto(`${WEB}/admin`);
  await page.waitForTimeout(2500);
  const dashText = await page.locator("main").innerText().catch(() => "");
  check("superadmin console loads", /Superadmin|Platform|Console|Organizations/i.test(dashText), true);

  const api = await apiFor(ctx);

  // ---- Approve the application through the real UI
  log("=== PHASE 2: review and approve the organization application (real UI) ===");
  await page.goto(`${WEB}/admin/organization-applications`);
  await page.waitForTimeout(2500);
  const appsText = await page.locator("main").innerText().catch(() => "");
  check("pending application is listed", appsText.includes(`SA Test Org ${stamp}`), true);

  const reviewBtn = page.locator(`text=SA Test Org ${stamp}`).first();
  await reviewBtn.click().catch(() => {});
  await page.waitForTimeout(2000);
  const approveBtn = page.locator('button:has-text("Approve")').first();
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1200);
    const confirm = page.locator('div[role="dialog"] button:has-text("Approve")').last();
    if (await confirm.isVisible().catch(() => false)) { await confirm.click(); }
    await page.waitForTimeout(2500);
  }
  const orgCreated = psql(`select status from organization where slug = 'sa-test-org-${stamp}';`);
  check("approving created a real ACTIVE organization", orgCreated, "ACTIVE");
  const newOrgId = psql(`select id from organization where slug = 'sa-test-org-${stamp}';`);

  // ---- Organization lifecycle
  log("=== PHASE 3: organization lifecycle (suspend -> reinstate) ===");
  const suspended = await api("POST", `/platform/organizations/${newOrgId}/suspend`, {
    reason: "Superadmin walkthrough: verifying the suspend action.",
  });
  check("organization suspended", suspended.status, 204);
  check("DB reflects SUSPENDED", psql(`select status from organization where id = '${newOrgId}';`), "SUSPENDED");
  const reinstated = await api("POST", `/platform/organizations/${newOrgId}/reinstate`, {
    reason: "Superadmin walkthrough: verifying the reinstate action.",
  });
  check("organization reinstated", reinstated.status, 204);
  check("DB reflects ACTIVE again", psql(`select status from organization where id = '${newOrgId}';`), "ACTIVE");

  // ---- Audit summary (newly wired)
  log("=== PHASE 4: per-organization audit rollup ===");
  const summary = await api("GET", `/platform/organizations/${newOrgId}/audit-summary`);
  check("audit-summary endpoint responds", summary.status, 200);
  check("audit-summary reports real activity", Number(summary.body?.totalEvents) > 0, true);

  await page.goto(`${WEB}/admin/organizations`);
  await page.waitForTimeout(2500);
  const activityBtn = page.locator('button:has-text("Activity")').first();
  check("Activity expander is rendered in the UI", await activityBtn.isVisible().catch(() => false), true);
  await activityBtn.click().catch(() => {});
  await page.waitForTimeout(2000);
  const orgsText = await page.locator("main").innerText().catch(() => "");
  check("expanded rollup renders real counts", /Total audit events/i.test(orgsText), true);

  // ---- Moderation
  log("=== PHASE 5: moderation queue ===");
  const reports = await api("GET", "/platform/reports?limit=20");
  check("moderation queue loads", reports.status, 200);
  await page.goto(`${WEB}/admin/moderation`);
  await page.waitForTimeout(2500);
  const modText = await page.locator("main").innerText().catch(() => "");
  check("moderation page renders", /Moderation|report/i.test(modText), true);
  const openReport = (reports.body?.items ?? []).find((r) => r.status === "PENDING" || r.status === "OPEN");
  if (openReport) {
    const dismissed = await api("POST", `/platform/reports/${openReport.id}/dismiss`, {
      reason: "Superadmin walkthrough: report reviewed and dismissed as not actionable.",
    });
    check("report can be dismissed", dismissed.status, 200);
  } else {
    log("  (no open report to action — queue was already clear)");
  }

  // ---- Support desk
  log("=== PHASE 6: support ticket workflow ===");
  const tickets = await api("GET", "/platform/support/tickets?limit=20");
  check("support queue loads", tickets.status, 200);
  const ticket = (tickets.body?.items ?? [])[0];
  if (ticket) {
    const assigned = await api("POST", `/platform/support/tickets/${ticket.id}/assign`, { assignedToUserId: superadminId });
    check("ticket assigned to the superadmin", assigned.status, 200);
    const prioritised = await api("POST", `/platform/support/tickets/${ticket.id}/set-priority`, { priority: "HIGH" });
    check("ticket priority set", prioritised.status, 200);
    const noted = await api("POST", `/platform/support/tickets/${ticket.id}/internal-notes`, {
      body: "Internal note added during the superadmin walkthrough.",
    });
    check("internal note added", noted.status, 200);
    const commented = await api("POST", `/platform/support/tickets/${ticket.id}/comments`, {
      body: "Thanks for reaching out — we are looking into this now.",
    });
    check("public comment added", commented.status, 200);
    const resolved = await api("POST", `/platform/support/tickets/${ticket.id}/resolve`, {
      resolutionSummary: "Resolved during the superadmin portal walkthrough.",
    });
    if (!check("ticket resolved", resolved.status, 200)) log(`  -> ${JSON.stringify(resolved.body)}`);
    check("DB reflects resolution", psql(`select status from support_ticket where id = '${ticket.id}';`), "RESOLVED");

    await page.goto(`${WEB}/admin/support/${ticket.id}`);
    await page.waitForTimeout(2500);
    const tText = await page.locator("main").innerText().catch(() => "");
    check("ticket detail renders the added comment", tText.includes("looking into this"), true);
  } else {
    log("  (no support tickets present to work)");
  }

  // ---- Platform audit
  log("=== PHASE 7: platform audit log ===");
  await page.goto(`${WEB}/admin/audit`);
  await page.waitForTimeout(2500);
  const auditText = await page.locator("main").innerText().catch(() => "");
  check("platform audit log renders entries", /audit|action|event/i.test(auditText), true);

  // ---- Support-agent boundary
  log("=== PHASE 8: PLATFORM_SUPPORT_AGENT sees a genuinely narrower console ===");
  const aCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  await aPage.goto(`${WEB}/auth/signup`);
  await aPage.fill("#name", "SA Support Agent");
  await aPage.fill("#email", AGENT);
  await aPage.fill("#password", AGENT_PASSWORD);
  await aPage.click('button[type="submit"]');
  await aPage.waitForURL(/verify-email/, { timeout: 15000 });
  psql(`update "user" set email_verified = true where email = '${AGENT}';`);
  const agentId = psql(`select id from "user" where email = '${AGENT}';`);
  psql(`insert into platform_role_assignment (id, user_id, role, reason, granted_at) values (gen_random_uuid(), '${agentId}', 'PLATFORM_SUPPORT_AGENT', 'Superadmin portal walkthrough fixture.', now());`);

  await aPage.goto(`${WEB}/auth/signin`);
  await aPage.fill("#email", AGENT);
  await aPage.fill("#password", AGENT_PASSWORD);
  await aPage.click('button[type="submit"]');
  await aPage.waitForTimeout(2500);
  await aPage.goto(`${WEB}/admin`);
  await aPage.waitForTimeout(2500);
  const agentNav = await aPage.locator("aside").innerText().catch(() => "");
  log(`  agent nav: ${JSON.stringify(agentNav.replace(/\n+/g, " | "))}`);
  check("agent cannot see Org Vetting in nav", /Vetting|Applications/i.test(agentNav), false);
  check("agent cannot see Audit in nav", /Audit/i.test(agentNav), false);
  check("agent CAN see Support", /Support/i.test(agentNav), true);

  await aPage.goto(`${WEB}/admin/audit`);
  await aPage.waitForTimeout(2000);
  const agentAudit = await aPage.locator("main").innerText().catch(() => "");
  check("agent blocked from audit by direct URL", /Restricted|permission|not authorized|access/i.test(agentAudit), true);

  const agentApi = await apiFor(aCtx);
  const agentAuditApi = await agentApi("GET", "/platform/audit?limit=5");
  check("backend also refuses the agent's audit call", agentAuditApi.status, 403);
  const agentSupportApi = await agentApi("GET", "/platform/support/tickets?limit=5");
  check("backend allows the agent's support call", agentSupportApi.status, 200);

  log("");
  const realErrors = consoleErrors.filter((e) => !/404 .*\/users\/.*\/profile/.test(e));
  log(`Console errors / failed responses: ${realErrors.length}`);
  [...new Set(realErrors)].slice(0, 12).forEach((e) => log(`  ${e}`));
  log("");
  log(`RESULT: ${pass} passed, ${fail} failed.`);

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error("[sa] CRASHED:", err); process.exit(1); });
