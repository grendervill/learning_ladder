import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  COURSE_ICONS,
  COURSE_THEMES,
  DEFAULT_COURSE_META,
  DEFAULT_COURSE_SETTINGS,
  DEFAULT_LUA_COURSE_META,
  DEFAULT_LUA_MENTOR_PROMPT,
  DEFAULT_MENTOR_PROMPT,
} from "./defaults"
import { parseQuiz } from "./quiz"
import { scanCourse } from "./scan"
import type {
  Chapter,
  ContentError,
  CourseIcon,
  CourseMeta,
  CourseMode,
  CourseSettings,
  CourseSnapshot,
  CourseTheme,
  LessonContent,
  RuntimeKind,
  TaskContent,
  TaskFile,
  TaskKind,
} from "./types"

const MODES: CourseMode[] = ["general", "math", "programming"]
const RUNTIMES: RuntimeKind[] = ["none", "lua", "c", "cpp", "python", "javascript", "custom"]
const TASK_KINDS: TaskKind[] = ["code", "terminal", "love", "project", "steps"]
const COURSE_ID = /^[a-z0-9][a-z0-9-]*$/

export interface GeneratedCourse extends CourseMeta {
  chapters: Chapter[]
  lessons: Record<string, LessonContent>
}

interface RawCourseFile extends Partial<CourseMeta> {
  format?: "legacy" | "generated"
  chapters?: unknown
  lessons?: unknown
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function normalizeSettings(raw: unknown): CourseSettings {
  const value = isObject(raw) ? raw : {}
  const runtime = RUNTIMES.includes(value.runtime as RuntimeKind) ? (value.runtime as RuntimeKind) : "none"
  return {
    runtime,
    runCommand: text(value.runCommand),
    lspCommand: text(value.lspCommand),
    lspArgs: stringArray(value.lspArgs),
    fileExtension: text(value.fileExtension, DEFAULT_COURSE_SETTINGS.fileExtension),
    entry: text(value.entry, DEFAULT_COURSE_SETTINGS.entry),
  }
}

function normalizeMeta(raw: RawCourseFile, folder: string): CourseMeta {
  return {
    id: folder,
    title: text(raw.title, folder),
    description: text(raw.description),
    theme: COURSE_THEMES.includes(raw.theme as CourseTheme) ? (raw.theme as CourseTheme) : "forest",
    icon: COURSE_ICONS.includes(raw.icon as CourseIcon) ? (raw.icon as CourseIcon) : "book",
    mode: MODES.includes(raw.mode as CourseMode) ? (raw.mode as CourseMode) : "general",
    settings: normalizeSettings(raw.settings),
    builtIn: raw.builtIn === true,
    createdAt: text(raw.createdAt, new Date(0).toISOString()),
    format: raw.format === "legacy" || raw.format === "generated" ? raw.format : undefined,
  }
}

function normalizeTask(raw: unknown, courseId: string, lessonId: string, index: number): TaskContent | null {
  if (!isObject(raw)) return null
  const kind = TASK_KINDS.includes(raw.kind as TaskKind) ? (raw.kind as TaskKind) : "code"
  const files: TaskFile[] = Array.isArray(raw.files)
    ? raw.files
        .filter((file): file is Record<string, any> => isObject(file))
        .filter((file) => typeof file.name === "string" && typeof file.content === "string")
        .map((file) => ({ name: String(file.name), content: String(file.content) }))
    : []
  const id = text(raw.id, `${lessonId}-task-${index + 1}`)
  return {
    id,
    title: text(raw.title, id),
    prompt: text(raw.prompt),
    kind,
    entry: text(raw.entry, files[0]?.name ?? "solution.json"),
    files,
    args: stringArray(raw.args),
    stdin: text(raw.stdin),
    timeoutMs: Number.isFinite(Number(raw.timeoutMs)) ? Number(raw.timeoutMs) : 3000,
    ...(Array.isArray(raw.criteria) ? { criteria: raw.criteria.map(String) } : {}),
  }
}

function parseGeneratedCourse(
  raw: RawCourseFile,
  meta: CourseMeta,
): { ok: true; chapters: Chapter[]; lessons: Record<string, LessonContent> } | { ok: false; errors: ContentError[] } {
  if (!Array.isArray(raw.chapters) || !isObject(raw.lessons)) {
    return {
      ok: false,
      errors: [
        {
          code: "course_content_invalid",
          message: "В course.json нет массивов chapters и lessons",
          courseId: meta.id,
        },
      ],
    }
  }

  const errors: ContentError[] = []
  const lessons: Record<string, LessonContent> = {}
  for (const [key, value] of Object.entries(raw.lessons)) {
    if (!isObject(value)) {
      errors.push({ code: "lesson_invalid", message: `Урок ${key} имеет неверный формат`, courseId: meta.id, lessonId: key })
      continue
    }
    const id = text(value.id, key)
    const parsedQuiz = value.quiz ? parseQuiz(value.quiz) : { quiz: null, errors: [] }
    const lessonErrors = parsedQuiz.errors.map((error) => ({
      ...error,
      courseId: meta.id,
      lessonId: id,
    }))
    const tasks = Array.isArray(value.tasks)
      ? value.tasks
          .map((task, index) => normalizeTask(task, meta.id, id, index))
          .filter((task): task is TaskContent => Boolean(task))
      : []
    lessons[id] = {
      id,
      courseId: meta.id,
      title: text(value.title, id),
      theoryMarkdown: text(value.theoryMarkdown),
      practiceIntro: text(value.practiceIntro),
      tasks,
      quiz: parsedQuiz.quiz,
      errors: lessonErrors,
    }
    errors.push(...lessonErrors)
  }

  const chapters: Chapter[] = []
  for (const [index, value] of raw.chapters.entries()) {
    if (!isObject(value)) {
      errors.push({ code: "chapter_invalid", message: `Глава ${index + 1} имеет неверный формат`, courseId: meta.id })
      continue
    }
    const id = text(value.id, `${meta.id}-chapter-${index + 1}`)
    const lessonIds = stringArray(value.lessonIds)
    const chapterErrors: ContentError[] = []
    for (const lessonId of lessonIds) {
      if (!lessons[lessonId]) {
        chapterErrors.push({
          code: "chapter_lesson_missing",
          message: `В главе ${id} указан несуществующий урок ${lessonId}`,
          courseId: meta.id,
          chapterId: id,
          lessonId,
        })
      }
    }
    chapters.push({
      id,
      courseId: meta.id,
      title: text(value.title, id),
      description: text(value.description),
      lessonIds,
      quiz: null,
      errors: chapterErrors,
    })
    errors.push(...chapterErrors)
  }

  if (chapters.length === 0 || Object.keys(lessons).length === 0) {
    return {
      ok: false,
      errors: [
        ...errors,
        { code: "course_content_invalid", message: "Курс не содержит глав или уроков", courseId: meta.id },
      ],
    }
  }
  return { ok: true, chapters, lessons }
}

function conflicts(
  chapters: Chapter[],
  lessons: Record<string, LessonContent>,
  existing: CourseSnapshot,
  courseId: string,
): ContentError[] {
  const errors: ContentError[] = []
  const chapterIds = new Set(existing.chapters.map((chapter) => chapter.id))
  for (const chapter of chapters) {
    if (chapterIds.has(chapter.id)) {
      errors.push({ code: "chapter_duplicate_id", message: `Повторяется id главы: ${chapter.id}`, chapterId: chapter.id, courseId })
    }
    chapterIds.add(chapter.id)
  }
  for (const id of Object.keys(lessons)) {
    if (existing.lessons[id]) {
      errors.push({ code: "lesson_duplicate_id", message: `Повторяется id урока: ${id}`, lessonId: id, courseId })
    }
  }
  return errors
}

export function scanProject(root: string): CourseSnapshot {
  const hash = createHash("sha1")
  const errors: ContentError[] = []
  const result: CourseSnapshot = {
    version: "",
    courses: [],
    chapters: [],
    lessons: {},
    unassigned: [],
    errors,
  }
  const coursesDir = join(root, "courses")
  if (!existsSync(coursesDir)) {
    hash.update("empty-project")
    result.version = hash.digest("hex")
    return result
  }

  const folders = readdirSync(coursesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  for (const folder of folders) {
    const courseDir = join(coursesDir, folder)
    const metaPath = join(courseDir, "course.json")
    const legacy = existsSync(join(courseDir, "lessons")) || existsSync(join(courseDir, "course"))
    let raw: RawCourseFile | null = null
    if (existsSync(metaPath)) {
      try {
        raw = JSON.parse(readFileSync(metaPath, "utf8")) as RawCourseFile
      } catch (cause) {
        errors.push({
          code: "course_meta_invalid",
          message: `Не удалось прочитать course.json: ${String(cause)}`,
          courseId: folder,
          path: metaPath,
        })
        continue
      }
    }
    if (!raw && !legacy) continue

    const meta = raw ? normalizeMeta(raw, folder) : { ...DEFAULT_COURSE_META, id: folder, title: folder, createdAt: new Date(0).toISOString(), format: "legacy" as const }
    if (!COURSE_ID.test(meta.id)) {
      errors.push({ code: "course_id_invalid", message: `Некорректный id курса: ${meta.id}`, courseId: meta.id })
      continue
    }
    const format =
      raw?.format === "generated" || raw?.format === "legacy"
        ? raw.format
        : legacy
          ? "legacy"
          : Array.isArray(raw?.chapters)
            ? "generated"
            : null
    if (!format) {
      errors.push({
        code: "course_format_unknown",
        message: "Не удалось определить формат курса: нет ни папок lessons/course, ни данных в course.json",
        courseId: meta.id,
      })
      continue
    }

    if (format === "generated") {
      if (!raw) {
        errors.push({ code: "course_content_invalid", message: "Для сгенерированного курса нет course.json", courseId: meta.id })
        continue
      }
      const parsed = parseGeneratedCourse(raw, meta)
      if (!parsed.ok) {
        errors.push(...parsed.errors)
        continue
      }
      const duplicateErrors = conflicts(parsed.chapters, parsed.lessons, result, meta.id)
      if (duplicateErrors.length) {
        errors.push(...duplicateErrors)
        continue
      }
      result.courses!.push({ ...meta, format: "generated" })
      result.chapters.push(...parsed.chapters)
      Object.assign(result.lessons, parsed.lessons)
      hash.update(meta.id)
      hash.update(JSON.stringify(raw))
      continue
    }

    if (!legacy) {
      errors.push({
        code: "course_content_invalid",
        message: "Для legacy-курса нет папок lessons/course",
        courseId: meta.id,
      })
      continue
    }
    const snapshot = scanCourse(courseDir, meta.id)
    const duplicateErrors = conflicts(snapshot.chapters, snapshot.lessons, result, meta.id)
    if (duplicateErrors.length) {
      errors.push(...duplicateErrors)
      continue
    }
    result.courses!.push({ ...meta, format: "legacy" })
    result.chapters.push(...snapshot.chapters)
    Object.assign(result.lessons, snapshot.lessons)
    if (meta.id === "lua") result.unassigned = snapshot.unassigned
    errors.push(...snapshot.errors)
    hash.update(meta.id)
    hash.update(snapshot.version)
  }

  result.version = hash.digest("hex")
  return result
}

export function generatedCoursePath(root: string, courseId: string): string {
  return join(root, "courses", courseId, "course.json")
}

export function writeGeneratedCourse(root: string, course: GeneratedCourse): void {
  if (!COURSE_ID.test(course.id)) throw new Error("invalid_course_id")
  const target = generatedCoursePath(root, course.id)
  if (existsSync(target)) throw new Error("course_exists")
  const payload = {
    format: "generated",
    id: course.id,
    title: course.title,
    description: course.description,
    theme: course.theme,
    icon: course.icon,
    mode: course.mode,
    settings: course.settings,
    builtIn: course.builtIn,
    createdAt: course.createdAt,
    chapters: course.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      description: chapter.description,
      lessonIds: chapter.lessonIds,
    })),
    lessons: Object.fromEntries(
      Object.entries(course.lessons).map(([id, lesson]) => [
        id,
        {
          id: lesson.id,
          title: lesson.title,
          theoryMarkdown: lesson.theoryMarkdown,
          practiceIntro: lesson.practiceIntro,
          tasks: lesson.tasks,
          quiz: lesson.quiz,
        },
      ]),
    ),
  }
  mkdirSync(dirname(target), { recursive: true })
  const tmp = `${target}.tmp`
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  renameSync(tmp, target)
}

