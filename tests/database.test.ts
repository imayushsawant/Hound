import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { migrate } from "../electron/main/db/migrate.ts";
import { Repository } from "../electron/main/db/repository.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "nudge-test-"));
  const directory = join(root, "migrations");
  mkdirSync(directory);
  copyFileSync(
    resolve("electron/main/db/migrations/001_initial.sql"),
    join(directory, "001_initial.sql"),
  );
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  return {
    root,
    directory,
    database,
    close: () => {
      database.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test("numbered migrations run in numeric order and are idempotent", () => {
  const f = fixture();
  try {
    writeFileSync(
      join(f.directory, "010_later.sql"),
      "ALTER TABLE companies ADD COLUMN later TEXT;",
    );
    writeFileSync(
      join(f.directory, "002_earlier.sql"),
      "ALTER TABLE companies ADD COLUMN earlier TEXT;",
    );
    assert.equal(migrate(f.database, f.directory), 10);
    assert.equal(migrate(f.database, f.directory), 10);
    assert.equal(
      f.database.prepare("SELECT count(*) AS count FROM schema_migrations").get().count,
      3,
    );
    const columns = f.database.pragma("table_info(companies)") as { name: string }[];
    assert.ok(
      columns.findIndex((c) => c.name === "earlier") < columns.findIndex((c) => c.name === "later"),
    );
  } finally {
    f.close();
  }
});

test("failed pending migrations roll back without changing existing records", () => {
  const f = fixture();
  try {
    migrate(f.database, f.directory);
    writeFileSync(
      join(f.directory, "002_broken.sql"),
      "CREATE TABLE transient (id INTEGER); INVALID SQL;",
    );
    assert.throws(() => migrate(f.database, f.directory));
    assert.equal(
      f.database.prepare("SELECT name FROM sqlite_master WHERE name = 'transient'").get(),
      undefined,
    );
    assert.equal(
      f.database.prepare("SELECT count(*) AS count FROM schema_migrations").get().count,
      1,
    );
  } finally {
    f.close();
  }
});

test("changed, missing, duplicate, invalid, and retroactive migrations are rejected", () => {
  const f = fixture();
  try {
    migrate(f.database, f.directory);
    const first = join(f.directory, "001_initial.sql");
    writeFileSync(first, "-- changed");
    assert.throws(() => migrate(f.database, f.directory), /missing or changed/);
    copyFileSync(resolve("electron/main/db/migrations/001_initial.sql"), first);
    writeFileSync(join(f.directory, "001_duplicate.sql"), "SELECT 1;");
    assert.throws(() => migrate(f.database, f.directory), /Duplicate/);
    rmSync(join(f.directory, "001_duplicate.sql"));
    writeFileSync(join(f.directory, "invalid.sql"), "SELECT 1;");
    assert.throws(() => migrate(f.database, f.directory), /Invalid/);
    rmSync(join(f.directory, "invalid.sql"));
    writeFileSync(join(f.directory, "003_later.sql"), "SELECT 1;");
    migrate(f.database, f.directory);
    writeFileSync(join(f.directory, "002_retroactive.sql"), "SELECT 1;");
    assert.throws(() => migrate(f.database, f.directory), /before applied/);
    rmSync(join(f.directory, "002_retroactive.sql"));
    rmSync(first);
    assert.throws(() => migrate(f.database, f.directory), /missing or changed/);
  } finally {
    f.close();
  }
});

test("schema requires company, role, and status but supports multiple applications per company", () => {
  const f = fixture();
  try {
    migrate(f.database, f.directory);
    f.database.prepare("INSERT INTO companies (name) VALUES (?)").run("Acme");
    assert.throws(() => f.database.prepare("INSERT INTO companies (name) VALUES (?)").run("acme"));
    const insert = f.database.prepare(
      "INSERT INTO applications (company_id, role, status) VALUES (?, ?, ?)",
    );
    insert.run(1, "Engineer", "Applied");
    insert.run(1, "Designer", "Applied");
    assert.throws(() => insert.run(999, "Engineer", "Applied"));
    assert.throws(() => insert.run(1, "", "Applied"));
    assert.throws(() => insert.run(1, "Engineer", ""));
    assert.throws(() => insert.run(1, null, "Applied"));
    assert.equal(f.database.prepare("SELECT count(*) AS count FROM applications").get().count, 2);
  } finally {
    f.close();
  }
});

test("repository creates a persistent database and broadcasts only after successful initialization", () => {
  const f = fixture();
  let changes = 0;
  try {
    const userData = join(f.root, "userData");
    const repository = new Repository(userData, f.directory, () => {
      changes += 1;
    });
    assert.equal(repository.schemaVersion, 1);
    assert.equal(changes, 1);
    repository.close();
    const persisted = new Database(join(userData, "nudge.db"));
    assert.equal(persisted.pragma("foreign_key_check").length, 0);
    assert.equal(
      persisted.prepare("SELECT count(*) AS count FROM schema_migrations").get().count,
      1,
    );
    persisted.close();
    writeFileSync(join(f.directory, "002_broken.sql"), "INVALID SQL;");
    assert.throws(
      () =>
        new Repository(userData, f.directory, () => {
          changes += 1;
        }),
    );
    assert.equal(changes, 1);
  } finally {
    f.close();
  }
});
