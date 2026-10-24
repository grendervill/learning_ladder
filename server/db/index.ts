import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { SCHEMA_SQL } from "./schema"

export type { DatabaseSync }

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true })
  }
  const db = new DatabaseSync(path)
  db.exec("PRAGMA foreign_keys = ON")
  db.exec("PRAGMA busy_timeout = 5000")
  if (path !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL")
  }
  return db
}

export function migrate(db: DatabaseSync): void {
  db.exec(SCHEMA_SQL)
  const mentorColumns = db
    .prepare("pragma table_info(mentor_messages)")
    .all() as Array<{ name: string }>
  if (!mentorColumns.some((column) => column.name === "attachments_json")) {
    db.exec("alter table mentor_messages add column attachments_json text")
  }
}

const DEFAULT_DB_PATH = process.env.LEARNINGLUA_DB ?? "data/learninglua.db"
let singleton: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!singleton) {
    singleton = openDatabase(DEFAULT_DB_PATH)
    migrate(singleton)
  }
  return singleton
}

export function closeDb(): void {
  if (singleton) {
    singleton.close()
    singleton = null
  }
}