export function mentorPromptPath(root: string, courseId: string): string {
  return join(root, "courses", courseId, "mentor.md")
}

export function readMentorPrompt(root: string, courseId: string): string {
  const path = mentorPromptPath(root, courseId)
  if (existsSync(path)) {
    try {
      const body = readFileSync(path, "utf8").trim()
      if (body) return body
    } catch {
      // Fall through to the default.
    }
  }
  return courseId === "lua" ? DEFAULT_LUA_MENTOR_PROMPT : DEFAULT_MENTOR_PROMPT
}

export function writeMentorPrompt(root: string, courseId: string, body: string): void {
  const path = mentorPromptPath(root, courseId)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${body.trim()}\n`, "utf8")
}

export function coursesOf(snapshot: CourseSnapshot): CourseMeta[] {
  return snapshot.courses && snapshot.courses.length ? snapshot.courses : [DEFAULT_LUA_COURSE_META]
}

export function courseIdOf(value: { courseId?: string }): string {
  return value.courseId ?? "lua"
}

export function courseView(snapshot: CourseSnapshot, courseId: string): CourseSnapshot {
  const chapters = snapshot.chapters.filter((chapter) => courseIdOf(chapter) === courseId)
  const lessonIds = new Set(chapters.flatMap((chapter) => chapter.lessonIds))
  const lessons = Object.fromEntries(
    Object.entries(snapshot.lessons).filter(([lessonId]) => lessonIds.has(lessonId)),
  )
  return { ...snapshot, chapters, lessons }
}

export function courseIdForLesson(snapshot: CourseSnapshot, lessonId: string): string {
  const lesson = snapshot.lessons[lessonId]
  if (lesson?.courseId) return lesson.courseId
  const chapter = snapshot.chapters.find((item) => item.lessonIds.includes(lessonId))
  return chapter?.courseId ?? "lua"
}

export function courseMetaForLesson(snapshot: CourseSnapshot, lessonId: string): CourseMeta {
  const courseId = courseIdForLesson(snapshot, lessonId)
  return (
    coursesOf(snapshot).find((course) => course.id === courseId) ?? {
      ...DEFAULT_LUA_COURSE_META,
      id: courseId,
    }
  )
}

export interface CourseMetaPatch {
  title?: string
  description?: string
  theme?: CourseTheme
  icon?: CourseIcon
  mode?: CourseMode
  settings?: Partial<CourseSettings>
}

export function writeCourseMetaPatch(
  root: string,
  courseId: string,
  patch: CourseMetaPatch,
): CourseMeta {
  const path = join(root, "courses", courseId, "course.json")
  if (!existsSync(path)) throw new Error("course_not_found")
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawCourseFile
  const current = normalizeMeta(raw, courseId)
  const next: CourseMeta = {
    ...current,
    ...(typeof patch.title === "string" ? { title: patch.title.trim() || current.title } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description } : {}),
    ...(patch.theme ? { theme: patch.theme } : {}),
    ...(patch.icon ? { icon: patch.icon } : {}),
    ...(patch.mode ? { mode: patch.mode } : {}),
    settings: { ...current.settings, ...(patch.settings ?? {}) },
  }
  const payload = {
    ...raw,
    id: courseId,
    title: next.title,
    description: next.description,
    theme: next.theme,
    icon: next.icon,
    mode: next.mode,
    settings: next.settings,
    builtIn: next.builtIn,
    createdAt: next.createdAt,
    format: raw.format ?? next.format ?? "legacy",
  }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  renameSync(tmp, path)
  return next
}
