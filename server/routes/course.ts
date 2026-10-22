import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"
import { isLessonAccessible } from "../access"
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
    if (!isLessonAccessible(course, lesson.id) || access.lessons[lesson.id] === "locked") {
      res.status(403).json({ error: "lesson_locked" })
      return
    }
    const chapter = course.chapters.find((item) => item.lessonIds.includes(lesson.id))
    const answers = Object.fromEntries(
      context.db
        .prepare("select question_id, answer_json from quiz_answers where scope = 'lesson' and scope_id = ?")
        .all(lesson.id)
        .map((row: any) => [row.question_id, JSON.parse(row.answer_json)]),
    )
    const passed = access.lessons[lesson.id] === "passed"
    res.json({
      ...publicLesson(lesson),
      quiz: publicQuiz(lesson.quiz, passed),
      answers,
      access: access.lessons[lesson.id],
      chapterId: chapter?.id ?? null,
      chapterTitle: chapter?.title ?? null,
    })
  })

  return router
}
