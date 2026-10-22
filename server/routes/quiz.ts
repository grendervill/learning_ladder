import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"

export function createQuizRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.put("/lessons/:id/quiz-answers", (req, res) => {
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
    if (!lesson.quiz) {
      res.status(400).json({ error: "quiz_missing" })
      return
    }
    const input = req.body?.answers
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      res.status(400).json({ error: "answer_invalid" })
      return
    }

    const questions = new Map(lesson.quiz.questions.map((question) => [question.id, question]))
    const values: Array<[string, unknown]> = []
    for (const [questionId, value] of Object.entries(input)) {
      const question = questions.get(questionId)
      if (!question) {
        res.status(400).json({ error: "answer_invalid" })
        return
      }
      if (question.type === "single") {
        if (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < 0 ||
          value >= question.options.length
        ) {
          res.status(400).json({ error: "answer_invalid" })
          return
        }
      } else if (typeof value !== "string") {
        res.status(400).json({ error: "answer_invalid" })
        return
      }
      values.push([questionId, value])
    }

    const savedAt = new Date().toISOString()
    const statement = context.db.prepare(
      `insert into quiz_answers (scope, scope_id, question_id, answer_json, updated_at)
       values (?, ?, ?, ?, ?)
       on conflict(scope, scope_id, question_id)
       do update set answer_json = excluded.answer_json, updated_at = excluded.updated_at`,
    )
    for (const [questionId, value] of values) {
      statement.run("lesson", lesson.id, questionId, JSON.stringify(value), savedAt)
    }

    res.json({ ok: true, savedAt })
  })

  return router
}
