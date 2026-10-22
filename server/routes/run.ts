import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"
import { runLuaTask } from "../lua/runner"
import type { TaskFile } from "../content/types"

function loadSavedFiles(context: AppContext, lessonId: string, taskId: string): TaskFile[] {
  return context.db
    .prepare("select file_name as name, content from task_files where lesson_id = ? and task_id = ?")
    .all(lessonId, taskId)
    .map((row: any) => ({ name: String(row.name), content: String(row.content) }))
}

function clampTimeout(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(500, Math.min(10_000, Math.round(parsed)))
}

export function createRunRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.post("/tasks/:lessonId/:taskId/run", async (req, res, next) => {
    try {
      const context = getContext()
      const course = context.getCourse()
      const lesson = course.lessons[req.params.lessonId]
      if (!lesson) {
        res.status(404).json({ error: "lesson_not_found" })
        return
      }
      const access = accessFor(context.db, course)
      if (access.lessons[lesson.id] === "locked") {
        res.status(403).json({ error: "lesson_locked" })
        return
      }
      const task = lesson.tasks.find((item) => item.id === req.params.taskId)
      if (!task) {
        res.status(404).json({ error: "task_not_found" })
        return
      }
      if (task.kind === "love") {
        res.status(400).json({ error: "love_preview_is_client_side" })
        return
      }
      if (task.kind === "terminal") {
        res.status(400).json({ error: "terminal_task_uses_terminal_endpoint" })
        return
      }

      const bodyFiles = req.body?.files
      let files: TaskFile[]
      if (Array.isArray(bodyFiles)) {
        files = bodyFiles
          .filter(
            (file: unknown): file is TaskFile =>
              Boolean(
                file &&
                  typeof file === "object" &&
                  typeof (file as TaskFile).name === "string" &&
                  typeof (file as TaskFile).content === "string",
              ),
          )
          .map((file: TaskFile) => ({ name: file.name, content: file.content }))
      } else {
        const saved = loadSavedFiles(context, lesson.id, task.id)
        const savedByName = new Map(saved.map((file) => [file.name, file.content]))
        files = task.files.map((file) => ({
          name: file.name,
          content: savedByName.get(file.name) ?? file.content,
        }))
      }

      const result = await runLuaTask({
        lessonId: lesson.id,
        taskId: task.id,
        files,
        entry: task.entry,
        args: Array.isArray(req.body?.args) ? req.body.args.map(String) : task.args,
        stdin: typeof req.body?.stdin === "string" ? req.body.stdin : task.stdin,
        timeoutMs: clampTimeout(req.body?.timeoutMs, task.timeoutMs),
      })

      context.db
        .prepare(
          `insert into task_runs
            (lesson_id, task_id, stdout, stderr, exit_code, duration_ms, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          lesson.id,
          task.id,
          result.stdout,
          result.stderr,
          result.exitCode,
          result.durationMs,
          new Date().toISOString(),
        )

      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  return router
}
