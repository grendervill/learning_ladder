import type { DatabaseSync } from "./db"
import { computeAccess, type AccessState, type ChapterProgressRow, type LessonProgressRow } from "./access"
import type { CourseSnapshot } from "./content/types"

export function loadProgressRows(db: DatabaseSync): {
  lessons: LessonProgressRow[]
  chapters: ChapterProgressRow[]
} {
  const lessons = db
    .prepare("select lesson_id, status from lesson_progress")
    .all()
    .map((row: any) => ({ lessonId: row.lesson_id, status: row.status })) as LessonProgressRow[]
  const chapters = db
    .prepare("select chapter_id, status, chapter_quiz_grade from chapter_progress")
    .all()
    .map((row: any) => ({
      chapterId: row.chapter_id,
      status: row.status,
      chapterQuizGrade: row.chapter_quiz_grade,
    })) as ChapterProgressRow[]
  return { lessons, chapters }
}

export function accessFor(db: DatabaseSync, course: CourseSnapshot): AccessState {
  const rows = loadProgressRows(db)
  return computeAccess(course, rows.lessons, rows.chapters)
}
