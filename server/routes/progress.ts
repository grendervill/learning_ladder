import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"

export function createProgressRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/progress", (_req, res) => {
    const context = getContext()
    const course = context.getCourse()
    const access = accessFor(context.db, course)

    const lessonRows = context.db
      .prepare("select * from lesson_progress order by lesson_id")
      .all()
      .map((row: any) => ({
        lessonId: row.lesson_id,
        title: course.lessons[row.lesson_id]?.title ?? row.lesson_id,
        status: row.status,
        bestGrade: row.best_grade,
        lastGrade: row.last_grade,
        attempts: row.attempts,
        passedAt: row.passed_at,
        importedFrom: row.imported_from,
        feedback: row.feedback_json ? JSON.parse(row.feedback_json) : null,
      }))

    const chapterRows = context.db
      .prepare("select * from chapter_progress order by chapter_id")
      .all()
      .map((row: any) => ({
        chapterId: row.chapter_id,
        status: row.status,
        grade: row.chapter_quiz_grade,
        bestGrade: row.best_grade,
        attempts: row.attempts,
        passedAt: row.passed_at,
        feedback: row.feedback_json ? JSON.parse(row.feedback_json) : null,
      }))

    const sessions = context.db
      .prepare("select id, started_at as startedAt, ended_at as endedAt, status, summary_md as summaryMd, stats_json as statsJson from study_sessions order by started_at desc limit 20")
      .all()

    res.json({
      access,
      lessons: Object.fromEntries(lessonRows.map((row) => [row.lessonId, row])),
      chapters: Object.fromEntries(chapterRows.map((row) => [row.chapterId, row])),
      sessions,
    })
  })

  return router
}
