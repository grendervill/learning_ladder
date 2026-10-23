import { Router } from "express"
import type { AppContext } from "../context"
import { accessForCourse } from "../access-data"
import { isLessonAccessible } from "../access"
import {
  courseIdForLesson,
  courseMetaForLesson,
  courseView,
  coursesOf,
} from "../content/courses"
import { publicLesson, publicQuiz } from "../content/serialize"

export function createCourseRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/course", (_req, res) => {
    const context = getContext()
    const snapshot = context.getCourse()
    const course = coursesOf(snapshot)[0]
    const view = courseView(snapshot, course.id)
    const access = accessForCourse(context.db, snapshot, course.id)
    const active = context.db
      .prepare("select id, started_at as startedAt, status, goal from study_sessions where status = 'active' order by started_at desc limit 1")
      .get() as any

    res.json({
      version: snapshot.version,
      course,
      chapters: view.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        description: chapter.description,
        lessonIds: chapter.lessonIds,
        quiz: publicQuiz(chapter.quiz),
        errors: chapter.errors,
      })),
      lessons: Object.values(view.lessons).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        errors: lesson.errors,
      })),
      unassigned: course.id === "lua" ? snapshot.unassigned : [],
      errors: snapshot.errors,
      access,
      currentSession: active ?? null,
    })
  })

  router.get("/lessons/:id", (req, res) => {
    const context = getContext()
    const snapshot = context.getCourse()
    const lesson = snapshot.lessons[req.params.id]
    if (!lesson) {
      res.status(404).json({ error: "lesson_not_found" })
      return
    }
    const courseId = courseIdForLesson(snapshot, lesson.id)
    const courseMeta = courseMetaForLesson(snapshot, lesson.id)
    const access = accessForCourse(context.db, snapshot, courseId)
    if (!isLessonAccessible(courseView(snapshot, courseId), lesson.id) || access.lessons[lesson.id] === "locked") {
      res.status(403).json({ error: "lesson_locked" })
      return
    }
    const chapter = snapshot.chapters.find(
      (item) => (item.courseId ?? "lua") === courseId && item.lessonIds.includes(lesson.id),
    )
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
      course: {
        id: courseMeta.id,
        title: courseMeta.title,
        mode: courseMeta.mode,
        settings: courseMeta.settings,
      },
    })
  })

  return router
}
