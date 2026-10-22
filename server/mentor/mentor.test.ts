import { describe, expect, it, vi } from "vitest"
import { containsReadyCode, stripReadyCode } from "./guard"
import { createMentorService } from "./service"
import type { MentorReviewRequest } from "./types"

const request: MentorReviewRequest = {
  lessonId: "02-variables-types",
  lessonTitle: "Переменные и типы",
  chapterTitle: "Основы",
  theory: "## Теория",
  tasks: [
    {
      taskId: "task1_types",
      title: "Типы",
      prompt: "Напечатай типы",
      kind: "code",
      files: [{ name: "task1_types.lua", content: 'print(type(42))' }],
      lastRun: { stdout: "number\n", stderr: "", exitCode: 0 },
    },
  ],
  quiz: [
    {
      id: "q1",
      type: "single",
      prompt: "Что вернёт type(42)?",
      options: ["number", "string"],
      correct: 0,
      answer: 0,
    },
    {
      id: "q2",
      type: "text",
      prompt: "Зачем local?",
      referenceAnswer: "область видимости",
      criteria: ["область"],
      answer: "чтобы не засорять глобалы",
    },
  ],
}

const validReview = {
  grade: 4,
  verdict: "pass" as const,
  summary: "Хорошо",
  strengths: ["Типы"],
  issues: ["Граничные случаи"],
  nextStep: "Дальше",
  tasks: [{ taskId: "task1_types", status: "ok" as const, comment: "Верно" }],
  quiz: [
    { questionId: "q1", correct: true, comment: "Верно" },
    { questionId: "q2", correct: true, comment: "По сути верно" },
  ],
}

describe("mentor service", () => {
  it("parses a valid review", async () => {
    const generate = vi.fn(async () => JSON.stringify(validReview))
    const service = createMentorService({
      generate,
      createSession: async () => "session",
      deleteSession: async () => {},
    })
    const result = await service.reviewLesson("session", request)
    expect(result.grade).toBe(4)
    expect(result.verdict).toBe("pass")
    expect(generate).toHaveBeenCalledOnce()
  })

  it("sends selected option text, not a raw index, to the mentor", async () => {
    const generate = vi.fn(async (_session: string, prompt: string) => {
      expect(prompt).toContain('ответ ученика: "number"')
      expect(prompt).toContain('ответ ученика: "чтобы не засорять глобалы"')
      return JSON.stringify(validReview)
    })
    const service = createMentorService({
      generate,
      createSession: async () => "session",
      deleteSession: async () => {},
    })
    await service.reviewLesson("session", request)
    expect(generate).toHaveBeenCalledOnce()
  })

  it("retries invalid json once", async () => {
    const generate = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("не json")
      .mockResolvedValueOnce(JSON.stringify(validReview))
    const service = createMentorService({
      generate,
      createSession: async () => "session",
      deleteSession: async () => {},
    })
    const result = await service.reviewLesson("session", request)
    expect(result.grade).toBe(4)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it("fails without unlock after two invalid answers", async () => {
    const service = createMentorService({
      generate: async () => "не json",
      createSession: async () => "session",
      deleteSession: async () => {},
    })
    await expect(service.reviewLesson("session", request)).rejects.toThrow("mentor_invalid_json")
  })

  it("sanitizes ready code from a valid review", async () => {
    const withCode = {
      ...validReview,
      summary: "Вот решение:\n```lua\nlocal function f() return 1 end\nlocal function g() return 2 end\nlocal function h() return 3 end\n```\nПодумай.",
    }
    const service = createMentorService({
      generate: async () => JSON.stringify(withCode),
      createSession: async () => "session",
      deleteSession: async () => {},
    })
    const result = await service.reviewLesson("session", request)
    expect(result.summary).toContain("[фрагмент скрыт")
    expect(result.summary).not.toContain("local function f")
  })

  it("mock mode returns a full summary", async () => {
    const service = createMentorService({ mock: true })
    const summary = await service.summarizeSession("mock", {
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      chapters: [{ title: "Основы", passed: 1, total: 3 }],
      lessons: [{ title: "Hello", grade: 5, status: "passed" }],
      percent: 33,
    })
    for (const heading of ["Общая оценка", "Что прошёл", "Процент от задуманного", "Сильные стороны", "Слабые стороны", "Напутствие", "Рекомендации"]) {
      expect(summary).toContain(heading)
    }
  })
})

describe("mentor guard", () => {
  it("detects long blocks and short function solutions", () => {
    expect(containsReadyCode("```lua\nlocal x = 1\n```")).toBe(false)
    expect(containsReadyCode("```lua\nlocal function f() return 1 end\nlocal function g() return 2 end\n```")).toBe(true)
    expect(containsReadyCode("```lua\nlocal x = 1\nlocal y = 2\nlocal z = 3\n```")).toBe(true)
    expect(containsReadyCode("Инлайн `type(42)` разрешён.")).toBe(false)
  })

  it("strips ready blocks but keeps inline code", () => {
    const text =
      "```lua\nlocal function f() return 1 end\nlocal function g() return 2 end\n```\nНо `type(42)` — это number."
    const result = stripReadyCode(text)
    expect(result).toContain("[фрагмент скрыт")
    expect(result).toContain("`type(42)`")
  })
})
