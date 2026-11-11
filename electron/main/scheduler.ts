import { createRequire } from "node:module";
import type { Repository } from "./db/repository";

const req = createRequire(import.meta.url);

export interface SchedulerCallbacks {
  onFocusApp: (route?: string) => void;
  iconPath?: string;
  notify?: (title: string, body: string, onClick?: () => void) => void;
  openExternal?: (url: string) => void;
}

export class Scheduler {
  #repository: Repository;
  #callbacks: SchedulerCallbacks;
  #timer?: NodeJS.Timeout;

  constructor(repository: Repository, callbacks: SchedulerCallbacks) {
    this.#repository = repository;
    this.#callbacks = callbacks;
  }

  start() {
    this.check();
    this.#timer = setInterval(() => this.check(), 15 * 60 * 1000);
  }

  stop() {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  getSentKeys(todayIsoDate: string): Set<string> {
    const key = `notifications_sent_${todayIsoDate}`;
    try {
      const row = this.#repository.db
        .prepare("SELECT value FROM preferences WHERE key = ?")
        .get(key) as { value: string } | undefined;
      if (!row) return new Set();
      return new Set(JSON.parse(row.value));
    } catch {
      return new Set();
    }
  }

  markKeySent(todayIsoDate: string, sentKey: string) {
    try {
      const sent = this.getSentKeys(todayIsoDate);
      sent.add(sentKey);
      const key = `notifications_sent_${todayIsoDate}`;
      this.#repository.db
        .prepare(
          "INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .run(key, JSON.stringify([...sent]));
    } catch (e) {
      console.error("Could not record sent notification key:", e);
    }
  }

  #sendNotification(title: string, body: string, onClick?: () => void) {
    if (this.#callbacks.notify) {
      this.#callbacks.notify(title, body, onClick);
      return;
    }

    try {
      const electron = req("electron");
      if (typeof electron === "object" && electron?.Notification?.isSupported?.()) {
        const notif = new electron.Notification({
          title,
          body,
          icon: this.#callbacks.iconPath,
        });
        if (onClick) {
          notif.on("click", onClick);
        }
        notif.show();
      }
    } catch (e) {
      console.error("Failed to show native notification:", e);
    }
  }

  #openExternal(url: string) {
    if (this.#callbacks.openExternal) {
      this.#callbacks.openExternal(url);
      return;
    }

    try {
      const electron = req("electron");
      if (typeof electron === "object" && electron?.shell?.openExternal) {
        void electron.shell.openExternal(url);
      }
    } catch (e) {
      console.error("Failed to open external url:", e);
    }
  }

  check(): { boardsCount: number; followupsCount: number; roundsCount: number } {
    void this.#repository.performDailyBackup();
    let boardsCount = 0;
    let followupsCount = 0;
    let roundsCount = 0;

    try {
      const workspace = this.#repository.loadWorkspace();
      const settings = workspace.settings as any;
      const schedulerEnabled = settings?.schedulerEnabled ?? true;
      if (!schedulerEnabled) {
        return { boardsCount, followupsCount, roundsCount };
      }

      const followUpDays = Number(settings?.followUpDays) || 7;
      const now = new Date();
      const todayIsoDate = now.toISOString().slice(0, 10);
      const sentKeys = this.getSentKeys(todayIsoDate);

      // 1. Boards due
      const boards = this.#repository.listBoards();
      for (const b of boards) {
        const itemKey = `board:${b.id}:${todayIsoDate}`;
        if (sentKeys.has(itemKey)) continue;

        const checkEveryDays = b.check_every_days || 7;
        const lastCheckedTime = b.last_checked_at ? new Date(b.last_checked_at).getTime() : 0;
        const isDue =
          isNaN(lastCheckedTime) || now.getTime() - lastCheckedTime >= checkEveryDays * 86400000;

        if (isDue) {
          sentKeys.add(itemKey);
          this.markKeySent(todayIsoDate, itemKey);
          boardsCount++;

          this.#sendNotification(
            `Job board check-in: ${b.name}`,
            `Time to check ${b.name} for new job opportunities.`,
            () => {
              if (b.url) {
                const fullUrl = b.url.startsWith("http") ? b.url : `https://${b.url}`;
                this.#openExternal(fullUrl);
                this.#repository.updateBoard(b.id, { last_checked_at: new Date().toISOString() });
              } else {
                this.#callbacks.onFocusApp("job-boards");
              }
            },
          );
        }
      }

      // 2. Applications needing follow-up (N days after applied_date, status Applied, no updates since)
      const apps = this.#repository.listApplications({ status: "Applied" });
      for (const app of apps) {
        if (!app.applied_date) continue;
        const appliedTime = new Date(
          app.applied_date.length === 10 ? `${app.applied_date}T00:00:00` : app.applied_date,
        ).getTime();
        if (isNaN(appliedTime)) continue;

        const daysSinceApplied = Math.floor((now.getTime() - appliedTime) / 86400000);
        if (daysSinceApplied < followUpDays) continue;

        // "no updates since": check updated_at vs applied_date
        const updatedDateStr = (app.updated_at || "").slice(0, 10);
        const appliedDateStr = (app.applied_date || "").slice(0, 10);
        const hasUpdatesSince = updatedDateStr > appliedDateStr;
        if (hasUpdatesSince) continue;

        const itemKey = `followup:${app.id}:${todayIsoDate}`;
        if (sentKeys.has(itemKey)) continue;

        sentKeys.add(itemKey);
        this.markKeySent(todayIsoDate, itemKey);
        followupsCount++;

        const company = this.#repository.getCompany(app.company_id);
        const companyName = company?.name || app.company_name || "Company";

        this.#sendNotification(
          `Follow up: ${companyName}`,
          `It's been ${daysSinceApplied} days since you applied for ${app.role} at ${companyName}. Time to check in.`,
          () => {
            this.#callbacks.onFocusApp(`applications/${app.id}`);
          },
        );
      }

      // 3. Rounds due today or overdue
      const upcomingRounds = this.#repository.db
        .prepare(`
          SELECT r.*, a.role, a.company_id, c.name AS company_name
          FROM rounds r
          JOIN applications a ON r.application_id = a.id
          JOIN companies c ON a.company_id = c.id
          WHERE LOWER(r.status) = 'upcoming'
            AND r.scheduled_date IS NOT NULL
            AND r.scheduled_date != ''
        `)
        .all() as any[];

      for (const round of upcomingRounds) {
        const dateStr = round.scheduled_date.slice(0, 10);
        if (dateStr <= todayIsoDate) {
          const itemKey = `round:${round.id}:${todayIsoDate}`;
          if (sentKeys.has(itemKey)) continue;

          sentKeys.add(itemKey);
          this.markKeySent(todayIsoDate, itemKey);
          roundsCount++;

          const isToday = dateStr === todayIsoDate;
          const roundName = round.title || round.type;
          const companyName = round.company_name || "Company";

          this.#sendNotification(
            isToday ? `Interview today: ${companyName}` : `Overdue round: ${companyName}`,
            isToday
              ? `${roundName} for ${round.role} is scheduled today.`
              : `${roundName} for ${round.role} was scheduled for ${dateStr}.`,
            () => {
              this.#callbacks.onFocusApp(`applications/${round.application_id}`);
            },
          );
        }
      }
    } catch (err) {
      console.error("Scheduler check error:", err);
    }

    return { boardsCount, followupsCount, roundsCount };
  }
}
