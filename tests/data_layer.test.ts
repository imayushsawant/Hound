import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Repository, deriveNextAction } from "../electron/main/db/repository.ts";
import { Scheduler } from "../electron/main/scheduler.ts";
import { deriveClientNextAction, nextAction, boardDue } from "../src/data.ts";
import { seed } from "../scripts/seed.ts";

function createTestRepo() {
  const root = mkdtempSync(join(tmpdir(), "nudge-repo-test-"));
  const userData = join(root, "userData");
  const migrationsDir = resolve("electron/main/db/migrations");
  let changeCount = 0;
  const repo = new Repository(userData, migrationsDir, () => {
    changeCount += 1;
  });

  return {
    repo,
    get changeCount() {
      return changeCount;
    },
    close: () => {
      repo.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test("findOrCreateCompany finds existing company case-insensitively or creates new", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;

    // 1. Create with mixed case
    const c1 = repo.findOrCreateCompany("Stripe");
    assert.ok(c1.id > 0);
    assert.equal(c1.name, "Stripe");

    // 2. Find with lowercase
    const c2 = repo.findOrCreateCompany("stripe");
    assert.equal(c2.id, c1.id);
    assert.equal(c2.name, "Stripe");

    // 3. Find with uppercase and whitespace padding
    const c3 = repo.findOrCreateCompany("  STRIPE  ");
    assert.equal(c3.id, c1.id);
    assert.equal(c3.name, "Stripe");

    // 4. Create a different company
    const c4 = repo.findOrCreateCompany("Linear");
    assert.notEqual(c4.id, c1.id);
    assert.equal(c4.name, "Linear");

    // 5. Empty name throws
    assert.throws(() => repo.findOrCreateCompany("   "), /empty/);
  } finally {
    fixture.close();
  }
});

test("createApplication finds-or-creates company case-insensitively and defaults applied_date to today", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;
    const today = new Date().toISOString().slice(0, 10);

    // Create app with company_name
    const app1 = repo.createApplication({
      company_name: "Google",
      role: "Software Engineer",
    });

    assert.ok(app1.id > 0);
    assert.equal(app1.role, "Software Engineer");
    assert.equal(app1.status, "Applied");
    assert.equal(app1.applied_date, today);
    assert.equal(app1.company_name, "Google");

    // Create second app with different casing for company_name -> should attach to existing company
    const app2 = repo.createApplication({
      company_name: "google",
      role: "Staff Engineer",
    });

    assert.equal(app2.company_id, app1.company_id);
    assert.equal(app2.company_name, "Google");

    // Check company count is still 1
    const companies = repo.listCompanies();
    assert.equal(companies.length, 1);
  } finally {
    fixture.close();
  }
});

test("applications.updated_at updates whenever the application or any of its rounds change", async () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;

    const app = repo.createApplication({
      company_name: "Apple",
      role: "iOS Engineer",
    });

    const initialUpdatedAt = app.updated_at;

    // Small delay to ensure strftime '%Y-%m-%dT%H:%M:%fZ' advances
    await new Promise((r) => setTimeout(r, 20));

    // 1. Direct application update updates updated_at
    const updatedApp = repo.updateApplication(app.id, {
      location: "Cupertino, CA",
    });
    assert.notEqual(updatedApp.updated_at, initialUpdatedAt);
    const appAfterDirectUpdate = updatedApp.updated_at;

    await new Promise((r) => setTimeout(r, 20));

    // 2. Round insertion updates parent application's updated_at
    const round = repo.createRound({
      application_id: app.id,
      type: "Technical",
      title: "Round 1",
      scheduled_date: "2026-11-20",
    });
    const appAfterRoundInsert = repo.getApplication(app.id)!;
    assert.notEqual(appAfterRoundInsert.updated_at, appAfterDirectUpdate);

    await new Promise((r) => setTimeout(r, 20));

    // 3. Round update updates parent application's updated_at
    repo.updateRound(round.id, {
      status: "done",
      prep_notes_md: "## Topics to revise\n- System Design",
      interview_notes_md: "## Questions asked\n- Rate limiter",
    });
    const appAfterRoundUpdate = repo.getApplication(app.id)!;
    assert.notEqual(appAfterRoundUpdate.updated_at, appAfterRoundInsert.updated_at);
    const updatedRound = repo.getRound(round.id)!;
    assert.equal(updatedRound.prep_notes_md, "## Topics to revise\n- System Design");
    assert.equal(updatedRound.interview_notes_md, "## Questions asked\n- Rate limiter");

    await new Promise((r) => setTimeout(r, 20));

    // 4. Round delete updates parent application's updated_at
    repo.deleteRound(round.id);
    const appAfterRoundDelete = repo.getApplication(app.id)!;
    assert.notEqual(appAfterRoundDelete.updated_at, appAfterRoundUpdate.updated_at);
  } finally {
    fixture.close();
  }
});

