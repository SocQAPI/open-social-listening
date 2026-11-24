/**
 * Hand-written SQLite migrations, applied in order at startup and recorded in `_migrations`.
 * They live in a TypeScript module (not .sql files) so the standalone server bundle always includes them.
 * Never edit a migration that has shipped; append a new one.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_init",
    sql: `
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand_terms TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',
  competitors TEXT NOT NULL DEFAULT '[]',
  exclude_terms TEXT NOT NULL DEFAULT '[]',
  sources TEXT NOT NULL DEFAULT '{}',
  interval_minutes INTEGER NOT NULL DEFAULT 1440,
  monthly_budget_credits INTEGER NOT NULL DEFAULT 3000,
  paused INTEGER NOT NULL DEFAULT 0,
  paused_reason TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  credits_used REAL NOT NULL DEFAULT 0,
  new_mentions INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX runs_project_started ON runs (project_id, started_at);

CREATE TABLE source_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  term TEXT NOT NULL,
  task_id TEXT,
  status TEXT NOT NULL,
  credits REAL NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX source_tasks_run ON source_tasks (run_id);

CREATE TABLE mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  platform TEXT NOT NULL,
  external_id TEXT,
  url TEXT NOT NULL,
  title TEXT,
  text TEXT,
  author_name TEXT,
  author_handle TEXT,
  author_url TEXT,
  author_avatar TEXT,
  published_at TEXT,
  collected_at TEXT,
  sort_at TEXT NOT NULL,
  metrics TEXT NOT NULL DEFAULT '{}',
  matched_term TEXT NOT NULL,
  term_kind TEXT NOT NULL,
  competitor_name TEXT,
  sentiment TEXT,
  starred INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX mentions_project_url ON mentions (project_id, url);
CREATE INDEX mentions_project_sort ON mentions (project_id, sort_at, id);

CREATE TABLE alert_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  spike_multiplier REAL NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL
);
CREATE INDEX alert_channels_project ON alert_channels (project_id);
`,
  },
];
