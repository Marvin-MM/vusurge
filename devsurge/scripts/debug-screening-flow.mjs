import { chromium } from "playwright";
import { execSync } from "node:child_process";
const WEB = "http://localhost:3000";
const API = "http://localhost:5000/api/v1";
const ORG_ID = "01a01186-c964-7000-b6d7-0d3db40c5aa1";
const OWNER_EMAIL = "owner@example.org";
const OWNER_PASSWORD = "development-only-password-1234";

function log(m) { console.log(`[verify] ${m}`); }
function psql(sql) {
  return execSync(
    `PGPASSWORD=ip_migrator_local_dev psql -h 127.0.0.1 -U ip_migrator -d innovation_platform -t -c "${sql.replace(/"/g, '\\"')}"`,
    { shell: "/bin/bash" }
  ).toString().trim();
}

async function main() {
  const browser = await chromium.launch();

  // --- Owner: create a real screening challenge + published form via the API (fast setup) ---
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`${WEB}/auth/signin`);
  await ownerPage.fill("#email", OWNER_EMAIL);
  await ownerPage.fill("#password", OWNER_PASSWORD);
  await ownerPage.click('button[type="submit"]');
  await ownerPage.waitForTimeout(1500);
  const ownerCookies = await ownerContext.cookies();
  const ownerCookieHeader = ownerCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const csrfRes = await fetch(`${API}/me/csrf-token`, { headers: { cookie: ownerCookieHeader, origin: WEB } });
  const ownerCsrf = (await csrfRes.json()).csrfToken;

  const stamp = Date.now();
  const slug = `screening-test-${stamp}`;
  const createRes = await fetch(`${API}/organizations/${ORG_ID}/challenges`, {
    method: "POST",
    headers: { cookie: ownerCookieHeader, origin: WEB, "content-type": "application/json", "x-csrf-token": ownerCsrf },
    body: JSON.stringify({ title: `Screening Test ${stamp}`, slug, screeningRequired: true, participationPolicy: "OPEN_AUTHENTICATED", visibility: "PUBLIC" }),
  });
  const challenge = await createRes.json();
  log(`Challenge created: ${challenge.id}`);

  await fetch(`${API}/organizations/${ORG_ID}/challenges/${challenge.id}/reschedule`, {
    method: "POST",
    headers: { cookie: ownerCookieHeader, origin: WEB, "content-type": "application/json", "x-csrf-token": ownerCsrf },
    body: JSON.stringify({ submissionDeadline: new Date(Date.now() + 30 * 86400000).toISOString(), reason: "Test setup." }),
  });
  await fetch(`${API}/organizations/${ORG_ID}/challenges/${challenge.id}/publish`, {
    method: "POST",
    headers: { cookie: ownerCookieHeader, origin: WEB, "content-type": "application/json", "x-csrf-token": ownerCsrf },
    body: JSON.stringify({}),
  });

  const formRes = await fetch(`${API}/organizations/${ORG_ID}/forms`, {
    method: "POST",
    headers: { cookie: ownerCookieHeader, origin: WEB, "content-type": "application/json", "x-csrf-token": ownerCsrf },
    body: JSON.stringify({ purpose: "CHALLENGE_PARTICIPATION", challengeId: challenge.id, name: "Screening" }),
  });
  const formDef = await formRes.json();
  const versionRes = await fetch(`${API}/organizations/${ORG_ID}/forms/${formDef.id}/versions`, {
    method: "POST",
    headers: { cookie: ownerCookieHeader, origin: WEB, "content-type": "application/json", "x-csrf-token": ownerCsrf },
    body: JSON.stringify({
      schema: { fields: [
        { key: "motivation", type: "LONG_TEXT", label: "Why do you want to join?", required: true },
        { key: "track", type: "SINGLE_SELECT", label: "Preferred track", required: true, options: ["AI", "Web", "Hardware"] },
      ] },
    }),
  });
  const version = await versionRes.json();
  await fetch(`${API}/organizations/${ORG_ID}/forms/${formDef.id}/versions/${version.id}/publish`, {
    method: "POST",
    headers: { cookie: ownerCookieHeader, origin: WEB, "content-type": "application/json", "x-csrf-token": ownerCsrf },
    body: JSON.stringify({}),
  });
  log(`Screening form published: ${formDef.id}`);
  await ownerContext.close();

  // --- Applicant: a genuinely fresh, non-member user goes through the real UI ---
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  const applicantEmail = `screening-applicant-${stamp}@example.org`;
  await page.goto(`${WEB}/auth/signup`);
  await page.fill("#name", "Screening Applicant");
  await page.fill("#email", applicantEmail);
  await page.fill("#password", "screening-test-password-1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/verify-email/, { timeout: 10000 });
  psql(`update "user" set email_verified = true where email = '${applicantEmail}';`);

  await page.goto(`${WEB}/auth/signin`);
  await page.fill("#email", applicantEmail);
  await page.fill("#password", "screening-test-password-1234");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  log("Signed in as fresh, non-member applicant");

  // Confirm non-membership.
  const userId = psql(`select id from "user" where email = '${applicantEmail}';`);
  const membership = psql(`select count(*) from organization_membership where organization_id = '${ORG_ID}' and user_id = '${userId}';`);
  log(`Applicant's membership row count in this org (expect 0): ${membership}`);

  // A non-member with zero participation record must go through the PUBLIC
  // challenge page, not the authenticated workspace page — the latter
  // correctly, by design, 404s until a participation record exists (see
  // challenge-lifecycle.test.ts's "an approved participant..." test).
  await page.goto(`${WEB}/challenges/sample-innovation-lab/${slug}`);
  await page.waitForTimeout(1500);
  log(`URL after nav: ${page.url()}`);
  const bodyText = await page.locator("body").innerText();
  log(`Page text (first 800 chars):\n${bodyText.slice(0, 800)}`);
  const submitAppBtn = page.locator('button:has-text("Submit Application")');
  const btnVisible = await submitAppBtn.isVisible().catch(() => false);
  log(`"Submit Application" button visible (expect true): ${btnVisible}`);

  await submitAppBtn.click({ timeout: 5000 }).catch((e) => log(`click failed: ${e.message}`));
  await page.waitForTimeout(1000);
  const dialogVisible = await page.locator('div[role="dialog"]:has-text("Screening Application")').isVisible().catch(() => false);
  log(`Screening application dialog opened (expect true): ${dialogVisible}`);

  const fieldsRendered = await page.locator('div[role="dialog"] >> text=Why do you want to join?').isVisible().catch(() => false);
  log(`Real form fields rendered from published schema (expect true): ${fieldsRendered}`);

  await page.fill('div[role="dialog"] textarea', "I want to build autonomous systems.");
  await page.click('div[role="dialog"] button:has-text("AI")');
  await page.click('div[role="dialog"] button:has-text("Submit Application")');
  await page.waitForTimeout(1500);

  const stillOpen = await page.locator('div[role="dialog"]:has-text("Screening Application")').isVisible().catch(() => false);
  log(`Dialog closed after successful submit (expect false): ${stillOpen}`);

  const pendingBadge = await page.locator('text=Application Under Review').isVisible().catch(() => false);
  log(`"Application Under Review" status shown (expect true): ${pendingBadge}`);

  // DB-verify: the response is real, not a draft, and participation is PENDING.
  const dbCheck = psql(`
    select fr.is_draft, fr.response_data, p.status
    from form_response fr
    join challenge_participation p on p.form_response_id = fr.id
    where fr.user_id = '${userId}' and fr.challenge_id = '${challenge.id}';
  `);
  log(`DB form_response + participation row: ${dbCheck}`);

  log(`Console errors: ${errors.length}`);
  for (const e of errors) log(`  ${e}`);

  await browser.close();
}

main().catch((err) => {
  console.error("[verify] FAILED:", err);
  process.exit(1);
});
