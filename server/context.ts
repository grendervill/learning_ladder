import { resolve } from "node:path"
import type { DatabaseSync } from "./db"
import { getDb } from "./db"
import { seedFromProgressIfEmpty } from "./db/seed"
import { scanProject } from "./content/courses"
import type { CourseSnapshot } from "./content/types"
import { ensureProjectLayout, migrateLegacyLua } from "./project"

export interface AppContext {
  db: DatabaseSync
  getCourse: () => CourseSnapshot
  refreshCourse?: () => CourseSnapshot
  progressPath: string
  root?: string
}

export function buildContext(
  db: DatabaseSync,
  course: CourseSnapshot,
  progressPath = resolve(process.cwd(), "PROGRESS.md"),
  root = process.cwd(),
): AppContext {
  seedFromProgressIfEmpty(db, course, progressPath)
  return { db, getCourse: () => course, progressPath, root }
}

export function defaultContext(): AppContext {
  const root = process.cwd()
  ensureProjectLayout(root)
  migrateLegacyLua(root)
  const db = getDb()
  let course = scanProject(root)
  const base = buildContext(db, course, resolve(root, "PROGRESS.md"), root)
  return {
    ...base,
    getCourse: () => course,
    refreshCourse: () => {
      course = scanProject(root)
      return course
    },
  }
}
