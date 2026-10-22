import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"
import type { MentorService } from "../mentor/service"
import type { MentorReviewRequest, MentorRun, MentorTaskInput } from "../mentor/types"
import { acquireMentorSession, recordActivity } from "../sessions/lifecycle"

function loadAnswers(context: AppContext, lessonId: string): Record<string, number | string> {
  return Object.fromEntries(
    context.db
      .prepare("select question_id, answer_json from quiz_answers where scope = 'lesson' and scope_id = ?")
      .all(lessonId)
      .map((row: any) => [row.question_id, JSON.parse(row.answer_json)]),
  )
}

function loadFiles(context: AppContext, lessonId: string, taskId: string, starter: Array<{ name: string; content: string }>) {
  const saved = context.db
    .prepare("select file_name as name, content from task_files where lesson_id = ? and task_id = ?")
    .all(lessonId, taskId)
    .map((row: any) => ({ name: String(row.name), content: String(row.content) }))
  if (!saved.length) return starter
  const map = new Map(saved.map((file) => [file.name, file.content]))
  return starter.map((file) => ({ ...file, content: map.get(file.name) ?? file.content }))
}

function lastRun(context: AppContext, lessonId: string, taskId: string): MentorRun | null {
  const row = context.db
    .prepare(
      `select stdout, stderr, exit_code as exitCode, duration_ms as durationMs
       from task_runs where lesson_id = ? and task_id = ? order by id desc limit 1`,
    )
    .get(lessonId, taskId) as any
  if (!row) return null
  return {
    stdout: row.stdout ?? "",
    stderr: row.stderr ?? "",
    exitCode: Number(row.exitCode ?? 0),
  }
}

export function createSubmitRouter(getContext: () => AppContext, getMentor: () => MentorService): Router {
  const router = Router()

  router.post("/lessons/:id/submit", async (req, res, next) => {
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

    const answers = loadAnswers(context, lesson.id)
    const tasks: MentorTaskInput[] = lesson.tasks.map((task) => ({
      taskId: task.id,
      title: task.title,
      prompt: task.prompt,
      kind: task.kind,
      files: loadFiles(context, lesson.id, task.id, task.files),
      lastRun: lastRun(context, lesson.id, task.id),
    }))
    const quiz = lesson.quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.type === "single" ? question.options : undefined,
      correct: question.type === "single" ? question.correct : undefined,
      referenceAnswer: question.type === "text" ? question.referenceAnswer : undefined,
      criteria: question.type === "text" ? question.criteria : undefined,
      answer: answers[question.id],
    }))
    const previousAttempts = context.db
      .prepare(
        `select grade, feedback_json as feedbackJson, submitted_at as submittedAt
         from attempts where scope = 'lesson' and scope_id = ? order by id desc limit 5`,
      )
      .all(lesson.id)
      .map((row: any) => {
        const feedback = row.feedbackJson ? JSON.parse(row.feedbackJson) : null
        return {
          grade: Number(row.grade),
          summary: feedback?.summary ?? "",
          submittedAt: row.submittedAt,
        }
      })

    const chapter = course.chapters.find((item) => item.lessonIds.includes(lesson.id))
    const request: MentorReviewRequest = {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      chapterTitle: chapter?.title ?? "Курс",
      theory: lesson.theoryMarkdown,
      practiceIntro: lesson.practiceIntro,
      tasks,
      quiz,
      previousAttempts,
    }

    const mentor = getMentor()
    const acquired = await acquireMentorSession(context, mentor)
    const sessionId = acquired.sessionId
    let feedback
    try {
      feedback = await mentor.reviewLesson(sessionId, request)
    } catch (error) {
      next(error)
      return
    } finally {
      await acquired.release()
    }
    recordActivity(context, {
      kind: "submit",
      lessonId: lesson.id,
      meta: { grade: feedback.grade },
    })

    const passed = feedback.grade >= 4 && feedback.verdict === "pass"
    const now = new Date().toISOString()
    const attemptCode = JSON.stringify(
      Object.fromEntries(tasks.map((task) => [task.taskId, task.files])),
    )
    const attemptRuns = JSON.stringify(
      Object.fromEntries(tasks.map((task) => [task.taskId, task.lastRun])),
    )
    const attemptQuiz = JSON.stringify(answers)

    context.db.exec("BEGIN")
    try {
      context.db
        .prepare(
          `insert into attempts
            (scope, scope_id, kind, submitted_at, code_json, runs_json, quiz_json, grade, feedback_json, mentor_session_id)
           values ('lesson', ?, 'lesson', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          lesson.id,
          now,
          attemptCode,
          attemptRuns,
          attemptQuiz,
          feedback.grade,
          JSON.stringify(feedback),
          sessionId,
        )

      context.db
        .prepare(
          `insert into lesson_progress
            (lesson_id, status, best_grade, last_grade, attempts, feedback_json, unlocked_at, passed_at)
           values (?, ?, ?, ?, 1, ?, ?, ?)
           on conflict(lesson_id) do update set
             status = case
               when excluded.status = 'passed' then 'passed'
               when lesson_progress.status = 'passed' then 'passed'
               else 'in_progress'
             end,
             best_grade = max(coalesce(lesson_progress.best_grade, 0), excluded.best_grade),
             last_grade = excluded.last_grade,
             attempts = lesson_progress.attempts + 1,
             feedback_json = excluded.feedback_json,
             passed_at = coalesce(lesson_progress.passed_at, excluded.passed_at),
             unlocked_at = coalesce(lesson_progress.unlocked_at, excluded.unlocked_at)`,
        )
        .run(
          lesson.id,
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

    const after = accessFor(context.db, course)
    const nextLessonId =
      chapter?.lessonIds.find((id) => id !== lesson.id && after.lessons[id] === "available") ?? null

    res.json({
      grade: feedback.grade,
      verdict: feedback.verdict,
      passed,
      feedback,
      nextLessonId,
      attempts: (context.db
        .prepare("select attempts from lesson_progress where lesson_id = ?")
        .get(lesson.id) as any)?.attempts ?? 1,
    })
  })

  return router
}
