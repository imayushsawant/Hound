CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
  overview TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (length(trim(role)) > 0),
  status TEXT NOT NULL CHECK (length(trim(status)) > 0),
  location TEXT,
  work_mode TEXT CHECK (work_mode IS NULL OR work_mode IN ('internship', 'full-time')),
  source TEXT,
  posting_url TEXT,
  applied_date TEXT,
  resume_used TEXT,
  manual_next_action TEXT,
  offer_package TEXT,
  joining_date TEXT,
  rejection_reason TEXT,
  technical_topics TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE rounds (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  type TEXT NOT NULL CHECK (type IN (
    'Aptitude OA', 'DSA OA', 'Technical', 'LLD', 'HLD', 'Managerial', 'HR', 'Custom'
  )),
  custom_name TEXT,
  date TEXT,
  status TEXT NOT NULL,
  next_action TEXT,
  resume_used TEXT,
  prep_notes TEXT,
  interview_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (application_id, position)
);

CREATE TABLE boards (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  url TEXT,
  check_frequency_days INTEGER NOT NULL CHECK (check_frequency_days > 0),
  last_checked_at TEXT
);

CREATE INDEX applications_company ON applications(company_id);
