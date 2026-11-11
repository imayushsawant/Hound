import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "./migrate.ts";
import { validStore, type Store, type Application as WorkspaceApplication, type Round as WorkspaceRound } from "../../../src/data.ts";
import {
  type Company,
  type Application,
  type Round,
  type Board,
  type CreateCompanyInput,
  type UpdateCompanyInput,
  type CreateApplicationInput,
  type UpdateApplicationInput,
  type CreateRoundInput,
  type UpdateRoundInput,
  type CreateBoardInput,
  type UpdateBoardInput,
  type ApplicationStatus,
  ApplicationStatuses,
  WorkModes,
  RoundStatuses,
} from "../../../src/shared/api.ts";

/**
 * Calculates the derived next_action for an application according to requirements:
 * 1. Manual override (`next_action_override`) if set and non-empty.
 * 2. Nearest upcoming round's next_action or "<round title> on <date>".
 * 3. "Follow up" if applied > 7 days ago with no activity (and not terminal: Rejected, Offer, Withdrawn, Ghosted).
 * 4. Empty string ("") otherwise.
 */
export function deriveNextAction(
  app: {
    applied_date?: string | null;
    next_action_override?: string | null;
    status?: string;
  },
  rounds: {
    status: string;
    scheduled_date?: string | null;
    title?: string | null;
    type: string;
    next_action?: string | null;
  }[] = [],
  now: Date = new Date(),
): string {
  // 1. Manual override if set
  if (app.next_action_override && app.next_action_override.trim().length > 0) {
    return app.next_action_override.trim();
  }

  // 2. Nearest upcoming round's next_action or "<round title> on <date>"
  const upcomingRounds = rounds
    .filter((r) => r.status && r.status.toLowerCase() === "upcoming")
    .sort((a, b) => {
      const dateA = a.scheduled_date || "9999-99-99";
      const dateB = b.scheduled_date || "9999-99-99";
      return dateA.localeCompare(dateB);
    });

  if (upcomingRounds.length > 0) {
    const nearest = upcomingRounds[0];
    if (nearest.next_action && nearest.next_action.trim().length > 0) {
      return nearest.next_action.trim();
    }
    const displayTitle = (nearest.title && nearest.title.trim().length > 0) ? nearest.title.trim() : nearest.type;
    if (nearest.scheduled_date && nearest.scheduled_date.trim().length > 0) {
      return `${displayTitle} on ${nearest.scheduled_date.trim()}`;
    }
    return displayTitle;
  }

  // 3. "Follow up" if applied > 7 days ago with no activity
  // If application is terminal, do not suggest "Follow up"
  const terminalStatuses = ["Offer", "Rejected", "Ghosted", "Withdrawn"];
  if (app.applied_date && (!app.status || !terminalStatuses.includes(app.status))) {
    const appliedTime = new Date(app.applied_date).getTime();
    if (!isNaN(appliedTime)) {
      const diffDays = (now.getTime() - appliedTime) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        return "Follow up";
      }
    }
  }

  return "";
}

