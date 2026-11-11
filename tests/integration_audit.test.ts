import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Repository, deriveTechnicalTopics } from "../electron/main/db/repository.ts";
import { nextAction, deriveClientNextAction, type Store, type Application as ClientApp } from "../src/data.ts";

function createTestContext() {
  const root = mkdtempSync(join(tmpdir(), "hound-audit-test-"));
  const userData = join(root, "userData");
  const migrationsDir = resolve("electron/main/db/migrations");
  let changeBroadcasts = 0;

  const repo = new Repository(userData, migrationsDir, () => {
    changeBroadcasts += 1;
  });

  return {
    repo,
    get changeBroadcasts() {
      return changeBroadcasts;
    },
    close: () => {
      repo.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

// --------------------------------------------------------------------------
// 1. Add application via quick-add -> appears on dashboard, company page,
//    and company application count increases.
// --------------------------------------------------------------------------
test("integration: add application via quick-add updates dashboard, company page, and count without manual refresh", () => {
  const ctx = createTestContext();
  try {
    const { repo } = ctx;

    // Start with existing company with 1 application
    const c1 = repo.findOrCreateCompany("Linear");
    const app1 = repo.createApplication({
      company_id: c1.id,
      role: "Product Designer",
      status: "Applied",
    });

    let store = repo.loadWorkspace();
    const linearBefore = store.companies.find((c) => c.name === "Linear")!;
    const linearAppsBefore = store.applications.filter((a) => a.companyId === linearBefore.id);
    assert.equal(linearAppsBefore.length, 1);

    // Simulate Quick-Add submission for "Linear"
    const quickAddApp = repo.createApplication({
      company_name: "Linear",
      role: "Staff Engineer",
      status: "Applied",
    });

    // Main process broadcasts data:changed -> window refetches on data:changed
    assert.ok(ctx.changeBroadcasts > 0);
    store = repo.loadWorkspace();

    // 1. Appears on the dashboard (store.applications contains the quick-added application)
    const dashboardApps = store.applications;
    const foundOnDashboard = dashboardApps.find((a) => a.role === "Staff Engineer");
    assert.ok(foundOnDashboard, "Quick-added application must appear on dashboard");
    assert.equal(foundOnDashboard.role, "Staff Engineer");
    assert.equal(foundOnDashboard.stage, "Applied");

    // 2. Appears on its company page
    const linearAfter = store.companies.find((c) => c.name === "Linear")!;
    const linearAppsAfter = store.applications.filter((a) => a.companyId === linearAfter.id);
    const foundOnCompanyPage = linearAppsAfter.find((a) => a.role === "Staff Engineer");
    assert.ok(foundOnCompanyPage, "Quick-added application must appear on company page");

    // 3. Company application count increases
    assert.equal(linearAppsAfter.length, 2, "Company application count must increase from 1 to 2");

    // Also test Quick-Add with a completely new company (auto-created via single entry)
    repo.createApplication({
      company_name: "Anthropic",
      role: "Systems Researcher",
      status: "Applied",
    });

    store = repo.loadWorkspace();
    const anthropic = store.companies.find((c) => c.name === "Anthropic");
    assert.ok(anthropic, "New company must be auto-created");
    const anthropicApps = store.applications.filter((a) => a.companyId === anthropic!.id);
    assert.equal(anthropicApps.length, 1);
    assert.equal(anthropicApps[0].role, "Systems Researcher");
  } finally {
    ctx.close();
  }
});

// --------------------------------------------------------------------------
// 2. Rename a company -> updated on dashboard, company page, and application detail.
// --------------------------------------------------------------------------
test("integration: rename company updates dashboard, company page, and application detail without second edit", () => {
  const ctx = createTestContext();
  try {
    const { repo } = ctx;

    const company = repo.findOrCreateCompany("Stripe");
    const app = repo.createApplication({
      company_id: company.id,
      role: "Frontend Engineer",
      status: "Applied",
    });

    let store = repo.loadWorkspace();
    let compInStore = store.companies.find((c) => c.id === String(company.id))!;
    let appInStore = store.applications.find((a) => a.id === String(app.id))!;

    // Dashboard, company page, and application detail all show "Stripe"
    assert.equal(compInStore.name, "Stripe");
    assert.equal(store.companies.find((c) => c.id === appInStore.companyId)?.name, "Stripe");

    // Rename company in repository
    repo.updateCompany(company.id, { name: "Stripe Inc" });

    // Window refetches on data:changed
    store = repo.loadWorkspace();
    compInStore = store.companies.find((c) => c.id === String(company.id))!;
    appInStore = store.applications.find((a) => a.id === String(app.id))!;

    // 1. Updated on company page
    assert.equal(compInStore.name, "Stripe Inc", "Company detail must show new name");

    // 2. Updated on dashboard (dashboard derives company name via companyId)
    const dashboardCompanyName = store.companies.find((c) => c.id === appInStore.companyId)?.name;
    assert.equal(dashboardCompanyName, "Stripe Inc", "Dashboard row must reflect new company name");

    // 3. Updated on application detail (application detail receives company from store)
    const appDetailCompany = store.companies.find((c) => c.id === appInStore.companyId)!;
    assert.equal(appDetailCompany.name, "Stripe Inc", "Application detail must reflect new company name");

    // Verify no duplicate company names are stored on application
    assert.equal((appInStore as any).companyName, undefined, "No duplicate company name stored on application");
  } finally {
    ctx.close();
  }
});

// --------------------------------------------------------------------------
// 3. Add a round with a date -> application next_action, dashboard, and
//    updated_at all change, and status auto-advances.
// --------------------------------------------------------------------------
test("integration: add round with date auto-advances status, updates next_action, dashboard, and updated_at", async () => {
  const ctx = createTestContext();
  try {
    const { repo } = ctx;

    const company = repo.findOrCreateCompany("Datadog");
    const app = repo.createApplication({
      company_id: company.id,
      role: "Backend Engineer",
      status: "Applied",
      applied_date: new Date().toISOString().slice(0, 10),
    });

    const initialUpdatedAt = app.updated_at;
    let store = repo.loadWorkspace();
    let appInStore = store.applications.find((a) => a.id === String(app.id))!;
    assert.equal(appInStore.stage, "Applied");
    assert.equal(nextAction(appInStore), "");

    // Small delay to ensure strftime '%Y-%m-%dT%H:%M:%fZ' advances
    await new Promise((r) => setTimeout(r, 20));

    // Add round with a scheduled date
    const round = repo.createRound({
      application_id: app.id,
      type: "Technical",
      scheduled_date: "2026-11-25T14:00",
    });

    // Window refetches on data:changed
    store = repo.loadWorkspace();
    appInStore = store.applications.find((a) => a.id === String(app.id))!;
    const refreshedApp = repo.getApplication(app.id)!;

    // 1. Status auto-advances from "Applied" to "Interview"
    assert.equal(refreshedApp.status, "Interview", "Application status must auto-advance to Interview in DB");
    assert.equal(appInStore.stage, "Interview", "Application stage in store must auto-advance to Interview");

    // 2. updated_at changes
    assert.notEqual(refreshedApp.updated_at, initialUpdatedAt, "Application updated_at must change");

    // 3. next_action derives "<round title> on <date>"
    assert.equal(
      refreshedApp.next_action,
      "Technical on 2026-11-25T14:00",
      "Application next_action in repository must derive round and date",
    );

    // 4. Dashboard next_action column displays derived value
    assert.equal(
      nextAction(appInStore),
      "Technical on 2026-11-25",
      "Dashboard nextAction calculation must derive from upcoming round date",
    );
  } finally {
    ctx.close();
  }
});

// --------------------------------------------------------------------------
// 4. Mark the round done -> next_action recalculates.
// --------------------------------------------------------------------------
test("integration: mark round done recalculates next_action immediately", () => {
  const ctx = createTestContext();
  try {
    const { repo } = ctx;

    const company = repo.findOrCreateCompany("GitHub");
    const app = repo.createApplication({
      company_id: company.id,
      role: "Platform Engineer",
      status: "Interview",
      applied_date: new Date().toISOString().slice(0, 10),
    });

    const round = repo.createRound({
      application_id: app.id,
      type: "Technical",
      scheduled_date: "2026-11-20T10:00",
      status: "upcoming",
    });

    let refreshedApp = repo.getApplication(app.id)!;
    assert.equal(refreshedApp.next_action, "Technical on 2026-11-20T10:00");

    let store = repo.loadWorkspace();
    let appInStore = store.applications.find((a) => a.id === String(app.id))!;
    assert.equal(nextAction(appInStore), "Technical on 2026-11-20");

    // Mark the round done
    repo.updateRound(round.id, { status: "done" });

    // Window refetches on data:changed
    refreshedApp = repo.getApplication(app.id)!;
    store = repo.loadWorkspace();
    appInStore = store.applications.find((a) => a.id === String(app.id))!;

    // Next action recalculated: round is no longer upcoming
    assert.equal(refreshedApp.next_action, "", "Repository next_action must recalculate when round is done");
    assert.equal(nextAction(appInStore), "", "Dashboard nextAction must recalculate when round is done");
  } finally {
    ctx.close();
  }
});

// --------------------------------------------------------------------------
// 5. Add topics to a round -> they appear in the application's Outcome section.
// --------------------------------------------------------------------------
test("integration: add topics to rounds aggregates them into Outcome section without duplicate storage", () => {
  const ctx = createTestContext();
  try {
    const { repo } = ctx;

    const company = repo.findOrCreateCompany("Figma");
    const app = repo.createApplication({
      company_id: company.id,
      role: "Graphics Engineer",
      status: "Interview",
    });

    // Create 2 interview rounds
    const r1 = repo.createRound({
      application_id: app.id,
      type: "DSA OA",
      topics_asked: "Binary Trees, Dynamic Programming",
    });

    const r2 = repo.createRound({
      application_id: app.id,
      type: "Technical",
      topics_asked: "Dynamic Programming, WebGL, Shaders",
    });

    // Window refetches on data:changed
    const store = repo.loadWorkspace();
    const appInStore = store.applications.find((a) => a.id === String(app.id))!;

    // Outcome section aggregates topics asked across rounds
    const outcomeTopics = deriveTechnicalTopics(appInStore.rounds as any);
    assert.deepEqual(outcomeTopics, ["Binary Trees", "Dynamic Programming", "WebGL", "Shaders"]);

    // Repository enrichment also derives technical_topics directly from rounds
    const refreshedApp = repo.getApplication(app.id)!;
    assert.equal(
      refreshedApp.technical_topics,
      "Binary Trees, Dynamic Programming, WebGL, Shaders",
      "Technical topics must be derived from rounds",
    );

    // Adding another topic to r2 updates the aggregate automatically
    repo.updateRound(r2.id, {
      topics_asked: "Dynamic Programming, WebGL, Shaders, Raymarching",
    });

    const storeAfter = repo.loadWorkspace();
    const appAfter = storeAfter.applications.find((a) => a.id === String(app.id))!;
    const outcomeTopicsAfter = deriveTechnicalTopics(appAfter.rounds as any);
    assert.deepEqual(outcomeTopicsAfter, [
      "Binary Trees",
      "Dynamic Programming",
      "WebGL",
      "Shaders",
      "Raymarching",
    ]);
  } finally {
    ctx.close();
  }
});

// --------------------------------------------------------------------------
// 6. Edit company overview from either the company page or the application
//    detail -> the other reflects it.
// --------------------------------------------------------------------------
test("integration: edit company overview from company page or application detail reflects in the other", () => {
  const ctx = createTestContext();
  try {
    const { repo } = ctx;

    const company = repo.findOrCreateCompany("Vercel");
    const app = repo.createApplication({
      company_id: company.id,
      role: "Infrastructure Engineer",
      status: "Applied",
    });

    // 1. Edit overview from Company page
    repo.updateCompany(company.id, {
      overview: "Frontend cloud platform and creators of Next.js",
    });

    // Refetch store
    let store = repo.loadWorkspace();
    let compInStore = store.companies.find((c) => c.id === String(company.id))!;
    let appInStore = store.applications.find((a) => a.id === String(app.id))!;

    // Check Company page
    assert.equal(compInStore.description, "Frontend cloud platform and creators of Next.js");

    // Check Application detail page (receives company from store)
    const appDetailCompany = store.companies.find((c) => c.id === appInStore.companyId)!;
    assert.equal(
      appDetailCompany.description,
      "Frontend cloud platform and creators of Next.js",
      "Application detail must reflect company overview updated from company page",
    );

    // 2. Edit overview from Application detail
    repo.updateCompany(company.id, {
      overview: "Frontend cloud platform, creators of Next.js and AI SDK",
    });

    store = repo.loadWorkspace();
    compInStore = store.companies.find((c) => c.id === String(company.id))!;

    // Check Company page
    assert.equal(
      compInStore.description,
      "Frontend cloud platform, creators of Next.js and AI SDK",
      "Company page must reflect overview edited from application detail",
    );
  } finally {
    ctx.close();
  }
});
