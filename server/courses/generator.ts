import { randomBytes } from "node:crypto"
import type { AppContext } from "../context"
import {
  deleteAttachments,
  keepCourseAttachments,
} from "../attachments/store"
import type { ModelAttachment } from "../attachments/types"
import { DEFAULT_COURSE_SETTINGS } from "../content/defaults"
import { parseQuiz } from "../content/quiz"
import {
  writeGeneratedCourse,
  writeMentorPrompt,
  type GeneratedCourse,
} from "../content/courses"
import type {
  Chapter,
  CourseMeta,
  CourseMode,
  CourseSettings,
  LessonContent,
  RuntimeKind,
  TaskContent,
} from "../content/types"
import { emitEvent } from "../events"
import { generateWithAgent, type GenerateWithAgentInput } from "../mentor/client"
import { readConstructorPrompt } from "./constructor-prompt"
import { extractJson } from "./json"
import { CourseJobStore, type CourseJob } from "./jobs"
import { clarifyPrompt, lessonPrompt, outlinePrompt } from "./prompts"
import { RUNTIME_PRESETS, settingsForRuntime } from "./runtimes"
import {
  clarifySchema,
  generatedLessonSchema,
  outlineSchema,
  VOLUME_LIMITS,
  type ClarifyQuestion,
  type CourseMaterials,
  type GenerateCourseInput,
  type Outline,
  type ParsedLesson,
} from "./schema"

type Generate = (input: GenerateWithAgentInput) => Promise<string>

export interface CourseGenerator {
  clarify(topic: string, materials?: CourseMaterials): Promise<ClarifyQuestion[]>
  start(input: GenerateCourseInput): string
  getJob(id: string): CourseJob | undefined
  cancelJob(id: string): boolean
}

export interface CourseGeneratorOptions {
  getContext: () => AppContext
  generate?: Generate
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function totalLessons(outline: Outline): number {
  return outline.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0)
}

function runtimeFor(outline: Outline): RuntimeKind {
  if (outline.mode !== "programming") return "none"
  const runtime = outline.runtime
  if (runtime && runtime !== "none" && runtime !== "custom" && RUNTIME_PRESETS[runtime]) {
    return runtime
  }
  return "lua"
}

function normalizeMode(mode: CourseMode): CourseMode {
  return mode === "math" || mode === "programming" ? mode : "general"
}

function parseLesson(value: unknown, mode: CourseMode): ParsedLesson {
  const lesson = generatedLessonSchema.parse(value)
  const parsedQuiz = parseQuiz(lesson.quiz)
  if (!parsedQuiz.quiz) {
    throw new Error(`quiz: ${parsedQuiz.errors.map((error) => error.message).join("; ")}`)
  }
  if (mode === "general") {
    if (lesson.tasks.length > 0) throw new Error("general lesson must not contain code tasks")
    return { ...lesson, quiz: parsedQuiz.quiz, tasks: [] }
  }
  if (lesson.tasks.length !== 1) {
    throw new Error(`${mode} lesson must contain exactly one practice task`)
  }
  const task = lesson.tasks[0]
  if (mode === "math") {
    if (task.kind !== "steps") throw new Error("math lesson task must be kind=steps")
    if (task.files.length === 0) throw new Error("math task must include a solution.json starter")
  }
  if (mode === "programming") {
    if (task.kind !== "code") throw new Error("programming lesson task must be kind=code")
    if (task.files.length === 0) throw new Error("programming task must include starter files")
    const entry = task.entry || task.files[0]?.name
    if (!entry || !task.files.some((file) => file.name === entry)) {
      throw new Error("programming task entry must exist in files")
    }
  }
  return { ...lesson, quiz: parsedQuiz.quiz }
}