/** Sole owner of SQLite. Writes broadcast notifications. */
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

  // Direct database handle accessor for tests or migrations
  get db(): Database.Database {
    return this.#database;
  }

  // Only publish after the transaction commits; failed writes never invalidate pages.
  private write<T>(operation: () => T): T {
    const result = this.#database.transaction(operation).immediate();
    this.#notify();
    return result;
  }

  // ==========================================
  // COMPANIES CRUD & FIND-OR-CREATE
  // ==========================================

  findOrCreateCompany(name: string): Company {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Company name cannot be empty");

    return this.write(() => {
      const existing = this.#database
        .prepare("SELECT * FROM companies WHERE name = ? COLLATE NOCASE")
        .get(trimmed) as Company | undefined;

      if (existing) return existing;

      const stmt = this.#database.prepare(
        "INSERT INTO companies (name) VALUES (?) RETURNING *",
      );
      return stmt.get(trimmed) as Company;
    });
  }

  listCompanies(): Company[] {
    return this.#database
      .prepare("SELECT * FROM companies ORDER BY name COLLATE NOCASE ASC")
      .all() as Company[];
  }

  getCompany(id: number): Company | null {
    const company = this.#database
      .prepare("SELECT * FROM companies WHERE id = ?")
      .get(id) as Company | undefined;
    return company ?? null;
  }

  createCompany(input: CreateCompanyInput): Company {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("Company name cannot be empty");

    return this.write(() => {
      const stmt = this.#database.prepare(`
        INSERT INTO companies (name, overview, notes)
        VALUES (?, ?, ?)
        RETURNING *
      `);
      return stmt.get(trimmed, input.overview ?? null, input.notes ?? null) as Company;
    });
  }

  updateCompany(id: number, input: UpdateCompanyInput): Company {
    return this.write(() => {
      const current = this.getCompany(id);
      if (!current) throw new Error(`Company with id ${id} not found`);

      const name = input.name !== undefined ? input.name.trim() : current.name;
      if (!name) throw new Error("Company name cannot be empty");
      const overview = input.overview !== undefined ? input.overview : current.overview;
      const notes = input.notes !== undefined ? input.notes : current.notes;

      const stmt = this.#database.prepare(`
        UPDATE companies
        SET name = ?, overview = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
        RETURNING *
      `);
      return stmt.get(name, overview, notes, id) as Company;
    });
  }

  deleteCompany(id: number): boolean {
    return this.write(() => {
      const stmt = this.#database.prepare("DELETE FROM companies WHERE id = ?");
      const res = stmt.run(id);
      return res.changes > 0;
    });
  }

  // ==========================================
  // APPLICATIONS CRUD
  // ==========================================

  createApplication(input: CreateApplicationInput): Application {
    let companyId = input.company_id;
    if (!companyId) {
      if (!input.company_name || !input.company_name.trim()) {
        throw new Error("Either company_id or company_name is required");
      }
      const company = this.findOrCreateCompany(input.company_name);
      companyId = company.id;
    } else {
      const comp = this.getCompany(companyId);
      if (!comp) throw new Error(`Company with id ${companyId} does not exist`);
    }

    const role = input.role?.trim();
    if (!role) throw new Error("Role cannot be empty");

    const status: ApplicationStatus = input.status || "Applied";
    if (!ApplicationStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    if (input.work_mode && !WorkModes.includes(input.work_mode)) {
      throw new Error(`Invalid work_mode: ${input.work_mode}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const appliedDate = input.applied_date !== undefined ? input.applied_date : today;

    return this.write(() => {
      const stmt = this.#database.prepare(`
        INSERT INTO applications (
          company_id, role, status, location, work_mode, source,
          posting_url, applied_date, resume_used, next_action_override,
          offer_package, joining_date, rejection_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `);

      const raw = stmt.get(
        companyId,
        role,
        status,
        input.location ?? null,
        input.work_mode ?? null,
        input.source ?? null,
        input.posting_url ?? null,
        appliedDate ?? null,
        input.resume_used ?? null,
        input.next_action_override ?? null,
        input.offer_package ?? null,
        input.joining_date ?? null,
        input.rejection_reason ?? null,
      ) as Application;

      return this.enrichApplication(raw);
    });
  }

  private enrichApplication(app: Application): Application {
    const rounds = this.listRounds(app.id);
    const company = this.getCompany(app.company_id);
    const nextAction = deriveNextAction(app, rounds);
    return {
      ...app,
      company_name: company?.name,
      next_action: nextAction,
    };
  }

  listApplications(filter?: { companyId?: number; status?: string }): Application[] {
    let query = "SELECT a.*, c.name as company_name FROM applications a JOIN companies c ON a.company_id = c.id";
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.companyId) {
      conditions.push("a.company_id = ?");
      params.push(filter.companyId);
    }
    if (filter?.status) {
      conditions.push("a.status = ?");
      params.push(filter.status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY a.created_at DESC, a.id DESC";

    const rows = this.#database.prepare(query).all(...params) as (Application & { company_name: string })[];
    const allRounds = this.listAllRounds();

    const roundsByApp = new Map<number, Round[]>();
    for (const r of allRounds) {
      const list = roundsByApp.get(r.application_id) || [];
      list.push(r);
      roundsByApp.set(r.application_id, list);
    }

    return rows.map((app) => ({
      ...app,
      next_action: deriveNextAction(app, roundsByApp.get(app.id) || []),
    }));
  }

  getApplication(id: number): Application | null {
    const raw = this.#database
      .prepare("SELECT * FROM applications WHERE id = ?")
      .get(id) as Application | undefined;

    if (!raw) return null;
    return this.enrichApplication(raw);
  }

  updateApplication(id: number, input: UpdateApplicationInput): Application {
    return this.write(() => {
      const current = this.#database
        .prepare("SELECT * FROM applications WHERE id = ?")
        .get(id) as Application | undefined;
      if (!current) throw new Error(`Application with id ${id} not found`);

      if (input.company_id !== undefined) {
        const comp = this.getCompany(input.company_id);
        if (!comp) throw new Error(`Company with id ${input.company_id} does not exist`);
      }

      if (input.status !== undefined && !ApplicationStatuses.includes(input.status)) {
        throw new Error(`Invalid status: ${input.status}`);
      }

      if (input.work_mode !== undefined && input.work_mode !== null && !WorkModes.includes(input.work_mode)) {
        throw new Error(`Invalid work_mode: ${input.work_mode}`);
      }

      const companyId = input.company_id !== undefined ? input.company_id : current.company_id;
      const role = input.role !== undefined ? input.role.trim() : current.role;
      if (!role) throw new Error("Role cannot be empty");

      const status = input.status !== undefined ? input.status : current.status;
      const location = input.location !== undefined ? input.location : current.location;
      const workMode = input.work_mode !== undefined ? input.work_mode : current.work_mode;
      const source = input.source !== undefined ? input.source : current.source;
      const postingUrl = input.posting_url !== undefined ? input.posting_url : current.posting_url;
      const appliedDate = input.applied_date !== undefined ? input.applied_date : current.applied_date;
      const resumeUsed = input.resume_used !== undefined ? input.resume_used : current.resume_used;
      const nextActionOverride =
        input.next_action_override !== undefined ? input.next_action_override : current.next_action_override;
      const offerPackage = input.offer_package !== undefined ? input.offer_package : current.offer_package;
      const joiningDate = input.joining_date !== undefined ? input.joining_date : current.joining_date;
      const rejectionReason = input.rejection_reason !== undefined ? input.rejection_reason : current.rejection_reason;

      const stmt = this.#database.prepare(`
        UPDATE applications SET
          company_id = ?, role = ?, status = ?, location = ?, work_mode = ?,
          source = ?, posting_url = ?, applied_date = ?, resume_used = ?,
          next_action_override = ?, offer_package = ?, joining_date = ?, rejection_reason = ?
        WHERE id = ?
      `);

      stmt.run(
        companyId,
        role,
        status,
        location,
        workMode,
        source,
        postingUrl,
        appliedDate,
        resumeUsed,
        nextActionOverride,
        offerPackage,
        joiningDate,
        rejectionReason,
        id,
      );

      const raw = this.#database
        .prepare("SELECT * FROM applications WHERE id = ?")
        .get(id) as Application;

      return this.enrichApplication(raw);
    });
  }

  deleteApplication(id: number): boolean {
    return this.write(() => {
      const stmt = this.#database.prepare("DELETE FROM applications WHERE id = ?");
      const res = stmt.run(id);
      return res.changes > 0;
    });
  }

  // ==========================================
  // ROUNDS CRUD
  // ==========================================

  private listAllRounds(): Round[] {
    return this.#database
      .prepare(`
        SELECT
          id, application_id, position, type,
          title, scheduled_date, status, next_action,
          resume_used, prep_notes_md, interview_notes_md, topics_asked,
          created_at, updated_at
        FROM rounds
        ORDER BY application_id, position ASC, id ASC
      `)
      .all() as Round[];
  }

  listRounds(applicationId: number): Round[] {
    return this.#database
      .prepare(`
        SELECT
          id, application_id, position, type,
          title, scheduled_date, status, next_action,
          resume_used, prep_notes_md, interview_notes_md, topics_asked,
          created_at, updated_at
        FROM rounds
        WHERE application_id = ?
        ORDER BY position ASC, id ASC
      `)
      .all(applicationId) as Round[];
  }

  getRound(id: number): Round | null {
    const round = this.#database
      .prepare(`
        SELECT
          id, application_id, position, type,
          title, scheduled_date, status, next_action,
          resume_used, prep_notes_md, interview_notes_md, topics_asked,
          created_at, updated_at
        FROM rounds
        WHERE id = ?
      `)
      .get(id) as Round | undefined;
    return round ?? null;
  }

  createRound(input: CreateRoundInput): Round {
    const app = this.#database
      .prepare("SELECT id, status FROM applications WHERE id = ?")
      .get(input.application_id) as { id: number; status: ApplicationStatus } | undefined;
    if (!app) throw new Error(`Application with id ${input.application_id} not found`);

    if (input.status && !RoundStatuses.includes(input.status)) {
      throw new Error(`Invalid round status: ${input.status}`);
    }

    return this.write(() => {
      let position = input.position;
      if (position === undefined) {
        const maxPos = this.#database
          .prepare("SELECT COALESCE(MAX(position), -1) as max_p FROM rounds WHERE application_id = ?")
          .get(input.application_id) as { max_p: number };
        position = maxPos.max_p + 1;
      }

      // Status auto-advance from the data layer
      const oaTypes = ["Aptitude OA", "DSA OA"];
      const interviewTypes = ["Technical", "LLD", "HLD", "Managerial", "HR", "Custom"];
      let newStatus: ApplicationStatus | null = null;
      if (oaTypes.includes(input.type)) {
        if (app.status === "Saved" || app.status === "Applied") {
          newStatus = "OA";
        }
      } else if (interviewTypes.includes(input.type)) {
        if (app.status === "Saved" || app.status === "Applied" || app.status === "OA") {
          newStatus = "Interview";
        }
      }
      if (newStatus && newStatus !== app.status) {
        this.#database
          .prepare("UPDATE applications SET status = ? WHERE id = ?")
          .run(newStatus, input.application_id);
      }

      const stmt = this.#database.prepare(`
        INSERT INTO rounds (
          application_id, position, type, title, scheduled_date, status,
          next_action, resume_used, prep_notes_md, interview_notes_md, topics_asked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING
          id, application_id, position, type,
          title, scheduled_date, status, next_action, resume_used,
          prep_notes_md, interview_notes_md, topics_asked,
          created_at, updated_at
      `);

      return stmt.get(
        input.application_id,
        position,
        input.type,
        input.title ?? null,
        input.scheduled_date ?? null,
        input.status ?? "upcoming",
        input.next_action ?? null,
        input.resume_used ?? null,
        input.prep_notes_md ?? null,
        input.interview_notes_md ?? null,
        input.topics_asked ?? null,
      ) as Round;
    });
  }

  updateRound(id: number, input: UpdateRoundInput): Round {
    return this.write(() => {
      const current = this.getRound(id);
      if (!current) throw new Error(`Round with id ${id} not found`);

      if (input.status && !RoundStatuses.includes(input.status)) {
        throw new Error(`Invalid round status: ${input.status}`);
      }

      const position = input.position !== undefined ? input.position : current.position;
      const type = input.type !== undefined ? input.type : current.type;
      const title = input.title !== undefined ? input.title : current.title;
      const scheduledDate = input.scheduled_date !== undefined ? input.scheduled_date : current.scheduled_date;
      const status = input.status !== undefined ? input.status : current.status;
      const nextAction = input.next_action !== undefined ? input.next_action : current.next_action;
      const resumeUsed = input.resume_used !== undefined ? input.resume_used : current.resume_used;
      const prepNotes = input.prep_notes_md !== undefined ? input.prep_notes_md : current.prep_notes_md;
      const interviewNotes = input.interview_notes_md !== undefined ? input.interview_notes_md : current.interview_notes_md;
      const topicsAsked = input.topics_asked !== undefined ? input.topics_asked : current.topics_asked;

      const stmt = this.#database.prepare(`
        UPDATE rounds SET
          position = ?, type = ?, title = ?, scheduled_date = ?, status = ?,
          next_action = ?, resume_used = ?, prep_notes_md = ?, interview_notes_md = ?, topics_asked = ?
        WHERE id = ?
        RETURNING
          id, application_id, position, type,
          title, scheduled_date, status, next_action, resume_used,
          prep_notes_md, interview_notes_md, topics_asked,
          created_at, updated_at
      `);

      return stmt.get(
        position,
        type,
        title,
        scheduledDate,
        status,
        nextAction,
        resumeUsed,
        prepNotes,
        interviewNotes,
        topicsAsked,
        id,
      ) as Round;
    });
  }

  deleteRound(id: number): boolean {
    return this.write(() => {
      const stmt = this.#database.prepare("DELETE FROM rounds WHERE id = ?");
      const res = stmt.run(id);
      return res.changes > 0;
    });
  }

  // ==========================================
  // BOARDS CRUD
  // ==========================================

  listBoards(): Board[] {
    return this.#database.prepare(`
      SELECT
        id, name, url,
        check_every_days,
        last_checked_at
      FROM boards
      ORDER BY id ASC
    `).all() as Board[];
  }

  getBoard(id: number): Board | null {
    const board = this.#database.prepare(`
      SELECT
        id, name, url,
        check_every_days,
        last_checked_at
      FROM boards
      WHERE id = ?
    `).get(id) as Board | undefined;
    return board ?? null;
  }

  createBoard(input: CreateBoardInput): Board {
    const trimmed = input.name?.trim();
    if (!trimmed) throw new Error("Board name cannot be empty");
    const frequency = input.check_every_days || 7;

    return this.write(() => {
      const stmt = this.#database.prepare(`
        INSERT INTO boards (name, url, check_every_days, last_checked_at)
        VALUES (?, ?, ?, ?)
        RETURNING
          id, name, url,
          check_every_days,
          last_checked_at
      `);
      return stmt.get(
        trimmed,
        input.url ?? null,
        frequency,
        input.last_checked_at ?? null,
      ) as Board;
    });
  }

  updateBoard(id: number, input: UpdateBoardInput): Board {
    return this.write(() => {
      const current = this.getBoard(id);
      if (!current) throw new Error(`Board with id ${id} not found`);

      const name = input.name !== undefined ? input.name.trim() : current.name;
      if (!name) throw new Error("Board name cannot be empty");
      const url = input.url !== undefined ? input.url : current.url;
      const frequency = input.check_every_days !== undefined ? input.check_every_days : current.check_every_days;
      const lastCheckedAt = input.last_checked_at !== undefined ? input.last_checked_at : current.last_checked_at;

      const stmt = this.#database.prepare(`
        UPDATE boards SET
          name = ?, url = ?, check_every_days = ?, last_checked_at = ?
        WHERE id = ?
        RETURNING
          id, name, url,
          check_every_days,
          last_checked_at
      `);
      return stmt.get(name, url, frequency, lastCheckedAt, id) as Board;
    });
  }

  deleteBoard(id: number): boolean {
    return this.write(() => {
      const stmt = this.#database.prepare("DELETE FROM boards WHERE id = ?");
      const res = stmt.run(id);
      return res.changes > 0;
    });
  }

  // ==========================================
  // WORKSPACE LOAD / SAVE (for existing compatibility)
  // ==========================================

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
      applications: applications.map((a) => {
        const appRounds = rounds.filter((r) => r.application_id === a.id);
        const derived = deriveNextAction(a, appRounds as any);
        return {
          id: key(a),
          companyId: key(companies.find((c) => c.id === a.company_id)!),
          role: a.role,
          location: a.location || "",
          mode: a.work_mode === "internship" ? "Internship" : "Full-time",
          source: a.source || "",
          url: a.posting_url || "",
          applied: a.applied_date || "",
          updated: (a.updated_at || "").slice(0, 10),
          stage: a.status as WorkspaceApplication["stage"],
          nextAction: derived,
          nextActionOverride: a.next_action_override || "",
          resume: a.resume_used || "",
          offer: a.offer_package || "",
          joining: a.joining_date || "",
          rejection: a.rejection_reason || "",
          topics: a.technical_topics || "",
          followUpDone: Boolean(a.follow_up_done),
          rounds: appRounds
            .sort((r1, r2) => (r1.position ?? 0) - (r2.position ?? 0))
            .map((r) => ({
              id: key(r),
              position: r.position ?? 0,
              type: r.type,
              title: r.title || "",
              date: r.scheduled_date || "",
              status: (r.status as WorkspaceRound["status"]) || "upcoming",
              nextAction: r.next_action || "",
              resume: r.resume_used || "",
              prep: r.prep_notes_md || "",
              notes: r.interview_notes_md || "",
              topics: r.topics_asked || "",
            })),
        };
      }),
      boards: boards.map((b) => ({
        id: key(b),
        name: b.name,
        url: b.url || "",
        frequency: b.check_every_days,
        checked: b.last_checked_at || new Date(0).toISOString(),
        color: b.color,
      })),
      settings: preferences
        ? JSON.parse(preferences.value)
        : { name: "Alex", notifications: false, launchOnLogin: false },
    };
  }

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
        (external_key, company_id, role, status, location, work_mode, source, posting_url, applied_date, resume_used, next_action_override,
        offer_package, joining_date, rejection_reason, technical_topics, updated_at, follow_up_done, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const addRound = this.#database.prepare(`INSERT INTO rounds
        (external_key, application_id, position, type, scheduled_date, status, next_action, resume_used, prep_notes_md, interview_notes_md)
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
        "INSERT INTO boards (external_key, name, url, check_every_days, last_checked_at, color) VALUES (?, ?, ?, ?, ?, ?)",
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