test("derived next_action calculation logic", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  // 1. Manual override takes highest priority
  const overrideAction = deriveNextAction(
    {
      applied_date: "2026-11-01",
      next_action_override: "Call recruiter directly",
      status: "Interview",
    },
    [
      {
        status: "upcoming",
        scheduled_date: "2026-11-18",
        title: "Architecture Review",
        type: "HLD",
        next_action: "Study distributed transactions",
      },
    ],
    now,
  );
  assert.equal(overrideAction, "Call recruiter directly");

  // 2. Nearest upcoming round's next_action
  const nearestAction = deriveNextAction(
    {
      applied_date: "2026-11-01",
      next_action_override: "",
      status: "Interview",
    },
    [
      {
        status: "upcoming",
        scheduled_date: "2026-11-22",
        title: "Later Round",
        type: "HR",
        next_action: "Later action",
      },
      {
        status: "upcoming",
        scheduled_date: "2026-11-17",
        title: "Earlier Round",
        type: "Technical",
        next_action: "Prepare leetcode graphs",
      },
    ],
    now,
  );
  assert.equal(nearestAction, "Prepare leetcode graphs");

  // 3. Nearest upcoming round without explicit next_action derives "<round title> on <date>"
  const roundTitleDate = deriveNextAction(
    {
      applied_date: "2026-11-01",
      status: "OA",
    },
    [
      {
        status: "upcoming",
        scheduled_date: "2026-11-20",
        title: "CodeSignal Assessment",
        type: "DSA OA",
      },
    ],
    now,
  );
  assert.equal(roundTitleDate, "CodeSignal Assessment on 2026-11-20");

  // 4. "Follow up" if applied > 7 days ago with no activity
  const followUpAction = deriveNextAction(
    {
      applied_date: "2026-11-05", // 10 days before 2026-11-15
      status: "Applied",
    },
    [],
    now,
  );
  assert.equal(followUpAction, "Follow up");

  // 5. Applied <= 7 days ago with no rounds -> empty string
  const recentAction = deriveNextAction(
    {
      applied_date: "2026-11-12", // 3 days before 2026-11-15
      status: "Applied",
    },
    [],
    now,
  );
  assert.equal(recentAction, "");

  // 6. Terminal status (Offer, Rejected, etc.) does NOT derive "Follow up" even if > 7 days
  const rejectedAction = deriveNextAction(
    {
      applied_date: "2026-10-01",
      status: "Rejected",
    },
    [],
    now,
  );
  assert.equal(rejectedAction, "");
});

test("seed script populates 5 companies and 8 applications with multiple per company", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;
    seed(repo);

    const companies = repo.listCompanies();
    assert.equal(companies.length, 5);

    const applications = repo.listApplications();
    assert.equal(applications.length, 8);

    // Verify multiple applications per company (Stripe and Linear)
    const stripeApps = repo.listApplications({ companyId: companies.find((c) => c.name === "Stripe")!.id });
    assert.equal(stripeApps.length, 2);

    const linearApps = repo.listApplications({ companyId: companies.find((c) => c.name === "Linear")!.id });
    assert.equal(linearApps.length, 2);

    // Verify derived next_action in seeded applications
    const stripeIntern = stripeApps.find((a) => a.role === "Infrastructure Intern")!;
    assert.equal(stripeIntern.next_action, "Follow up");

    const linearProduct = linearApps.find((a) => a.role === "Product Engineer")!;
    assert.equal(linearProduct.next_action, "Tailor portfolio for desktop UI work");

    const boards = repo.listBoards();
    assert.equal(boards.length, 2);
  } finally {
    fixture.close();
  }
});

test("round creation auto-advances application status in data layer", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;

    // 1. Create an application in Applied status
    const app = repo.createApplication({
      company_name: "Acme Corp",
      role: "Backend Engineer",
      status: "Applied",
    });
    assert.equal(app.status, "Applied");

    // 2. Add an OA round -> status auto-advances to OA
    repo.createRound({
      application_id: app.id,
      type: "DSA OA",
      status: "upcoming",
    });
    const afterOA = repo.getApplication(app.id)!;
    assert.equal(afterOA.status, "OA");

    // 3. Add a Technical round -> status auto-advances to Interview
    repo.createRound({
      application_id: app.id,
      type: "Technical",
      status: "upcoming",
    });
    const afterTech = repo.getApplication(app.id)!;
    assert.equal(afterTech.status, "Interview");

    // 4. Add an HR round -> remains Interview (does not regress)
    repo.createRound({
      application_id: app.id,
      type: "HR",
      status: "upcoming",
    });
    const afterHR = repo.getApplication(app.id)!;
    assert.equal(afterHR.status, "Interview");
  } finally {
    fixture.close();
  }
});

