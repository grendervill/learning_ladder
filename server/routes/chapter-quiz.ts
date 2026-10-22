import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"
import type { MentorService } from "../mentor/service"
import type { MentorReviewRequest } from "../mentor/types"
import { publicQuiz } from "../content/serialize"
import { acquireMentorSession, recordActivity } from "../sessions/lifecycle"

function findChapter(context: AppContext, chapterId: string) {
  const course = context.getCourse()
  return { course, chapter: course.chapters.find((item) => item.id === chapterId) }
}

function allLessonsPassed(context: AppContext, chapterId: string) {
  const course = context.getCourse()
  const chapter = course.chapters.find((item) => item.id === chapterId)
  if (!chapter) return false
  const access = accessFor(context.db, course)
  return chapter.lessonIds.every((id) => access.lessons[id] === "passed")
}

function loadAnswers(context: AppContext, chapterId: string): Record<string, number | string> {
  return Object.fromEntries(
    context.db
      .prepare("select question_id, answer_json from quiz_answers where scope = 'chapter' and scope_id = ?")
      .all(chapterId)
      .map((row: any) => [row.question_id, JSON.parse(row.answer_json)]),
  )
}

function validateAnswers(
  questions: NonNullable<ReturnType<typeof findChapter>["chapter"]>["quiz"],
  input: unknown,
): input is Record<string, number | string> {
  if (!questions || !input || typeof input !== "object" || Array.isArray(input)) return false
  const byId = new Map(questions.questions.map((question) => [question.id, question]))
  for (const [id, value] of Object.entries(input)) {
    const question = byId.get(id)
    if (!question) return false
    if (question.type === "single") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= question.options.length) return false
    } else if (typeof value !== "string") return false
  }
  return true
}

