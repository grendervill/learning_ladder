import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"
import { publicLesson, publicQuiz } from "../content/serialize"

export function createCourseRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/course", (_req, res) => {
    const context = getContext()
    const course = context.getCourse()
    const access = accessFor(context.db, course)
    const active = context.db
      .prepare("select id, started_at as startedAt, status, goal from study_sessions where status = 'active' order by started_at desc limit 1")
      .get() as any

    res.json({
      version: course.version,
      chapters: course.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        description: chapter.description,
        lessonIds: chapter.lessonIds,
        quiz: publicQuiz(chapter.quiz),
        errors: chapter.errors,
      })),
      lessons: Object.values(course.lessons).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        errors: lesson.errors,
      })),
      unassigned: course.unassigned,
      errors: course.errors,
      access,
      currentSession: active ?? null,
    })
  })

  router.get("/lessons/:id", (req, res) => {
    const context = getContext()
    const course = context.getCourse()
    const lesson = course.lessons[req.params.id]
    if (!lesson) {
      res.status(404).json({ error: "lesson_not_found" })
      return
    }
    const access = accessFor(context.db, course)
    if (access.lessons[lesson.id] === "locked") {
      res.status(403).json({ error: "lesson_locked" })
      return
    }
    res.json({
      ...publicLesson(lesson),
      access: access.lessons[lesson.id],
      chapterId: course.chapters.find((chapter) => chapter.lessonIds.includes(lesson.id))?.id ?? null,
    })
  })

  return router
}