test("application next_action dynamically updates as rounds and overrides change", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;

    // Create app applied today
    const app = repo.createApplication({
      company_name: "OpenAI",
      role: "Research Engineer",
      applied_date: new Date().toISOString().slice(0, 10),
    });
    // No rounds yet -> empty next_action
    let listed = repo.listApplications().find((a) => a.id === app.id)!;
    assert.equal(listed.next_action, "");

    // Add round 1: Technical on 2026-11-20
    const r1 = repo.createRound({
      application_id: app.id,
      type: "Technical",
      scheduled_date: "2026-11-20",
      status: "upcoming",
    });
    listed = repo.listApplications().find((a) => a.id === app.id)!;
    assert.equal(listed.next_action, "Technical on 2026-11-20");

    // Update round 1's custom next_action
    repo.updateRound(r1.id, {
      next_action: "Review transformer attention math",
    });
    listed = repo.listApplications().find((a) => a.id === app.id)!;
    assert.equal(listed.next_action, "Review transformer attention math");

    // Add nearer round: OA on 2026-11-15 -> becomes nearest upcoming
    repo.createRound({
      application_id: app.id,
      type: "DSA OA",
      scheduled_date: "2026-11-15",
      status: "upcoming",
    });
    listed = repo.listApplications().find((a) => a.id === app.id)!;
    assert.equal(listed.next_action, "DSA OA on 2026-11-15");

    // Set typed manual override on application -> takes precedence over rounds
    repo.updateApplication(app.id, {
      next_action_override: "Call recruiter to confirm schedule",
    });
    listed = repo.listApplications().find((a) => a.id === app.id)!;
    assert.equal(listed.next_action, "Call recruiter to confirm schedule");

    // Clear typed manual override -> falls back to derived upcoming round
    repo.updateApplication(app.id, {
      next_action_override: "",
    });
    listed = repo.listApplications().find((a) => a.id === app.id)!;
    assert.equal(listed.next_action, "DSA OA on 2026-11-15");
  } finally {
    fixture.close();
  }
});

test("dashboard nextAction accurately derives from rounds and manual overrides", () => {
  const baseApp = {
    id: "app-1",
    companyId: "c-1",
    role: "Fullstack Engineer",
    location: "Remote",
    mode: "Full-time",
    source: "LinkedIn",
    url: "",
    applied: new Date().toISOString().slice(0, 10),
    updated: new Date().toISOString().slice(0, 10),
    stage: "Interview" as const,
    nextAction: "",
    resume: "",
    rounds: [],
    offer: "",
    joining: "",
    rejection: "",
    topics: "",
  };

  // 1. No rounds -> empty action
  let res = deriveClientNextAction(baseApp);
  assert.equal(res.text, "");
  assert.equal(res.isAuto, true);

  // 2. Add upcoming round -> auto derived
  const appWithRound = {
    ...baseApp,
    rounds: [
      {
        id: "r-1",
        position: 0,
        type: "Technical",
        date: "2026-11-20T10:00",
        status: "upcoming" as const,
        nextAction: "",
        resume: "",
        prep: "",
        notes: "",
      },
    ],
  };
  res = deriveClientNextAction(appWithRound);
  assert.equal(res.text, "Technical on 2026-11-20");
  assert.equal(res.isAuto, true);
  assert.equal(nextAction(appWithRound), "Technical on 2026-11-20");

  // 3. Set typed override
  const appWithOverride = {
    ...appWithRound,
    nextActionOverride: "Follow up with recruiter directly",
  };
  res = deriveClientNextAction(appWithOverride);
  assert.equal(res.text, "Follow up with recruiter directly");
  assert.equal(res.isAuto, false);
  assert.equal(nextAction(appWithOverride), "Follow up with recruiter directly");

  // 4. Clear override -> returns to auto derived
  const appCleared = {
    ...appWithOverride,
    nextActionOverride: "",
  };
  res = deriveClientNextAction(appCleared);
  assert.equal(res.text, "Technical on 2026-11-20");
  assert.equal(res.isAuto, true);
});