export function createChapterQuizRouter(
  getContext: () => AppContext,
  getMentor: () => MentorService,
): Router {
  const router = Router()

  router.get("/chapters/:id/quiz", (req, res) => {
    const context = getContext()
    const { course, chapter } = findChapter(context, req.params.id)
    if (!chapter) {
      res.status(404).json({ error: "chapter_not_found" })
      return
    }
    if (!chapter.quiz) {
      res.status(404).json({ error: "chapter_quiz_missing" })
      return
    }
    const access = accessFor(context.db, course)
    const passed = access.chapters[chapter.id] === "passed"
    if (!passed && !allLessonsPassed(context, chapter.id)) {
      res.status(403).json({ error: "chapter_quiz_locked" })
      return
    }
    const progress = context.db
      .prepare("select chapter_quiz_grade as grade, feedback_json as feedbackJson from chapter_progress where chapter_id = ?")
      .get(chapter.id) as any
    res.json({
      chapterId: chapter.id,
      title: chapter.title,
      description: chapter.description,
      quiz: publicQuiz(chapter.quiz, passed),
      answers: loadAnswers(context, chapter.id),
      passed,
      grade: progress?.grade ?? null,
      feedback: progress?.feedbackJson ? JSON.parse(progress.feedbackJson) : null,
    })
  })

  router.put("/chapters/:id/quiz-answers", (req, res) => {
    const context = getContext()
    const { chapter } = findChapter(context, req.params.id)
    if (!chapter?.quiz) {
      res.status(404).json({ error: "chapter_quiz_missing" })
      return
    }
    if (!allLessonsPassed(context, chapter.id)) {
      res.status(403).json({ error: "chapter_quiz_locked" })
      return
    }
    const input = req.body?.answers
    if (!validateAnswers(chapter.quiz, input)) {
      res.status(400).json({ error: "answer_invalid" })
      return
    }
    const savedAt = new Date().toISOString()
    const statement = context.db.prepare(
      `insert into quiz_answers (scope, scope_id, question_id, answer_json, updated_at)
       values ('chapter', ?, ?, ?, ?)
       on conflict(scope, scope_id, question_id)
       do update set answer_json = excluded.answer_json, updated_at = excluded.updated_at`,
    )
    for (const [questionId, value] of Object.entries(input)) {
      statement.run(chapter.id, questionId, JSON.stringify(value), savedAt)
    }
    res.json({ ok: true, savedAt })
  })

  router.post("/chapters/:id/quiz/submit", async (req, res, next) => {
    const context = getContext()
    const { course, chapter } = findChapter(context, req.params.id)
    if (!chapter?.quiz) {
      res.status(404).json({ error: "chapter_quiz_missing" })
      return
    }
    if (!allLessonsPassed(context, chapter.id)) {
      res.status(403).json({ error: "chapter_quiz_locked" })
      return
    }

    const answers = loadAnswers(context, chapter.id)
    const quiz = chapter.quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.type === "single" ? question.options : undefined,
      correct: question.type === "single" ? question.correct : undefined,
      referenceAnswer: question.type === "text" ? question.referenceAnswer : undefined,
      criteria: question.type === "text" ? question.criteria : undefined,
      answer: answers[question.id],
    }))
    const mentorRequest: MentorReviewRequest = {
      scope: "chapter",
      lessonId: chapter.id,
      lessonTitle: chapter.title,
      chapterTitle: chapter.title,
      tasks: [],
      quiz,
    }

    const mentor = getMentor()
    const acquired = await acquireMentorSession(context, mentor)
    const sessionId = acquired.sessionId
    let feedback
    try {
      feedback = await mentor.reviewLesson(sessionId, mentorRequest)
    } catch (error) {
      next(error)
      return
    } finally {
      await acquired.release()
    }
    recordActivity(context, {
      kind: "submit",
      lessonId: chapter.id,
      meta: { scope: "chapter", grade: feedback.grade },
    })

    const passed = feedback.grade >= 4 && feedback.verdict === "pass"
    const now = new Date().toISOString()
    context.db.exec("BEGIN")
    try {
      context.db
        .prepare(
          `insert into attempts
            (scope, scope_id, kind, submitted_at, quiz_json, grade, feedback_json, mentor_session_id)
           values ('chapter', ?, 'chapter_quiz', ?, ?, ?, ?, ?)`,
        )
        .run(chapter.id, now, JSON.stringify(answers), feedback.grade, JSON.stringify(feedback), sessionId)

      context.db
        .prepare(
          `insert into chapter_progress
            (chapter_id, status, chapter_quiz_grade, best_grade, attempts, feedback_json, unlocked_at, passed_at)
           values (?, ?, ?, ?, 1, ?, ?, ?)
           on conflict(chapter_id) do update set
             status = case
               when excluded.status = 'passed' then 'passed'
               when chapter_progress.status = 'passed' then 'passed'
               else 'in_progress'
             end,
             chapter_quiz_grade = excluded.chapter_quiz_grade,
             best_grade = max(coalesce(chapter_progress.best_grade, 0), excluded.best_grade),
             attempts = chapter_progress.attempts + 1,
             feedback_json = excluded.feedback_json,
             passed_at = coalesce(chapter_progress.passed_at, excluded.passed_at),
             unlocked_at = coalesce(chapter_progress.unlocked_at, excluded.unlocked_at)`,
        )
        .run(
          chapter.id,
          passed ? "passed" : "in_progress",
          feedback.grade,
          feedback.grade,
          JSON.stringify(feedback),
          now,
          passed ? now : null,
        )
      context.db.exec("COMMIT")
    } catch (error) {
      context.db.exec("ROLLBACK")
      throw error
    }

    const access = accessFor(context.db, course)
    const index = course.chapters.findIndex((item) => item.id === chapter.id)
    const nextChapter = course.chapters[index + 1]
    const nextLessonId =
      nextChapter?.lessonIds.find((id) => access.lessons[id] === "available") ?? null

    res.json({
      grade: feedback.grade,
      verdict: feedback.verdict,
      passed,
      feedback,
      nextLessonId,
      attempts: (context.db
        .prepare("select attempts from chapter_progress where chapter_id = ?")
        .get(chapter.id) as any)?.attempts ?? 1,
    })
  })

  return router
}
