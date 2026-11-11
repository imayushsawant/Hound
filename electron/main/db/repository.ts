import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "./migrate.ts";
import { validStore, type Store, type Application, type Round } from "../../../src/data.ts";

/** Sole owner of SQLite. Future feature writes belong here, never in IPC handlers. */
export class Repository {
  readonly #database: Database.Database;
  readonly #notify: () => void;
  readonly schemaVersion: number;

  constructor(userData: string, migrations: string, notify: () => void) {
    mkdirSync(userData, { recursive: true });
    this.#database = new Database(join(userData, "nudge.db"));
    this.#notify = notify;
    try {
      this.#database.pragma("journal_mode = WAL");
      this.#database.pragma("foreign_keys = ON");
      this.#database.pragma("busy_timeout = 5000");
      this.schemaVersion = this.write(() => migrate(this.#database, migrations));
    } catch (error) {
      this.#database.close();
      throw error;
    }
  }

  // Only publish after the transaction commits; failed writes never invalidate pages.
  private write<T>(operation: () => T): T {
    const result = this.#database.transaction(operation).immediate();
    this.#notify();
    return result;
  }

  loadWorkspace(): Store {
    const companies = this.#database.prepare("SELECT * FROM companies ORDER BY id").all() as Record<
      string,
      any
    >[];
    const applications = this.#database
      .prepare("SELECT * FROM applications ORDER BY created_at DESC, id DESC")
      .all() as Record<string, any>[];
    const rounds = this.#database
      .prepare("SELECT * FROM rounds ORDER BY application_id, position")
      .all() as Record<string, any>[];
    const boards = this.#database.prepare("SELECT * FROM boards ORDER BY id").all() as Record<
      string,
      any
    >[];
    const preferences = this.#database
      .prepare("SELECT value FROM preferences WHERE key = 'settings'")
      .get() as { value: string } | undefined;
    const key = (row: Record<string, any>) => row.external_key || String(row.id);
    return {
      companies: companies.map((c) => ({
        id: key(c),
        name: c.name,
        domain: c.domain,
        color: c.color,
        description: c.overview || "",
        notes: c.notes || "",
      })),
      applications: applications.map((a) => ({
        id: key(a),
        companyId: key(companies.find((c) => c.id === a.company_id)!),
        role: a.role,
        location: a.location || "",
        mode: a.work_mode === "internship" ? "Internship" : "Full-time",
        source: a.source || "",
        url: a.posting_url || "",
        applied: a.applied_date || "",
        updated: a.updated_at.slice(0, 10),
        stage: a.status as Application["stage"],
        nextAction: a.manual_next_action || "",
        resume: a.resume_used || "",
        offer: a.offer_package || "",
        joining: a.joining_date || "",
        rejection: a.rejection_reason || "",
        topics: a.technical_topics || "",
        followUpDone: Boolean(a.follow_up_done),
        rounds: rounds
          .filter((r) => r.application_id === a.id)
          .map((r) => ({
            id: key(r),
            type: r.type,
            date: r.date || "",
            status: r.status as Round["status"],
            nextAction: r.next_action || "",
            resume: r.resume_used || "",
            prep: r.prep_notes || "",
            notes: r.interview_notes || "",
          })),
      })),
      boards: boards.map((b) => ({
        id: key(b),
        name: b.name,
        url: b.url || "",
        frequency: b.check_frequency_days,
        checked: b.last_checked_at || new Date(0).toISOString(),
        color: b.color,
      })),
      settings: preferences
        ? JSON.parse(preferences.value)
        : { name: "Alex", notifications: false, launchOnLogin: false },
    };
  }

  /** One transactional write boundary; a successful commit invalidates all windows. */
  saveWorkspace(data: unknown): Store {
    if (!validStore(data)) throw new Error("Invalid workspace");
    this.write(() => {
      this.#database.exec(
        "DELETE FROM rounds; DELETE FROM applications; DELETE FROM companies; DELETE FROM boards;",
      );
      const companyIds = new Map<string, number>();
      const addCompany = this.#database.prepare(
        "INSERT INTO companies (external_key, name, overview, notes, domain, color) VALUES (?, ?, ?, ?, ?, ?)",
      );
      for (const company of data.companies) {
        const existing = this.#database
          .prepare("SELECT id FROM companies WHERE name = ? COLLATE NOCASE")
          .get(company.name.trim()) as { id: number } | undefined;
        const id =
          existing?.id ??
          Number(
            addCompany.run(
              company.id,
              company.name.trim(),
              company.description,
              company.notes,
              company.domain,
              company.color,
            ).lastInsertRowid,
          );
        companyIds.set(company.id, id);
      }
      const addApplication = this.#database.prepare(`INSERT INTO applications
        (external_key, company_id, role, status, location, work_mode, source, posting_url, applied_date, resume_used, manual_next_action,
        offer_package, joining_date, rejection_reason, technical_topics, updated_at, follow_up_done, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const addRound = this.#database.prepare(`INSERT INTO rounds
        (external_key, application_id, position, type, date, status, next_action, resume_used, prep_notes, interview_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const a of data.applications.slice().reverse()) {
        const result = addApplication.run(
          a.id,
          companyIds.get(a.companyId),
          a.role.trim(),
          a.stage,
          a.location,
          a.mode.toLowerCase(),
          a.source,
          a.url,
          a.applied,
          a.resume,
          a.nextAction,
          a.offer,
          a.joining,
          a.rejection,
          a.topics,
          a.updated,
          a.followUpDone ? 1 : 0,
          a.applied || new Date().toISOString(),
        );
        a.rounds.forEach((r, position) =>
          addRound.run(
            r.id,
            result.lastInsertRowid,
            position,
            r.type,
            r.date,
            r.status,
            r.nextAction,
            r.resume,
            r.prep,
            r.notes,
          ),
        );
      }
      const addBoard = this.#database.prepare(
        "INSERT INTO boards (external_key, name, url, check_frequency_days, last_checked_at, color) VALUES (?, ?, ?, ?, ?, ?)",
      );
      data.boards.forEach((b) =>
        addBoard.run(b.id, b.name.trim(), b.url, b.frequency, b.checked, b.color),
      );
      this.#database
        .prepare(
          "INSERT INTO preferences (key, value) VALUES ('settings', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(JSON.stringify(data.settings));
    });
    return this.loadWorkspace();
  }

  close() {
    this.#database.close();
  }
}
