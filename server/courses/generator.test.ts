import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { AppContext } from "../context"
import { scanProject } from "../content/courses"
import type { GenerateWithAgentInput } from "../mentor/client"
import { createCourseGenerator } from "./generator"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-builder-"))
  mkdirSync(join(dir, "courses"), { recursive: true })
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function contextFor(): AppContext {
  let snapshot = scanProject(dir)
  return {
    db: {} as AppContext["db"],
    root: dir,
    progressPath: join(dir, "PROGRESS.md"),
    getCourse: () => snapshot,
    refreshCourse: () => {
      snapshot = scanProject(dir)
      return snapshot
    },
  }
}

const clarifyJson = JSON.stringify({
  questions: [
    {
      id: "goal",
      prompt: "Что вам важнее всего?",
      type: "multiple",
      options: ["Понять основы", "Решать задачи"],
    },
    {
      id: "level",
      prompt: "Какой у вас уровень?",
      type: "single",
      options: ["С нуля", "Что-то знаю"],
    },
  ],
})

const outlineJson = JSON.stringify({
  title: "Экономика для жизни",
  description: "Понимать инфляцию, спрос и свои решения.",
  theme: "amber",
  icon: "chart",
  mode: "general",
  runtime: "none",
  mentorPrompt:
    "Ты наставник только этого курса по экономике. Объясняй, задавай вопросы, проверяй ход рассуждения и не давай готовых ответов.",
  chapters: [
    {
      title: "Деньги",
      description: "Первая глава.",
      lessons: ["Инфляция", "Спрос"],
    },
  ],
})

function lessonJson(): string {
  return JSON.stringify({
    title: "Инфляция",
    theoryMarkdown:
      "Инфляция — это устойчивый рост общего уровня цен. ".repeat(20),
    practiceIntro: "",
    quiz: {
      title: "Проверка",
      questions: [
        { id: "q1", type: "single", prompt: "Что растёт?", options: ["Цены", "Налоги"], correct: 0, explanation: "Цены" },
        { id: "q2", type: "single", prompt: "Что падает?", options: ["Покупательная способность", "Спрос"], correct: 0, explanation: "Способность" },
        { id: "q3", type: "text", prompt: "Объясните причину.", referenceAnswer: "Спрос и предложение", criteria: ["причина"] },
        { id: "q4", type: "text", prompt: "Приведите пример.", referenceAnswer: "Пример", criteria: ["пример"] },
      ],
    },
    tasks: [],
  })
}

function fakeGenerate(input: GenerateWithAgentInput): Promise<string> {
  if (input.prompt.includes("уточняющих вопроса")) return Promise.resolve(clarifyJson)
  if (input.prompt.includes("Собери карточку")) return Promise.resolve(outlineJson)
  return Promise.resolve(lessonJson())
}

async function waitForJob(generator: ReturnType<typeof createCourseGenerator>, jobId: string) {
  for (let index = 0; index < 100; index += 1) {
    const job = generator.getJob(jobId)
    if (job && ["done", "error", "cancelled"].includes(job.status)) return job
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return generator.getJob(jobId)
}

describe("course generator", () => {
  it("clarifies a topic with AI questions", async () => {
    const generator = createCourseGenerator({ getContext: contextFor, generate: fakeGenerate })
    const questions = await generator.clarify("экономика")
    expect(questions.map((question) => question.id)).toEqual(["goal", "level"])
    expect(questions[0].options).toContain("Решать задачи")
  })

  it("builds and saves a general course", async () => {
    const generator = createCourseGenerator({ getContext: contextFor, generate: fakeGenerate })
    const jobId = generator.start({
      topic: "экономика для жизни",
      answers: [{ question: "Что важнее?", answer: "Понять основы" }],
      volume: "short",
    })
    const job = await waitForJob(generator, jobId)
    expect(job?.status).toBe("done")
    expect(job?.completed).toBe(2)
    expect(job?.total).toBe(2)
    expect(job?.courseId).toMatch(/^course-/)
    expect(existsSync(join(dir, "courses", String(job?.courseId), "course.json"))).toBe(true)
    expect(readFileSync(join(dir, "courses", String(job?.courseId), "mentor.md"), "utf8")).toContain(
      "только этого курса",
    )

    const snapshot = scanProject(dir)
    expect(snapshot.courses).toHaveLength(1)
    const course = snapshot.courses?.[0]
    expect(course).toMatchObject({
      title: "Экономика для жизни",
      theme: "amber",
      icon: "chart",
      mode: "general",
      format: "generated",
    })
    expect(snapshot.chapters[0].lessonIds).toHaveLength(2)
    const lesson = snapshot.lessons[snapshot.chapters[0].lessonIds[0]]
    expect(lesson.courseId).toBe(course?.id)
    expect(lesson.quiz?.questions).toHaveLength(4)
    expect(lesson.tasks).toEqual([])
  })

  it("fails without saving when the outline is invalid twice", async () => {
    const invalid = async (input: GenerateWithAgentInput) => {
      if (input.prompt.includes("Собери карточку")) return "не json"
      return lessonJson()
    }
    const generator = createCourseGenerator({ getContext: contextFor, generate: invalid })
    const jobId = generator.start({
      topic: "экономика",
      answers: [],
      volume: "short",
    })
    const job = await waitForJob(generator, jobId)
    expect(job?.status).toBe("error")
    expect(scanProject(dir).courses).toEqual([])
  })

  it("cancels a running job without saving", async () => {
    const slow = async (input: GenerateWithAgentInput) => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      return fakeGenerate(input)
    }
    const generator = createCourseGenerator({ getContext: contextFor, generate: slow })
    const jobId = generator.start({
      topic: "экономика",
      answers: [],
      volume: "short",
    })
    expect(generator.cancelJob(jobId)).toBe(true)
    const job = await waitForJob(generator, jobId)
    expect(job?.status).toBe("cancelled")
    expect(scanProject(dir).courses).toEqual([])
  })
})
