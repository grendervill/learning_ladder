import { randomUUID } from "node:crypto"
import { Router } from "express"
import type { AppContext } from "../context"
import { accessForLesson } from "../access-data"
import { isLessonAccessible } from "../access"
import type { MentorService } from "../mentor/service"
import type { MentorContext, MentorRun } from "../mentor/types"
import type { TaskFile } from "../content/types"
import { acquireMentorSession, recordActivity } from "../sessions/lifecycle"
import { mergeTaskFiles } from "../files"
import { courseIdForLesson, readMentorPrompt } from "../content/courses"

function savedFiles(context: AppContext, lessonId: string, taskId: string, starter: TaskFile[]): TaskFile[] {
  const saved = context.db
    .prepare("select file_name as name, content from task_files where lesson_id = ? and task_id = ?")
    .all(lessonId, taskId)
    .map((row: any) => ({ name: String(row.name), content: String(row.content) }))
  return mergeTaskFiles(starter, saved)
}

function lastRun(context: AppContext, lessonId: string, taskId: string): MentorRun | null {
  const row = context.db
    .prepare(
      `select stdout, stderr, exit_code as exitCode from task_runs
       where lesson_id = ? and task_id = ? order by id desc limit 1`,
    )
    .get(lessonId, taskId) as any
  if (!row) return null
  return { stdout: row.stdout ?? "", stderr: row.stderr ?? "", exitCode: Number(row.exitCode ?? 0) }
}

export function createMentorAskRouter(
  getContext: () => AppContext,
  getMentor: () => MentorService,
): Router {
  const router = Router()

  router.post("/mentor/ask", async (req, res, next) => {
    const context = getContext()
    const course = context.getCourse()
    const lessonId = typeof req.body?.lessonId === "string" ? req.body.lessonId : undefined
    const taskId = typeof req.body?.taskId === "string" ? req.body.taskId : undefined
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : ""
    if (!question) {
      res.status(400).json({ error: "question_empty" })
      return
    }

    let mentorContext: MentorContext = {}
    if (lessonId) {
      const lesson = course.lessons[lessonId]
      if (!lesson) {
        res.status(404).json({ error: "lesson_not_found" })
        return
      }
      const access = accessForLesson(context.db, course, lessonId)
      if (!isLessonAccessible(course, lessonId) || access.lessons[lessonId] === "locked") {
        res.status(403).json({ error: "lesson_locked" })
        return
      }
      const task = taskId ? lesson.tasks.find((item) => item.id === taskId) : undefined
      mentorContext = {
        lessonId,
        lessonTitle: lesson.title,
        taskId: task?.id,
        taskTitle: task?.title,
        code: task ? savedFiles(context, lessonId, task.id, task.files) : undefined,
        lastRun: task ? lastRun(context, lessonId, task.id) : null,
        mentorPrompt: readMentorPrompt(
          context.root ?? process.cwd(),
          courseIdForLesson(course, lessonId),
        ),
      }
    }

    const requestedConversation = typeof req.body?.conversationId === "string" ? req.body.conversationId : null
    const conversationId = requestedConversation ?? randomUUID()
    if (requestedConversation) {
      mentorContext.history = context.db
        .prepare("select role, content_md as content from mentor_messages where session_id = ? order by id desc limit 8")
        .all(conversationId)
        .reverse()
        .map((row: any) => ({
          role: row.role === "assistant" ? "assistant" : "user",
          content: String(row.content),
        })) as MentorContext["history"]
    }

    const mentor = getMentor()
    const acquired = await acquireMentorSession(context, mentor)
    const sessionId = acquired.sessionId
    let answer
    try {
      answer = await mentor.askMentor(sessionId, mentorContext, question)
    } catch (error) {
      next(error)
      return
    } finally {
      await acquired.release()
    }
    recordActivity(context, { kind: "mentor_ask", lessonId, taskId, meta: { question } })

    const now = new Date().toISOString()
    context.db
      .prepare("insert into mentor_messages (session_id, role, content_md, created_at) values (?, 'user', ?, ?)")
      .run(conversationId, question, now)
    context.db
      .prepare("insert into mentor_messages (session_id, role, content_md, created_at) values (?, 'assistant', ?, ?)")
      .run(conversationId, answer, now)

    res.json({ answer, conversationId })
  })

  return router
}
