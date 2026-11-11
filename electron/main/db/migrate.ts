import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

interface Migration {
  version: number;
  name: string;
  checksum: string;
  sql: string;
}

export function readMigrations(directory: string): Migration[] {
  const migrations = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => {
      const match = /^(\d+)_([\w-]+)\.sql$/.exec(name);
      if (!match) throw new Error(`Invalid migration filename: ${name}`);
      const version = Number(match[1]);
      if (!Number.isSafeInteger(version) || version < 1) {
        throw new Error(`Invalid migration number: ${name}`);
      }
      const sql = readFileSync(join(directory, name), "utf8");
      return { version, name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    })
    .sort((a, b) => a.version - b.version);
  if (migrations.length === 0) throw new Error("No SQL migrations found");
  if (new Set(migrations.map((item) => item.version)).size !== migrations.length) {
    throw new Error("Duplicate migration number");
  }
  return migrations;
}

export function migrate(database: Database.Database, directory: string): number {
  const migrations = readMigrations(directory);
  return database
    .transaction(() => {
      database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
      const applied = database
        .prepare("SELECT version, name, checksum FROM schema_migrations ORDER BY version")
        .all() as Pick<Migration, "version" | "name" | "checksum">[];
      for (const row of applied) {
        const source = migrations.find((item) => item.version === row.version);
        if (!source || source.name !== row.name || source.checksum !== row.checksum) {
          throw new Error(`Applied migration ${row.version} is missing or changed`);
        }
      }
      const latest = applied.at(-1)?.version ?? 0;
      const record = database.prepare(
        "INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)",
      );
      for (const item of migrations) {
        if (applied.some((row) => row.version === item.version)) continue;
        if (item.version <= latest)
          throw new Error(`Cannot insert migration ${item.version} before applied migrations`);
        database.exec(item.sql);
        record.run(item.version, item.name, item.checksum);
      }
      return migrations.at(-1)!.version;
    })
    .immediate();
}
