import { spawnSync } from "node:child_process"
import { Router } from "express"
import type { AppContext } from "../context"
import { accessForCourse } from "../access-data"
import {
  COURSE_ICONS,
  COURSE_MODES,
  COURSE_THEMES,
  RUNTIME_KINDS,
} from "../content/defaults"
import {
  courseView,
  coursesOf,
  readMentorPrompt,
  writeCourseMetaPatch,
  writeMentorPrompt,
  type CourseMetaPatch,
} from "../content/courses"
import { publicQuiz } from "../content/serialize"
import type { CourseMeta, CourseMode, CourseSettings, CourseTheme, RuntimeKind } from "../content/types"
import {
  constructorPromptPath,
  readConstructorPrompt,
  writeConstructorPrompt,
} from "../courses/constructor-prompt"
import { DEFAULT_CONSTRUCTOR_PROMPT } from "../courses/prompts"
import { emitEvent } from "../events"

const PAGE_SIZE = 25

function summarize(context: AppContext, snapshot: ReturnType<AppContext["getCourse"]>, course: CourseMeta) {
  const view = courseView(snapshot, course.id)
  const access = accessForCourse(context.db, snapshot, course.id)
  const total = Object.keys(view.lessons).length
  const passed = Object.values(access.lessons).filter((status) => status === "passed").length
  return {
    passed,
    total,
    percent: total ? Math.round((passed / total) * 100) : 0,
    nextLessonId: access.nextLessonId,
    chapterCount: view.chapters.length,
  }
}

function courseErrors(snapshot: ReturnType<AppContext["getCourse"]>, courseId: string) {
  const view = courseView(snapshot, courseId)
  const lessonIds = new Set(Object.keys(view.lessons))
  const chapterIds = new Set(view.chapters.map((chapter) => chapter.id))
  return snapshot.errors.filter(
    (error) =>
      error.courseId === courseId ||
      (error.lessonId ? lessonIds.has(error.lessonId) : false) ||
      (error.chapterId ? chapterIds.has(error.chapterId) : false),
  )
}

function commandExists(value: string): boolean {
  const command = value.trim().split(/\s+/)[0]
  if (!command) return false
  try {
    const result = spawnSync("which", [command], { encoding: "utf8", timeout: 5000 })
    return result.status === 0
  } catch {
    return false
  }
}

function validatePatch(body: any): { patch: CourseMetaPatch } | { error: string } {
  const patch: CourseMetaPatch = {}
  if (body?.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) return { error: "invalid_title" }
    patch.title = body.title
  }
  if (body?.description !== undefined) {
    if (typeof body.description !== "string") return { error: "invalid_description" }
    patch.description = body.description
  }
  if (body?.theme !== undefined) {
    if (!COURSE_THEMES.includes(body.theme as CourseTheme)) return { error: "invalid_theme" }
    patch.theme = body.theme as CourseTheme
  }
  if (body?.icon !== undefined) {
    if (!COURSE_ICONS.includes(body.icon)) return { error: "invalid_icon" }
    patch.icon = body.icon
  }
  if (body?.mode !== undefined) {
    if (!COURSE_MODES.includes(body.mode as CourseMode)) return { error: "invalid_mode" }
    patch.mode = body.mode as CourseMode
  }
  if (body?.settings !== undefined) {
    if (!body.settings || typeof body.settings !== "object") return { error: "invalid_settings" }
    const settings: Partial<CourseSettings> = {}
    if (body.settings.runtime !== undefined) {
      if (!RUNTIME_KINDS.includes(body.settings.runtime as RuntimeKind)) return { error: "invalid_runtime" }
      settings.runtime = body.settings.runtime as RuntimeKind
    }
    for (const key of ["runCommand", "lspCommand", "fileExtension", "entry"] as const) {
      if (body.settings[key] !== undefined) {
        if (typeof body.settings[key] !== "string") return { error: "invalid_settings" }
        settings[key] = body.settings[key]
      }
    }
    if (body.settings.lspArgs !== undefined) {
      if (!Array.isArray(body.settings.lspArgs)) return { error: "invalid_settings" }
      settings.lspArgs = body.settings.lspArgs.map(String)
    }
    patch.settings = settings
  }
  return { patch }
}

