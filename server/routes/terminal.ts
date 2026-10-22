import { Router } from "express"
import type { AppContext } from "../context"
import { accessForLesson } from "../access-data"
import { isLessonAccessible } from "../access"
import { runTerminalCommand } from "../terminal/runner"
import { workspacePath, writeTaskFiles } from "../lua/workspace"

function clampTimeout(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(300, Math.min(10_000, Math.round(parsed)))
}

function findTerminalTask(context: AppContext, lessonId: string, taskId: string) {
  const course = context.getCourse()
  const lesson = course.lessons[lessonId]
  if (!lesson) return { error: "lesson_not_found" as const }
  const access = accessForLesson(context.db, course, lessonId)
  if (!isLessonAccessible(course, lessonId) || access.lessons[lessonId] === "locked") {
    return { error: "lesson_locked" as const }
  }
  const task = lesson.tasks.find((item) => item.id === taskId)
  if (!task) return { error: "task_not_found" as const }
  if (task.kind !== "terminal") return { error: "not_a_terminal_task" as const }
  return { lesson, task }
}

function stateFor(context: AppContext, lessonId: string, taskId: string, starterFiles: Array<{ name: string; content: string }>) {
  const row = context.db
    .prepare("select cwd from terminal_state where lesson_id = ? and task_id = ?")
    .get(lessonId, taskId) as { cwd: string } | undefined
  if (row) return row.cwd
  const dir = workspacePath(lessonId, taskId)
  if (starterFiles.length) writeTaskFiles(lessonId, taskId, starterFiles)
  context.db
    .prepare("insert into terminal_state (lesson_id, task_id, cwd) values (?, ?, ?)")
    .run(lessonId, taskId, dir)
  return dir
}

export function createTerminalRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/tasks/:lessonId/:taskId/terminal", (req, res) => {
    const context = getContext()
    const found = findTerminalTask(context, req.params.lessonId, req.params.taskId)
    if ("error" in found) {
      res.status(found.error === "lesson_locked" ? 403 : 404).json({ error: found.error })
      return
    }
    const cwd = stateFor(context, req.params.lessonId, req.params.taskId, found.task.files)
    const history = context.db
      .prepare(
        `select command, stdout, stderr, exit_code as exitCode, created_at as createdAt
         from terminal_commands where lesson_id = ? and task_id = ?
         order by id desc limit 50`,
      )
      .all(req.params.lessonId, req.params.taskId)
      .reverse()
    res.json({ cwd, history })
  })

  router.post("/tasks/:lessonId/:taskId/terminal", async (req, res, next) => {
    try {
      const context = getContext()
      const found = findTerminalTask(context, req.params.lessonId, req.params.taskId)
      if ("error" in found) {
        res.status(found.error === "lesson_locked" ? 403 : 404).json({ error: found.error })
        return
      }
      const command = typeof req.body?.command === "string" ? req.body.command : ""
      if (!command.trim()) {
        res.status(400).json({ error: "command_empty" })
        return
      }
      const cwd = stateFor(context, req.params.lessonId, req.params.taskId, found.task.files)
      const result = await runTerminalCommand({
        lessonId: req.params.lessonId,
        taskId: req.params.taskId,
        command,
        cwd,
        timeoutMs: clampTimeout(req.body?.timeoutMs, found.task.timeoutMs || 3000),
      })
      const now = new Date().toISOString()
      context.db
        .prepare(
          `insert into terminal_commands
            (lesson_id, task_id, command, stdout, stderr, exit_code, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          req.params.lessonId,
          req.params.taskId,
          command,
          result.stdout,
          result.stderr,
          result.exitCode,
          now,
        )
      context.db
        .prepare("update terminal_state set cwd = ? where lesson_id = ? and task_id = ?")
        .run(result.cwd, req.params.lessonId, req.params.taskId)
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  return router
}
