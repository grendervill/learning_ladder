import { Router } from "express"
import type { AppContext } from "../context"
import { accessForCourse } from "../access-data"
import {
  courseIdForLesson,
  courseMetaForLesson,
  courseView,
  coursesOf,
} from "../content/courses"

export function createProgressRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/progress", (req, res) => {
    const context = getContext()
    const snapshot = context.getCourse()
    const courses = coursesOf(snapshot)
    const requested = typeof req.query.courseId === "string" ? req.query.courseId : undefined
    const course = (requested ? courses.find((item) => item.id === requested) : courses[0]) ?? courses[0]
    if (!course) {
      res.status(404).json({ error: "course_not_found" })
      return
    }

    const view = courseView(snapshot, course.id)
    const access = accessForCourse(context.db, snapshot, course.id)
    const lessonIds = new Set(Object.keys(view.lessons))
    const chapterIds = new Set(view.chapters.map((chapter) => chapter.id))

    const lessonRows = context.db
      .prepare("select * from lesson_progress order by lesson_id")
      .all()
      .filter((row: any) => lessonIds.has(row.lesson_id))
      .map((row: any) => ({
        lessonId: row.lesson_id,
        title: view.lessons[row.lesson_id]?.title ?? row.lesson_id,
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
      .filter((row: any) => chapterIds.has(row.chapter_id))
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
      .prepare(
        "select id, started_at as startedAt, ended_at as endedAt, status, summary_md as summaryMd, stats_json as statsJson from study_sessions order by started_at desc limit 20",
      )
      .all()

    const attempts = context.db
      .prepare(
        `select id, scope, scope_id as scopeId, kind, submitted_at as submittedAt, grade, feedback_json as feedbackJson
         from attempts order by id desc limit 50`,
      )
      .all()
      .map((row: any) => {
        if (row.scope === "chapter") {
          const chapter = snapshot.chapters.find((item) => item.id === row.scopeId)
          if (chapter) {
            const courseId = chapter.courseId ?? "lua"
            const meta = courses.find((item) => item.id === courseId) ?? courseMetaForLesson(snapshot, row.scopeId)
            return {
              id: row.id,
              scope: row.scope,
              scopeId: row.scopeId,
              kind: row.kind,
              submittedAt: row.submittedAt,
              grade: row.grade,
              courseId,
              courseTitle: meta?.title ?? courseId,
              itemTitle: chapter.title,
              feedback: row.feedbackJson ? JSON.parse(row.feedbackJson) : null,
            }
          }
        }
        const courseId = courseIdForLesson(snapshot, row.scopeId)
        const meta = courses.find((item) => item.id === courseId) ?? courseMetaForLesson(snapshot, row.scopeId)
        return {
          id: row.id,
          scope: row.scope,
          scopeId: row.scopeId,
          kind: row.kind,
          submittedAt: row.submittedAt,
          grade: row.grade,
          courseId,
          courseTitle: meta?.title ?? courseId,
          itemTitle: snapshot.lessons[row.scopeId]?.title ?? row.scopeId,
          feedback: row.feedbackJson ? JSON.parse(row.feedbackJson) : null,
        }
      })
      .filter((attempt) => attempt.courseId === course.id)

    res.json({
      courseId: course.id,
      courseTitle: course.title,
      access,
      lessons: Object.fromEntries(lessonRows.map((row) => [row.lessonId, row])),
      chapters: Object.fromEntries(chapterRows.map((row) => [row.chapterId, row])),
      attempts,
      sessions,
    })
  })

  return router
}
