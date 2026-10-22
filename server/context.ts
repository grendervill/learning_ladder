import { resolve } from "node:path"
import type { DatabaseSync } from "./db"
import { getDb } from "./db"
import { seedFromProgressIfEmpty } from "./db/seed"
import { scanCourse } from "./content/scan"
import type { CourseSnapshot } from "./content/types"

export interface AppContext {
  db: DatabaseSync
  getCourse: () => CourseSnapshot
  progressPath: string
}

export function buildContext(
  db: DatabaseSync,
  course: CourseSnapshot,
  progressPath = resolve(process.cwd(), "PROGRESS.md"),
): AppContext {
  seedFromProgressIfEmpty(db, course, progressPath)
  return { db, getCourse: () => course, progressPath }
}

export function defaultContext(): AppContext {
  const db = getDb()
  const course = scanCourse(process.cwd())
  return buildContext(db, course)
}
