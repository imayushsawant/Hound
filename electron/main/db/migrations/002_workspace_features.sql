ALTER TABLE companies ADD COLUMN external_key TEXT;
ALTER TABLE companies ADD COLUMN domain TEXT NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN color TEXT NOT NULL DEFAULT '#798d62';
ALTER TABLE applications ADD COLUMN external_key TEXT;
ALTER TABLE applications ADD COLUMN follow_up_done INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rounds ADD COLUMN external_key TEXT;
ALTER TABLE boards ADD COLUMN external_key TEXT;
ALTER TABLE boards ADD COLUMN color TEXT NOT NULL DEFAULT '#798d62';
CREATE UNIQUE INDEX companies_external_key ON companies(external_key);
CREATE UNIQUE INDEX applications_external_key ON applications(external_key);
CREATE UNIQUE INDEX rounds_external_key ON rounds(external_key);
CREATE UNIQUE INDEX boards_external_key ON boards(external_key);
CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
