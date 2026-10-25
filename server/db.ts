import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const MIGRATION = `
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  participants_search TEXT NOT NULL DEFAULT '',
  agenda TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  due_date TEXT,
  assignee TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  search_text TEXT NOT NULL DEFAULT '',
  meeting_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  task_id TEXT,
  content TEXT NOT NULL,
  assignee TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  position INTEGER NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting ON tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_search ON tasks(search_text);
CREATE INDEX IF NOT EXISTS idx_meetings_start ON meetings(starts_at);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_actions_meeting ON action_items(meeting_id);
`

export type AppDatabase = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let orm: AppDatabase | null = null

export function initDatabase(options?: { dbPath?: string }) {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    orm = null
  }

  const dbPath = options?.dbPath ?? process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'app.db')
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.exec(MIGRATION)
  orm = drizzle(sqlite, { schema })
  return orm
}

export function getDb(): { db: AppDatabase; sqlite: Database.Database } {
  if (!sqlite || !orm) throw new Error('Banco de dados não iniciado.')
  return { db: orm, sqlite }
}

export function withTransaction<T>(fn: () => T): T {
  const { sqlite: connection } = getDb()
  return connection.transaction(fn)()
}

export function closeDatabase() {
  if (!sqlite) return
  sqlite.close()
  sqlite = null
  orm = null
}
