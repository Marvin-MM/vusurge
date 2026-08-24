/**
 * End-to-end walkthrough of the whole platform against the real backend,
 * driven through the actual browser UI wherever a UI exists.
 *
 * Flow: org owner sets up a custom form + a screening challenge -> a fresh
 * participant registers through the screening application -> forms a team ->
 * a second participant joins that team -> submission draft -> finalize ->
 * owner assigns a judge -> judge scores -> owner finalizes + publishes
 * results -> participant sees the result.
 *
 * Every step asserts against the database or the real HTTP response, not just
 * "the page looked right".
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const WEB = "http://localhost:3000";
const API = "http://localhost:5000/api/v1";
const ORG_ID = "01a01186-c964-7000-b6d7-0d3db40c5aa1";
const ORG_SLUG = "sample-innovation-lab";
const OWNER_EMAIL = "owner@example.org";
const OWNER_PASSWORD = "development-only-password-1234";
const PASSWORD = "e2e-test-password-1234";

const stamp = Date.now();
let failures = 0;
let checks = 0;

function log(m) { console.log(`[e2e] ${m}`); }
function check(label, actual, expected) {
  checks++;
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`[e2e] ${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` (expected ${expected}, got ${actual})`}`);
  return ok;
}
function psql(sql) {
  return execSync(
    `PGPASSWORD=ip_migrator_local_dev psql -h 127.0.0.1 -U ip_migrator -d innovation_platform -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { shell: "/bin/bash" }
  ).toString().trim();
}

async function apiCtx(browser, email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${WEB}/auth/signin`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  const cookies = await ctx.cookies();
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const csrf = (await (await fetch(`${API}/me/csrf-token`, { headers: { cookie, origin: WEB } })).json()).csrfToken;
  const call = async (method, path, body, extraHeaders = {}) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        cookie, origin: WEB, "content-type": "application/json",
        "x-csrf-token": csrf, ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
  return { ctx, page, cookie, csrf, call };
}

async function signUpVerified(browser, email, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${WEB}/auth/signup`);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/verify-email/, { timeout: 15000 });
  psql(`update "user" set email_verified = true where email = '${email}';`);
  await ctx.close();
  return email;
}

async function main() {
  const browser = await chromium.launch();
  const consoleErrors = [];

  // ---------------------------------------------------------------- OWNER
  log("=== PHASE 1: organizer sets up a custom form and a screening challenge ===");
  const owner = await apiCtx(browser, OWNER_EMAIL, OWNER_PASSWORD);

  const slug = `e2e-challenge-${stamp}`;
  const created = await owner.call("POST", `/organizations/${ORG_ID}/challenges`, {
    title: `E2E Flow Challenge ${stamp}`,
    slug,
    screeningRequired: true,
    participationPolicy: "OPEN_AUTHENTICATED",
    visibility: "PUBLIC",
    minTeamSize: 1,
    maxTeamSize: 3,
    soloParticipationAllowed: true,
  });
  check("challenge created", created.status, 201);
  const challengeId = created.body.id;

  await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/reschedule`, {
    submissionDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    reason: "E2E setup.",
  });

  // Custom screening form, built through the real forms module.
  const formDef = await owner.call("POST", `/organizations/${ORG_ID}/forms`, {
    purpose: "CHALLENGE_PARTICIPATION", challengeId, name: "E2E Screening",
  });
  check("form definition created", formDef.status, 201);
  const version = await owner.call("POST", `/organizations/${ORG_ID}/forms/${formDef.body.id}/versions`, {
    schema: { fields: [
      { key: "motivation", type: "LONG_TEXT", label: "Why do you want to join?", required: true },
      { key: "track", type: "SINGLE_SELECT", label: "Preferred track", required: true, options: ["AI", "Web"] },
    ] },
  });
  check("form version created", version.status, 201);
  const published = await owner.call("POST", `/organizations/${ORG_ID}/forms/${formDef.body.id}/versions/${version.body.id}/publish`, {});
  check("form version published", published.status, 200);

  const pub = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/publish`, {});
  check("challenge published", pub.status, 200);

  // Rubric, needed later for judging.
  const rubric = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/rubrics`, {
    name: "E2E Rubric",
  });
  check("rubric created", rubric.status, 201);
  const rubricVersion = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/rubrics/${rubric.body.id}/versions`, {
    criteria: [
      { key: "innovation", label: "Innovation", description: "How novel is it?", weight: 60, minScore: 0, maxScore: 10 },
      { key: "execution", label: "Execution", description: "How well built?", weight: 40, minScore: 0, maxScore: 10 },
    ],
  });
  if (!check("rubric version created", rubricVersion.status, 201)) log(`  -> ${JSON.stringify(rubricVersion.body)}`);
  const activated = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/rubrics/${rubric.body.id}/versions/${rubricVersion.body.id}/activate`, {});
  check("rubric version activated", activated.status, 200);

  // ------------------------------------------------------- PARTICIPANT 1
  log("=== PHASE 2: participant registers via the screening application (real UI) ===");
  const p1Email = `e2e-p1-${stamp}@example.org`;
  await signUpVerified(browser, p1Email, "E2E Participant One");
  const p1 = await apiCtx(browser, p1Email, PASSWORD);
  p1.page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`P1: ${m.text()}`); });

  await p1.page.goto(`${WEB}/challenges/${ORG_SLUG}/${slug}`);
  await p1.page.waitForTimeout(2000);
  const applyBtn = p1.page.locator('button:has-text("Submit Application")');
  check("screening CTA visible on public page", await applyBtn.isVisible().catch(() => false), true);
  await applyBtn.click();
  await p1.page.waitForTimeout(1200);
  const dialogOpen = await p1.page.locator('div[role="dialog"]:has-text("Screening Application")').isVisible().catch(() => false);
  check("screening dialog opened", dialogOpen, true);
  await p1.page.fill('div[role="dialog"] textarea', "I want to build autonomous agents.");
  await p1.page.click('div[role="dialog"] button:has-text("AI")');
  await p1.page.click('div[role="dialog"] button:has-text("Submit Application")');
  await p1.page.waitForTimeout(2000);

  const p1Id = psql(`select id from "user" where email = '${p1Email}';`);
  const p1Status = psql(`select status from challenge_participation where user_id = '${p1Id}' and challenge_id = '${challengeId}';`);
  check("participation is PENDING after screening apply", p1Status, "PENDING");
  const respData = psql(`select response_data from form_response fr join challenge_participation p on p.form_response_id = fr.id where fr.user_id = '${p1Id}' and fr.challenge_id = '${challengeId}';`);
  check("real form answers persisted", respData.includes("autonomous agents") && respData.includes("AI"), true);

  // Security regression: unapproved participant must not be able to submit.
  const earlySubmit = await p1.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/submissions`);
  check("PENDING participant cannot start a submission", earlySubmit.status, 403);

  log("=== PHASE 3: organizer approves the applicant ===");
  const participants = await owner.call("GET", `/organizations/${ORG_ID}/challenges/${challengeId}/participants`);
  const p1Row = (participants.body.items || []).find((r) => r.userId === p1Id);
  const approve = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/participants/${p1Row.id}/approve`, {});
  check("organizer approved participant", approve.status, 200);

  // ----------------------------------------------------------- TEAM FLOW
  log("=== PHASE 4: team creation and a second participant joining ===");
  const team = await p1.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/teams`, {
    name: `E2E Team ${stamp}`,
  });
  check("team created by approved participant", team.status, 201);
  const teamId = team.body.team?.id ?? team.body.id;

  const p2Email = `e2e-p2-${stamp}@example.org`;
  await signUpVerified(browser, p2Email, "E2E Participant Two");
  const p2 = await apiCtx(browser, p2Email, PASSWORD);
  const p2Id = psql(`select id from "user" where email = '${p2Email}';`);

  // P2 must register + be approved before they can be invited to a team.
  await p2.call("PATCH", `/organizations/${ORG_ID}/challenges/${challengeId}/participation/application`, {
    responseData: { motivation: "I build web apps.", track: "Web" },
  });
  const p2Submit = await p2.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/participation/submit-application`, {
    responseData: { motivation: "I build web apps.", track: "Web" },
  });
  check("P2 submitted screening application", p2Submit.status, 201);
  const parts2 = await owner.call("GET", `/organizations/${ORG_ID}/challenges/${challengeId}/participants`);
  const p2Row = (parts2.body.items || []).find((r) => r.userId === p2Id);
  await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/participants/${p2Row.id}/approve`, {});

  const invite = await p1.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/teams/${teamId}/invitations`, {
    userId: p2Id,
  });
  check("captain invited P2 to the team", invite.status, 201);

  // Acceptance is token-based (`/team-invitations/:token/accept`) and the
  // token is emailed; substitute a known token by writing its hash the same
  // way the backend does (hex sha256, per shared/security/tokens.ts).
  const teamToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const teamHash = execSync(`printf '%s' '${teamToken}' | sha256sum | cut -d' ' -f1`, { shell: "/bin/bash" }).toString().trim();
  psql(`update team_invitation set token_hash = '${teamHash}' where id = '${invite.body.id}';`);
  const acceptInvite = await p2.call("POST", `/team-invitations/${teamToken}/accept`, {});
  check("P2 accepted the team invitation", acceptInvite.status, 200);
  const memberCount = psql(`select count(*) from challenge_team_member where team_id = '${teamId}';`);
  check("team now has 2 members", memberCount, "2");

  // --------------------------------------------------------- SUBMISSION
  log("=== PHASE 5: submission draft -> finalize (real UI for the editor) ===");
  await p1.page.goto(`${WEB}/app/submissions/new?organizationId=${ORG_ID}&challengeId=${challengeId}`);
  await p1.page.waitForTimeout(2500);
  const editorVisible = await p1.page.locator('input[placeholder*="AuraMesh"]').first().isVisible().catch(() => false);
  check("submission editor reachable for approved participant", editorVisible, true);

  const draft = await p1.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/submissions`);
  check("submission created", draft.status, 201);
  const submissionId = draft.body.id;
  const saved = await p1.call("PATCH", `/organizations/${ORG_ID}/challenges/${challengeId}/submissions/${submissionId}/draft`, {
    title: "E2E Autonomous Agent",
    tagline: "Agents that plan and act.",
    problemStatement: "Manual workflows are slow and error-prone at scale.",
    solutionDescription: "A planner-executor agent loop with verifiable steps and rollback.",
  });
  check("draft saved with no optional URLs", saved.status, 200);
  const finalized = await p1.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/submissions/${submissionId}/finalize`, {}, { "idempotency-key": crypto.randomUUID() });
  check("submission finalized", finalized.status, 200);
  check("DB says FINALIZED", psql(`select status from submission where id = '${submissionId}';`), "FINALIZED");

  // ------------------------------------------------------------ JUDGING
  log("=== PHASE 6: judge assignment and scoring ===");
  const judgeEmail = `e2e-judge-${stamp}@example.org`;
  await signUpVerified(browser, judgeEmail, "E2E Judge");
  const judgeId = psql(`select id from "user" where email = '${judgeEmail}';`);

  const staffInvite = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/staff-invitations`, {
    email: judgeEmail, role: "JUDGE",
  });
  check("judge staff invitation created", staffInvite.status, 201);

  // Token is emailed via real Resend in this env; reproduce the stored hash
  // the same way the backend does (sha256 of the raw token) to accept it.
  const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const hash = execSync(`printf '%s' '${rawToken}' | sha256sum | cut -d' ' -f1`, { shell: "/bin/bash" }).toString().trim();
  psql(`update challenge_staff_invitation set token_hash = '${hash}' where id = '${staffInvite.body.id}';`);
  const judge = await apiCtx(browser, judgeEmail, PASSWORD);
  judge.page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`JUDGE: ${m.text()}`); });
  const acceptStaff = await judge.call("POST", `/challenge-staff-invitations/${rawToken}/accept`, {});
  check("judge accepted the staff invitation", acceptStaff.status, 200);

  // A judge assignment references the judge's *staff assignment*, not the
  // user directly — a judge is challenge-scoped staff, not an org member.
  const staffList = await owner.call("GET", `/organizations/${ORG_ID}/challenges/${challengeId}/staff`);
  const judgeStaff = (staffList.body.items ?? staffList.body ?? []).find((s) => s.userId === judgeId);
  check("judge staff assignment exists", Boolean(judgeStaff), true);
  const assignment = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/judge-assignments`, {
    submissionId, staffAssignmentId: judgeStaff?.id,
  });
  if (!check("judge assigned to the submission", assignment.status, 201)) {
    log(`  -> ${JSON.stringify(assignment.body)}`);
  }
  const assignmentId = assignment.body.id;

  await judge.page.goto(`${WEB}/judge`);
  await judge.page.waitForTimeout(2000);
  const dashText = await judge.page.locator("main").innerText().catch(() => "");
  check("judge dashboard lists an assignment", /assignment|Autonomous|Submission/i.test(dashText), true);

  await judge.page.goto(`${WEB}/judge/assignments/${assignmentId}`);
  await judge.page.waitForTimeout(2500);
  const rubricVisible = await judge.page.locator("text=Innovation").isVisible().catch(() => false);
  check("judge sees the real rubric criteria in the UI", rubricVisible, true);

  // Scorecards are keyed by the criterion's stable `key`, not its row id.
  const criteria = rubricVersion.body?.criteria ?? [];
  const scorePayload = {
    criterionScores: criteria.map((c, i) => ({ criterionKey: c.key, score: i === 0 ? 9 : 8, comment: "Solid work." })),
  };
  const savedScore = await judge.call("PATCH", `/judging/assignments/${assignmentId}/scorecard`, scorePayload);
  if (!check("judge saved a scorecard draft", savedScore.status, 200)) log(`  -> ${JSON.stringify(savedScore.body)}`);
  const submittedScore = await judge.call("POST", `/judging/assignments/${assignmentId}/scorecard/submit`, scorePayload);
  if (!check("judge submitted the scorecard", submittedScore.status, 200)) log(`  -> ${JSON.stringify(submittedScore.body)}`);
  check("DB says scorecard SUBMITTED", assignmentId ? psql(`select status from scorecard where judge_assignment_id = '${assignmentId}';`) : "(no assignment)", "SUBMITTED");

  // ------------------------------------------------------------ RESULTS
  log("=== PHASE 7: organizer finalizes and publishes results ===");
  const finalizeJudging = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/judging/finalize`, {});
  check("judging finalized", finalizeJudging.status, 204);
  // Finalizing results is the organizer explicitly selecting winners, not an
  // automatic ranking — the endpoint requires the selection set.
  const finalizeResults = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/results/finalize`, {
    selections: [
      { submissionId, selectionType: "WINNER", rank: 1, rankLabel: "First Place" },
    ],
  });
  if (!check("results finalized", finalizeResults.status, 200)) log(`  -> ${JSON.stringify(finalizeResults.body)}`);
  const publishResults = await owner.call("POST", `/organizations/${ORG_ID}/challenges/${challengeId}/results/publish`, {}, { "idempotency-key": crypto.randomUUID() });
  check("results published", publishResults.status, 204);
  check("challenge status is RESULTS_PUBLISHED", psql(`select status from challenge where id = '${challengeId}';`), "RESULTS_PUBLISHED");

  log("=== PHASE 8: participant sees the published result in their portal ===");
  await p1.page.goto(`${WEB}/app/results`);
  await p1.page.waitForTimeout(2500);
  const resultsText = await p1.page.locator("main").innerText().catch(() => "");
  check("participant results page lists the challenge", resultsText.includes("E2E Flow Challenge"), true);
  check("participant results page shows it as published", resultsText.includes("Results Published"), true);

  // ------------------------------------------------------------- REPORT
  log("");
  log(`Console errors captured: ${consoleErrors.length}`);
  consoleErrors.slice(0, 15).forEach((e) => log(`  ${e}`));
  log("");
  log(`RESULT: ${checks - failures}/${checks} checks passed, ${failures} failed.`);

  await browser.close();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => { console.error("[e2e] CRASHED:", err); process.exit(1); });