test("job boards CRUD operations and due status derivation", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;

    // 1. Create a board
    const b1 = repo.createBoard({
      name: "RemoteOK",
      url: "https://remoteok.com",
      check_every_days: 3,
      last_checked_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    });
    assert.ok(b1.id > 0);
    assert.equal(b1.name, "RemoteOK");
    assert.equal(b1.check_every_days, 3);

    // 2. List boards
    const boards = repo.listBoards();
    assert.equal(boards.length, 1);
    assert.equal(boards[0].name, "RemoteOK");

    // 3. Check due status
    assert.equal(
      boardDue({
        id: String(b1.id),
        name: b1.name,
        url: b1.url || "",
        frequency: b1.check_every_days,
        checked: b1.last_checked_at || "",
      }),
      true,
    );

    // 4. Update board (name, url, frequency, last_checked_at)
    const nowIso = new Date().toISOString();
    const updated = repo.updateBoard(b1.id, {
      name: "RemoteOK Jobs",
      url: "https://remoteok.com/all",
      check_every_days: 7,
      last_checked_at: nowIso,
    });
    assert.equal(updated.name, "RemoteOK Jobs");
    assert.equal(updated.url, "https://remoteok.com/all");
    assert.equal(updated.check_every_days, 7);
    assert.equal(updated.last_checked_at, nowIso);

    // Not due immediately after checking
    assert.equal(
      boardDue({
        id: String(updated.id),
        name: updated.name,
        url: updated.url || "",
        frequency: updated.check_every_days,
        checked: updated.last_checked_at || "",
      }),
      false,
    );

    // 5. Delete board
    const deleted = repo.deleteBoard(b1.id);
    assert.equal(deleted, true);
    assert.equal(repo.listBoards().length, 0);
  } finally {
    fixture.close();
  }
});

test("scheduler checks due boards, follow-ups, and rounds with daily de-duplication", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;
    const today = new Date().toISOString().slice(0, 10);
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

    // 1. Create a company
    const company = repo.createCompany({ name: "NotifCorp" });

    // 2. Create a board that is due
    repo.createBoard({
      name: "TechJobs",
      url: "https://techjobs.com",
      check_every_days: 7,
      last_checked_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    });

    // 3. Create an application needing follow-up (applied 10 days ago, status Applied, updated = applied)
    const app = repo.createApplication({
      company_id: company.id,
      role: "Platform Engineer",
      status: "Applied",
      applied_date: tenDaysAgo,
    });
    // Set updated_at back to match applied_date
    repo.db.prepare("UPDATE applications SET updated_at = ? WHERE id = ?").run(tenDaysAgo, app.id);

    // 4. Create an application with a round due today
    const app2 = repo.createApplication({
      company_id: company.id,
      role: "Frontend Engineer",
      status: "Interview",
      applied_date: today,
    });
    repo.createRound({
      application_id: app2.id,
      type: "Technical",
      scheduled_date: today,
      status: "upcoming",
    });

    const notifications: { title: string; body: string }[] = [];
    const scheduler = new Scheduler(repo, {
      onFocusApp: () => {},
      notify: (title, body) => {
        notifications.push({ title, body });
      },
    });

    // Run first check -> should find 1 board, 1 follow-up, 1 round
    const res1 = scheduler.check();
    assert.equal(res1.boardsCount, 1);
    assert.equal(res1.followupsCount, 1);
    assert.equal(res1.roundsCount, 1);
    assert.equal(notifications.length, 3);
    assert.ok(notifications.some((n) => n.title.includes("TechJobs")));
    assert.ok(notifications.some((n) => n.title.includes("NotifCorp")));
    assert.ok(notifications.some((n) => n.body.includes("Platform Engineer")));

    // Run second check immediately -> deduplication prevents any repeats on same day!
    const res2 = scheduler.check();
    assert.equal(res2.boardsCount, 0);
    assert.equal(res2.followupsCount, 0);
    assert.equal(res2.roundsCount, 0);
    assert.equal(notifications.length, 3); // No new notifications
  } finally {
    fixture.close();
  }
});

test("settings defaults and persistence for launchOnLogin, followUpDays, and schedulerEnabled", () => {
  const fixture = createTestRepo();
  try {
    const { repo } = fixture;

    // 1. Initial workspace has expected defaults
    const initial = repo.loadWorkspace();
    assert.equal(initial.settings.launchOnLogin, true);
    assert.equal(initial.settings.followUpDays, 7);
    assert.equal(initial.settings.schedulerEnabled, true);

    // 2. Modify settings and save workspace
    const updatedStore = {
      ...initial,
      settings: {
        ...initial.settings,
        launchOnLogin: false,
        followUpDays: 14,
        schedulerEnabled: false,
      },
    };
    repo.saveWorkspace(updatedStore);

    // 3. Reload workspace and verify persistence
    const reloaded = repo.loadWorkspace();
    assert.equal(reloaded.settings.launchOnLogin, false);
    assert.equal(reloaded.settings.followUpDays, 14);
    assert.equal(reloaded.settings.schedulerEnabled, false);
  } finally {
    fixture.close();
  }
});
