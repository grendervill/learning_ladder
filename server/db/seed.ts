import { existsSync, readFileSync } from "node:fs"
import type { CourseSnapshot } from "../content/types"
import type { DatabaseSync } from "./index"

function insertLesson(
  db: DatabaseSync,
  lessonId: string,
  status: "available" | "passed",
  grade: number | null,
  importedFrom: string,
) {
  const now = new Date().toISOString()
  db.prepare(
    `insert into lesson_progress
      (lesson_id, status, best_grade, last_grade, attempts, feedback_json, unlocked_at, passed_at, imported_from)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    lessonId,
    status,
    grade,
    grade,
    status === "passed" ? 1 : 0,
    null,
    now,
    status === "passed" ? now : null,
    importedFrom,
  )
}

function firstLessonId(snapshot: CourseSnapshot): string | null {
  for (const chapter of snapshot.chapters) {
    if (chapter.lessonIds[0]) return chapter.lessonIds[0]
  }
  return Object.keys(snapshot.lessons)[0] ?? null
}

export function seedFromProgressIfEmpty(
  db: DatabaseSync,
  snapshot: CourseSnapshot,
  progressPath: string,
): boolean {
  const count = db.prepare("select count(*) as c from lesson_progress").get() as { c: number }
  if (count.c > 0) return false

  if (existsSync(progressPath)) {
    const content = readFileSync(progressPath, "utf8")
    const rows = content.split(/\r?\n/).filter((line) => /^\|\s*\d{2}\s*\|/.test(line))
    for (const line of rows) {
      const match = line.match(/^\|\s*(\d{2})\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/)
      if (!match) continue
      const [, number, , statusCell, gradeCell] = match
      const lessonId = Object.keys(snapshot.lessons).find((id) => id.startsWith(`${number}-`))
      if (!lessonId) continue
      const status = statusCell.trim()
      if (status.includes("сдан") || status.includes("✅")) {
        const grade = Math.max(2, Math.min(5, Number.parseInt(gradeCell.trim(), 10) || 5))
        insertLesson(db, lessonId, "passed", grade, "PROGRESS.md")
      } else if (status.includes("проверк") || status.includes("работ") || status.includes("🔄")) {
        insertLesson(db, lessonId, "available", null, "PROGRESS.md")
      }
    }
  }

  const inserted = db.prepare("select count(*) as c from lesson_progress").get() as { c: number }
  if (inserted.c === 0) {
    const first = firstLessonId(snapshot)
    if (first) insertLesson(db, first, "available", null, "system")
  }

  return true
}
