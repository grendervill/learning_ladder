import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, extname, join, relative } from "node:path"
import type { ContentError, TaskContent, TaskFile, TaskKind } from "./types"

interface TaskMetadata {
  title?: string
  entry?: string
  files?: string[]
  args?: string[]
  stdin?: string
  timeoutMs?: number
  kind?: TaskKind
}

const CODE_EXTENSIONS = new Set([".lua", ".txt", ".json", ".md"])

function readText(path: string): string {
  return readFileSync(path, "utf8")
}

function addError(errors: ContentError[], lessonId: string, code: string, message: string, path?: string) {
  errors.push({ code, message, lessonId, path })
}

function cleanComment(line: string): string {
  return line.replace(/^\s*--\s?/, "").trimEnd()
}

export function leadingComments(content: string): string {
  const lines = content.split(/\r?\n/)
  const collected: string[] = []
  let started = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!started && trimmed === "") continue
    if (trimmed.startsWith("--")) {
      started = true
      collected.push(cleanComment(line))
      continue
    }
    if (started) break
  }
  return collected.join("\n").trim()
}

function firstTitle(prompt: string, fallback: string): string {
  const first = prompt.split("\n").map((line) => line.trim()).find(Boolean)
  return first || fallback
}

function readMetadata(path: string, errors: ContentError[], lessonId: string, taskId: string): TaskMetadata {
  if (!existsSync(path)) return {}
  try {
    const value = JSON.parse(readText(path)) as TaskMetadata
    if (value.kind && !["code", "terminal", "love", "project"].includes(value.kind)) {
      addError(errors, lessonId, "task_invalid_kind", `Задание ${taskId}: неизвестный kind`, path)
      return { ...value, kind: "code" }
    }
    return value
  } catch (error) {
    addError(errors, lessonId, "task_metadata_invalid", `Не удалось прочитать ${path}: ${String(error)}`, path)
    return {}
  }
}

function parseSingleTask(
  lessonDir: string,
  lessonId: string,
  fileName: string,
  errors: ContentError[],
): TaskContent {
  const taskPath = join(lessonDir, "tasks", fileName)
  const id = basename(fileName, extname(fileName))
  let content = ""
  try {
    content = readText(taskPath)
  } catch (cause) {
    addError(errors, lessonId, "task_read_error", `Не удалось прочитать ${fileName}: ${String(cause)}`, taskPath)
  }
  const prompt = leadingComments(content)
  const sidecarPath = join(lessonDir, "tasks", `${id}.task.json`)
  const metadata = readMetadata(sidecarPath, errors, lessonId, id)
  const files: TaskFile[] = [{ name: fileName, content }]
  const entry = metadata.entry || fileName

  if (!files.some((file) => file.name === entry)) {
    addError(errors, lessonId, "task_entry_missing", `Задание ${id}: entry ${entry} не найден`, taskPath)
  }

  return {
    id,
    title: metadata.title || firstTitle(prompt, id),
    prompt,
    kind: metadata.kind ?? "code",
    entry,
    files,
    args: metadata.args ?? [],
    stdin: metadata.stdin ?? "",
    timeoutMs: metadata.timeoutMs ?? 3000,
  }
}

function walkFiles(root: string, dir = root): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(root, path))
    } else if (entry.isFile() && CODE_EXTENSIONS.has(extname(entry.name))) {
      out.push(relative(root, path))
    }
  }
  return out.sort()
}

function parseFolderTask(
  lessonDir: string,
  lessonId: string,
  folderName: string,
  errors: ContentError[],
): TaskContent {
  const taskDir = join(lessonDir, "tasks", folderName)
  const metadataPath = join(taskDir, "task.json")
  const metadata = readMetadata(metadataPath, errors, lessonId, folderName)
  const readmePath = join(taskDir, "README.md")
  const prompt = existsSync(readmePath) ? readText(readmePath) : ""
  const titleFromReadme = prompt.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const declared = metadata.files?.filter((file) => typeof file === "string") ?? []
  const available = walkFiles(taskDir).filter((file) => file !== "README.md" && file !== "task.json")
  const names = declared.length ? declared : available.filter((file) => !file.endsWith(".task.json"))
  const files: TaskFile[] = []
  for (const name of names) {
    const path = join(taskDir, name)
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      addError(errors, lessonId, "task_file_missing", `Задание ${folderName}: нет файла ${name}`, path)
      continue
    }
    try {
      files.push({ name, content: readText(path) })
    } catch (cause) {
      addError(errors, lessonId, "task_read_error", `Не удалось прочитать ${name}: ${String(cause)}`, path)
    }
  }

  const kind = metadata.kind ?? "code"
  const firstLua = files.find((file) => file.name.endsWith(".lua"))?.name ?? files[0]?.name ?? "main.lua"
  const entry = kind === "terminal" ? (metadata.entry ?? "") : metadata.entry || firstLua
  if (kind !== "terminal" && !files.some((file) => file.name === entry)) {
    addError(errors, lessonId, "task_entry_missing", `Задание ${folderName}: entry ${entry} не найден`, taskDir)
  }
  if (files.length === 0 && kind !== "terminal") {
    addError(errors, lessonId, "task_no_files", `Задание ${folderName}: нет стартовых файлов`, taskDir)
  }

  return {
    id: folderName,
    title: metadata.title || titleFromReadme || folderName,
    prompt,
    kind,
    entry,
    files,
    args: metadata.args ?? [],
    stdin: metadata.stdin ?? "",
    timeoutMs: metadata.timeoutMs ?? 3000,
  }
}

export function parseTasks(lessonDir: string, lessonId: string, errors: ContentError[]): TaskContent[] {
  const tasksDir = join(lessonDir, "tasks")
  if (!existsSync(tasksDir)) return []

  const tasks: TaskContent[] = []
  for (const entry of readdirSync(tasksDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    if (entry.isFile() && extname(entry.name) === ".lua") {
      tasks.push(parseSingleTask(lessonDir, lessonId, entry.name, errors))
    } else if (entry.isDirectory()) {
      tasks.push(parseFolderTask(lessonDir, lessonId, entry.name, errors))
    }
  }

  return tasks.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}