export function createCoursesRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/courses", (req, res) => {
    const context = getContext()
    const snapshot = context.getCourse()
    const query = String(req.query.query ?? "").trim().toLocaleLowerCase("ru")
    const requested = Number(req.query.page ?? 1)
    const all = coursesOf(snapshot)
      .map((course) => ({ ...course, progress: summarize(context, snapshot, course) }))
      .filter((course) =>
        query
          ? `${course.title} ${course.description}`.toLocaleLowerCase("ru").includes(query)
          : true,
      )
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title, "ru"),
      )
    const total = all.length
    const pages = total ? Math.ceil(total / PAGE_SIZE) : 0
    const page = pages ? Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), pages) : 1
    const start = (page - 1) * PAGE_SIZE
    res.json({
      courses: all.slice(start, start + PAGE_SIZE),
      total,
      page,
      pageSize: PAGE_SIZE,
      pages,
    })
  })

  router.get("/courses/:id", (req, res) => {
    const context = getContext()
    const snapshot = context.getCourse()
    const course = coursesOf(snapshot).find((item) => item.id === req.params.id)
    if (!course) {
      res.status(404).json({ error: "course_not_found" })
      return
    }
    const view = courseView(snapshot, course.id)
    const access = accessForCourse(context.db, snapshot, course.id)
    res.json({
      course,
      progress: summarize(context, snapshot, course),
      chapters: view.chapters.map((chapter) => ({
        ...chapter,
        quiz: publicQuiz(chapter.quiz),
      })),
      lessons: Object.values(view.lessons).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        errors: lesson.errors,
      })),
      access,
      errors: courseErrors(snapshot, course.id),
      unassigned: course.id === "lua" ? snapshot.unassigned : [],
    })
  })

  router.get("/courses/:id/settings", (req, res) => {
    const course = coursesOf(getContext().getCourse()).find((item) => item.id === req.params.id)
    if (!course) {
      res.status(404).json({ error: "course_not_found" })
      return
    }
    res.json({ course })
  })

  router.put("/courses/:id/settings", (req, res) => {
    const context = getContext()
    const snapshot = context.getCourse()
    const course = coursesOf(snapshot).find((item) => item.id === req.params.id)
    if (!course) {
      res.status(404).json({ error: "course_not_found" })
      return
    }
    const validated = validatePatch(req.body ?? {})
    if ("error" in validated) {
      res.status(400).json({ error: validated.error })
      return
    }
    try {
      const updated = writeCourseMetaPatch(
        context.root ?? process.cwd(),
        course.id,
        validated.patch,
      )
      context.refreshCourse?.()
      emitEvent("course:changed", { courseId: course.id })
      res.json({ course: updated })
    } catch (error) {
      if (error instanceof Error && error.message === "course_not_found") {
        res.status(404).json({ error: "course_not_found" })
        return
      }
      throw error
    }
  })

  router.get("/courses/:id/mentor-prompt", (req, res) => {
    const context = getContext()
    const course = coursesOf(context.getCourse()).find((item) => item.id === req.params.id)
    if (!course) {
      res.status(404).json({ error: "course_not_found" })
      return
    }
    const root = context.root ?? process.cwd()
    res.json({
      prompt: readMentorPrompt(root, course.id),
      path: `${root}/courses/${course.id}/mentor.md`,
    })
  })

  router.put("/courses/:id/mentor-prompt", (req, res) => {
    const context = getContext()
    const course = coursesOf(context.getCourse()).find((item) => item.id === req.params.id)
    if (!course) {
      res.status(404).json({ error: "course_not_found" })
      return
    }
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : ""
    if (!prompt) {
      res.status(400).json({ error: "prompt_empty" })
      return
    }
    writeMentorPrompt(context.root ?? process.cwd(), course.id, prompt)
    res.json({ prompt })
  })

  router.get("/constructor-prompt", (_req, res) => {
    const root = getContext().root ?? process.cwd()
    res.json({
      prompt: readConstructorPrompt(root),
      path: constructorPromptPath(root),
      defaultPrompt: DEFAULT_CONSTRUCTOR_PROMPT,
    })
  })

  router.put("/constructor-prompt", (req, res) => {
    const root = getContext().root ?? process.cwd()
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : ""
    if (!prompt) {
      res.status(400).json({ error: "prompt_empty" })
      return
    }
    writeConstructorPrompt(root, prompt)
    res.json({ prompt })
  })

  router.get("/courses/:id/checks", (req, res) => {
    const context = getContext()
    const snapshot = context.getCourse()
    const course = coursesOf(snapshot).find((item) => item.id === req.params.id)
    if (!course) {
      res.status(404).json({ error: "course_not_found" })
      return
    }
    const errors = courseErrors(snapshot, course.id)
    const runtimeRequired = course.settings.runtime !== "none"
    const lspRequired = Boolean(course.settings.lspCommand.trim())
    const checks = [
      {
        id: "materials",
        label: "Материалы курса",
        status: errors.length ? "warn" : "ok",
        detail: errors.length ? `замечаний: ${errors.length}` : "ошибок нет",
      },
      {
        id: "runtime",
        label: "Среда запуска",
        status: !runtimeRequired ? "ok" : commandExists(course.settings.runCommand) ? "ok" : "fail",
        detail: !runtimeRequired
          ? "запуск кода не требуется"
          : course.settings.runCommand || "команда не задана",
        hint: !runtimeRequired || commandExists(course.settings.runCommand)
          ? undefined
          : `Не найдена команда ${course.settings.runCommand.split(/\s+/)[0]}.`,
      },
      {
        id: "lsp",
        label: "Language server",
        status: !lspRequired ? "ok" : commandExists(course.settings.lspCommand) ? "ok" : "fail",
        detail: !lspRequired ? "LSP не требуется" : course.settings.lspCommand,
        hint: !lspRequired || commandExists(course.settings.lspCommand)
          ? undefined
          : `Не найдена команда ${course.settings.lspCommand.split(/\s+/)[0]}.`,
      },
      {
        id: "mentor-prompt",
        label: "Промпт наставника",
        status: readMentorPrompt(context.root ?? process.cwd(), course.id).trim() ? "ok" : "warn",
        detail: `${readMentorPrompt(context.root ?? process.cwd(), course.id).length} символов`,
      },
    ]
    res.json({ checks })
  })

  return router
}
