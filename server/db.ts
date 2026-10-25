import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  agenda TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  assignee TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  meeting_id TEXT REFERENCES meetings(id) ON DELETE SET NULL,
  meeting_position INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_position ON tasks(status, position);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting ON tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_starts ON meetings(starts_at);
`;

export function createDatabase(filename: string) {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 3000");
  try {
    sqlite.pragma("journal_mode = WAL");
  } catch {
    // Alguns volumes não aceitam WAL. O modo padrão continua utilizável.
  }
  sqlite.exec(SCHEMA_SQL);
  const orm = drizzle(sqlite, { schema });
  return {
    orm,
    close() {
      sqlite.close();
    },
  };
}

export type AppDatabase = ReturnType<typeof createDatabase>;
