import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Repository, deriveNextAction } from "../electron/main/db/repository.ts";
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
    });
    const appAfterRoundUpdate = repo.getApplication(app.id)!;
    assert.notEqual(appAfterRoundUpdate.updated_at, appAfterRoundInsert.updated_at);

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
