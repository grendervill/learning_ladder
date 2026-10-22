import { Router } from "express"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"
import type { TaskContent, TaskFile } from "../content/types"

const MAX_FILE_BYTES = 512 * 1024

function safeName(name: string): boolean {
  return Boolean(
    name &&
      !name.startsWith("/") &&
      !name.includes("\\") &&
      !name.includes("\0") &&
      !name.split("/").some((part) => part === ".." || part === ""),
  )
}

function loadSavedFiles(context: AppContext, lessonId: string, taskId: string): Map<string, string> {
  const rows = context.db
    .prepare("select file_name, content from task_files where lesson_id = ? and task_id = ?")
    .all(lessonId, taskId) as Array<{ file_name: string; content: string }>
  return new Map(rows.map((row) => [row.file_name, row.content]))
}

function mergeFiles(task: TaskContent, saved: Map<string, string>): TaskFile[] {
  const starterNames = new Set(task.files.map((file) => file.name))
  const files = task.files.map((file) => ({
    name: file.name,
    content: saved.get(file.name) ?? file.content,
  }))
  for (const [name, content] of saved) {
    if (!starterNames.has(name)) files.push({ name, content })
  }
  return files
}

function findTask(context: AppContext, lessonId: string, taskId: string) {
  const course = context.getCourse()
  const lesson = course.lessons[lessonId]
  if (!lesson) return { error: "lesson_not_found" as const }
  const access = accessFor(context.db, course)
  if (access.lessons[lessonId] === "locked") return { error: "lesson_locked" as const }
  const task = lesson.tasks.find((item) => item.id === taskId)
  if (!task) return { error: "task_not_found" as const }
  return { course, lesson, task }
}

export function createTaskFilesRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/tasks/:lessonId/:taskId/files", (req, res) => {
    const context = getContext()
    const found = findTask(context, req.params.lessonId, req.params.taskId)
    if ("error" in found) {
      res.status(found.error === "lesson_locked" ? 403 : 404).json({ error: found.error })
      return
    }
    const saved = loadSavedFiles(context, req.params.lessonId, req.params.taskId)
    res.json({
      files: mergeFiles(found.task, saved),
      starterFiles: found.task.files,
      kind: found.task.kind,
    })
  })

  router.put("/tasks/:lessonId/:taskId/files", (req, res) => {
    const context = getContext()
    const found = findTask(context, req.params.lessonId, req.params.taskId)
    if ("error" in found) {
      res.status(found.error === "lesson_locked" ? 403 : 404).json({ error: found.error })
      return
    }

    const input = req.body?.files
    if (!Array.isArray(input)) {
      res.status(400).json({ error: "files_invalid" })
      return
    }

    const starterNames = new Set(found.task.files.map((file) => file.name))
    const seen = new Set<string>()
    const files: TaskFile[] = []
    for (const raw of input) {
      if (!raw || typeof raw.name !== "string" || typeof raw.content !== "string") {
        res.status(400).json({ error: "files_invalid" })
        return
      }
      if (!safeName(raw.name) || seen.has(raw.name)) {
        res.status(400).json({ error: "files_invalid" })
        return
      }
      if (Buffer.byteLength(raw.content, "utf8") > MAX_FILE_BYTES) {
        res.status(413).json({ error: "file_too_large" })
        return
      }
      if (!starterNames.has(raw.name) && found.task.kind !== "project") {
        res.status(400).json({ error: "file_not_allowed" })
        return
      }
      seen.add(raw.name)
      files.push({ name: raw.name, content: raw.content })
    }

    for (const name of starterNames) {
      if (!seen.has(name)) {
        res.status(400).json({ error: "starter_file_missing", name })
        return
      }
    }

    const db = context.db
    db.exec("BEGIN")
    try {
      db.prepare("delete from task_files where lesson_id = ? and task_id = ?").run(
        req.params.lessonId,
        req.params.taskId,
      )
      const statement = db.prepare(
        "insert into task_files (lesson_id, task_id, file_name, content, updated_at) values (?, ?, ?, ?, ?)",
      )
      const now = new Date().toISOString()
      for (const file of files) {
        statement.run(req.params.lessonId, req.params.taskId, file.name, file.content, now)
      }
      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }

    res.json({ files, savedAt: new Date().toISOString() })
  })

  router.post("/tasks/:lessonId/:taskId/reset", (req, res) => {
    const context = getContext()
    const found = findTask(context, req.params.lessonId, req.params.taskId)
    if ("error" in found) {
      res.status(found.error === "lesson_locked" ? 403 : 404).json({ error: found.error })
      return
    }
    context.db
      .prepare("delete from task_files where lesson_id = ? and task_id = ?")
      .run(req.params.lessonId, req.params.taskId)
    res.json({ files: found.task.files })
  })

  return router
}
