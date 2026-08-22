// Phase 1 checkpoint (see plan: "Foundational rewiring") — proves the
// signup -> login -> logout -> session-persists-on-refresh loop, plus the
// returnTo redirect round trip on every protected shell, works end-to-end
// against a live backend + frontend dev server. Not a maintained test
// suite: an informal, rerunnable checkpoint script per the plan's own
// "Playwright only at mid-flight checkpoints" design decision.
//
// Prereqs: backend running on :5000, frontend dev server on :3000,
// `owner@example.org` / `development-only-password-1234` seeded and
// email-verified (see backend/prisma/seed.ts).
//
// Run: node scripts/smoke-phase1-auth.mjs

import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SEED_EMAIL = "owner@example.org";
const SEED_PASSWORD = "development-only-password-1234";
const SEED_ORG_ID = "01a01186-c964-7000-b6d7-0d3db40c5aa1"; // sample-innovation-lab

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ok — ${label}`);
  } else {
    console.error(`  FAIL — ${label}`);
    failures += 1;
  }
}

async function main() {
  const browser = await chromium.launch();

  // --- 1. Sign-up does NOT create a session (email verification required) ---
  {
    console.log("1. Sign-up (email verification required, no session expected)");
    const page = await browser.newPage();
    const freshEmail = `smoke-${Date.now()}@example.org`;
    await page.goto(`${BASE}/auth/signup`, { waitUntil: "networkidle" });
    await page.fill("#name", "Smoke Test User");
    await page.fill("#email", freshEmail);
    await page.fill("#password", "smoke-test-password-1234");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname.startsWith("/auth/verify-email"), { timeout: 5000 }).catch(() => {});
    check("redirected to /auth/verify-email", page.url().includes("/auth/verify-email"));
    await page.close();
  }

  // --- 2. Login with a verified account, returnTo redirect on every shell ---
  const protectedPaths = [`/org/${SEED_ORG_ID}`, "/app", "/judge", "/admin"];
  for (const path of protectedPaths) {
    console.log(`2. returnTo round trip for ${path}`);
    const page = await browser.newPage();

    // RequireAuth shows a loading spinner until the session check resolves,
    // then redirects — networkidle can fire before that client-side
    // navigation actually commits (especially under load), which is a race
    // in this check, not in the product. Wait for the URL itself to settle.
    await page.goto(`${BASE}${path}`);
    await page.waitForURL((u) => u.pathname.startsWith("/auth/signin"), { timeout: 8000 }).catch(() => {});
    const bouncedToSignin = page.url().includes("/auth/signin") && page.url().includes("returnTo");
    check("anonymous visit redirected to signin with returnTo", bouncedToSignin);

    await page.fill("#email", SEED_EMAIL);
    await page.fill("#password", SEED_PASSWORD);
    await page.click('button[type="submit"]');
    await page
      .waitForFunction((expected) => location.pathname.startsWith(expected), path, { timeout: 5000 })
      .catch(() => {});
    check(`post-login landed back on ${path}`, page.url().includes(path));

    await page.close();
  }

  // --- 3. Session persists across a hard refresh ---
  {
    console.log("3. Session persists on refresh");
    const page = await browser.newPage();
    await page.goto(`${BASE}/auth/signin`, { waitUntil: "networkidle" });
    await page.fill("#email", SEED_EMAIL);
    await page.fill("#password", SEED_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.startsWith("/auth/signin"), { timeout: 5000 });

    await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    check("still on /app after refresh (no bounce to signin)", page.url().endsWith("/app"));

    // --- 4. Logout clears the session; protected routes bounce again ---
    console.log("4. Logout clears session");
    // The header has several `rounded-full` elements (notification badge,
    // unread dot); the real avatar dropdown trigger is the only one that's
    // a <button>, so target that specifically rather than `.first()`.
    const avatarTrigger = page.locator('button[class*="rounded-full"]').last();
    await avatarTrigger.click({ force: true });
    await page.getByText(/sign out/i).first().click();
    await page.waitForFunction(() => location.pathname.startsWith("/auth/signin"), { timeout: 5000 }).catch(() => {});
    check("logout redirected to signin", page.url().includes("/auth/signin"));

    await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
    check("post-logout visit to /app bounces to signin", page.url().includes("/auth/signin"));

    await page.close();
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Phase 1 auth checks passed.");
}

main().catch((err) => {
  console.error("Smoke script crashed:", err);
  process.exit(1);
});