function buildLesson(
  courseId: string,
  lessonId: string,
  fallbackTitle: string,
  mode: CourseMode,
  settings: CourseSettings,
  parsed: ParsedLesson,
): LessonContent {
  const tasks: TaskContent[] = parsed.tasks.map((task, index) => {
    const files =
      task.files.length > 0
        ? task.files
        : mode === "math"
          ? [{ name: "solution.json", content: '{\n  "steps": [],\n  "answer": ""\n}' }]
          : []
    const entry = task.entry || files[0]?.name || settings.entry
    return {
      id: `${lessonId}-task-${index + 1}`,
      title: task.title,
      prompt: task.prompt,
      kind: task.kind,
      entry,
      files,
      args: task.args,
      stdin: task.stdin,
      timeoutMs: task.timeoutMs,
      ...(task.criteria.length ? { criteria: task.criteria } : {}),
    }
  })

  return {
    id: lessonId,
    courseId,
    title: parsed.title || fallbackTitle,
    theoryMarkdown: parsed.theoryMarkdown,
    practiceIntro: parsed.practiceIntro,
    tasks,
    quiz: parsed.quiz,
    errors: [],
  }
}

export function createCourseGenerator(options: CourseGeneratorOptions): CourseGenerator {
  const generate = options.generate ?? generateWithAgent
  const jobs = new CourseJobStore()

  async function callJson<T>(
    system: string,
    prompt: string,
    parse: (value: unknown) => T,
    attachments?: ModelAttachment[],
  ): Promise<T> {
    let lastError: unknown = new Error("mentor_invalid_json")
    let nextPrompt = prompt
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await generate({
        agent: "course-constructor",
        system,
        prompt: nextPrompt,
        timeoutMs: 300_000,
        ...(attachments?.length ? { attachments } : {}),
      })
      try {
        return parse(extractJson(raw))
      } catch (error) {
        lastError = error
        nextPrompt = `${prompt}\n\nПредыдущий ответ не прошёл проверку: ${errorMessage(error)}. Верни только валидный JSON по схеме, без Markdown и лишних комментариев.`
      }
    }
    throw new Error(`mentor_invalid_json: ${errorMessage(lastError)}`)
  }

  async function buildMaterialsText(input: GenerateCourseInput, system: string): Promise<string> {
    const text = input.materials?.text?.trim() ?? ""
    const images = input.materials?.images ?? []
    if (images.length === 0) return text
    const descriptions = await generate({
      agent: "course-constructor",
      system,
      prompt: `Пользователь приложил изображения к теме "${input.topic}".
Опиши каждое изображение подробно и по-русски: текст, подписи, схемы, формулы,
графики и всё, что важно для будущего курса. Не придумывай того, чего не видно.
Верни связный текст без JSON.`,
      timeoutMs: 180_000,
      attachments: images,
    })
    return [text, `Описания изображений:\n${descriptions.trim()}`]
      .filter(Boolean)
      .join("\n\n")
  }

  async function runJob(job: CourseJob, input: GenerateCourseInput): Promise<void> {
    const context = options.getContext()
    const root = context.root ?? process.cwd()
    const system = readConstructorPrompt(root)
    const materialsText = await buildMaterialsText(input, system)
    if (jobs.get(job.id)?.cancelRequested) {
      jobs.update(job.id, { status: "cancelled", phase: "Сборка отменена" })
      return
    }

    jobs.update(job.id, { status: "outline", phase: "Собираем план" })
    const outline = await callJson(system, outlinePrompt({ ...input, materialsText }), (value) => {
      const parsed = outlineSchema.parse(value)
      const total = totalLessons(parsed)
      const limits = VOLUME_LIMITS[input.volume]
      if (total < limits.min || total > limits.max) {
        throw new Error(`объём: ${total} уроков вместо ${limits.min}–${limits.max}`)
      }
      return parsed
    })

    const mode = normalizeMode(outline.mode)
    const runtime = runtimeFor(outline)
    const settings = mode === "programming" ? settingsForRuntime(runtime) : { ...DEFAULT_COURSE_SETTINGS }
    const total = totalLessons(outline)
    if (jobs.get(job.id)?.cancelRequested) {
      jobs.update(job.id, { status: "cancelled", phase: "Сборка отменена" })
      return
    }
    const courseId = `course-${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`
    const createdAt = new Date().toISOString()

    jobs.update(job.id, {
      status: "lessons",
      phase: "Пишем уроки",
      title: outline.title,
      total,
      completed: 0,
      courseId,
      lessonTitles: outline.chapters.flatMap((chapter) => chapter.lessons),
    })

    const chapters: Chapter[] = outline.chapters.map((chapter, index) => ({
      id: `${courseId}-c${index + 1}`,
      courseId,
      title: chapter.title,
      description: chapter.description ?? "",
      lessonIds: [],
      quiz: null,
      errors: [],
    }))
    const lessons: Record<string, LessonContent> = {}

    let completed = 0
    for (const [chapterIndex, chapter] of outline.chapters.entries()) {
      for (const [lessonIndex, lessonTitle] of chapter.lessons.entries()) {
        if (jobs.get(job.id)?.cancelRequested) {
          jobs.update(job.id, { status: "cancelled", phase: "Сборка отменена" })
          return
        }
        const lessonId = `${courseId}-l${chapterIndex + 1}-${lessonIndex + 1}`
        const prompt = lessonPrompt({
          topic: input.topic,
          outline,
          chapterTitle: chapter.title,
          chapterDescription: chapter.description ?? "",
          lessonTitle,
          mode,
          settings,
          mentorPrompt: outline.mentorPrompt,
          index: completed + 1,
          total,
          materialsText,
        })
        const parsed = await callJson(system, prompt, (value) => parseLesson(value, mode))
        const lesson = buildLesson(courseId, lessonId, lessonTitle, mode, settings, parsed)
        lessons[lessonId] = lesson
        chapters[chapterIndex].lessonIds.push(lessonId)
        completed += 1
        jobs.update(job.id, {
          completed,
          phase: `Урок ${completed} из ${total}`,
        })
      }
    }

    if (jobs.get(job.id)?.cancelRequested) {
      jobs.update(job.id, { status: "cancelled", phase: "Сборка отменена" })
      return
    }

    const meta: CourseMeta = {
      format: "generated",
      id: courseId,
      title: outline.title,
      description: outline.description,
      theme: outline.theme,
      icon: outline.icon,
      mode,
      settings,
      builtIn: false,
      createdAt,
    }
    const course: GeneratedCourse = { ...meta, chapters, lessons }

    jobs.update(job.id, { status: "saving", phase: "Сохраняем курс" })
    writeGeneratedCourse(root, course)
    writeMentorPrompt(root, courseId, outline.mentorPrompt)
    const attachmentIds = input.materials?.attachments.map((attachment) => attachment.id) ?? []
    if (attachmentIds.length > 0) {
      try {
        if (input.materials?.keep) {
          keepCourseAttachments(root, courseId, attachmentIds)
        } else {
          deleteAttachments(root, attachmentIds)
        }
      } catch (error) {
        console.error("[attachments] не удалось сохранить или удалить материалы курса", error)
      }
    }
    const snapshot = context.refreshCourse?.()
    emitEvent("course:changed", {
      version: snapshot?.version ?? null,
      courseId,
    })
    jobs.update(job.id, { status: "done", phase: "Курс готов", courseId })
  }

  return {
    async clarify(topic, materials) {
      const context = options.getContext()
      const root = context.root ?? process.cwd()
      const parsed = await callJson(
        readConstructorPrompt(root),
        clarifyPrompt(topic, materials?.text),
        (value) => clarifySchema.parse(value),
        materials?.images,
      )
      return parsed.questions
    },

    start(input) {
      const job = jobs.create()
      void runJob(job, input).catch((error) => {
        const current = jobs.get(job.id)
        if (current?.status === "cancelled") return
        jobs.update(job.id, {
          status: "error",
          phase: "Ошибка сборки",
          error: errorMessage(error),
        })
      })
      return job.id
    },

    getJob(id) {
      return jobs.get(id)
    },

    cancelJob(id) {
      return jobs.cancel(id)
    },
  }
}
