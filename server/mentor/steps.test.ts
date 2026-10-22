import { describe, expect, it, vi } from "vitest"
import { createMentorService } from "./service"

const reviewJson = JSON.stringify({
  grade: 4,
  verdict: "pass",
  summary: "Ход верный",
  strengths: [],
  issues: [],
  nextStep: "",
  tasks: [],
  quiz: [],
})

describe("mentor steps formatting", () => {
  it("shows each step, criteria and the final answer instead of raw code", async () => {
    let capturedPrompt = ""
    let capturedSystem: string | undefined
    const generate = vi.fn(async (_sessionId: string, prompt: string, system?: string) => {
      capturedPrompt = prompt
      capturedSystem = system
      return reviewJson
    })
    const service = createMentorService({
      mock: false,
      generate,
      createSession: async () => "session",
      deleteSession: async () => {},
    })

    await service.reviewLesson("session", {
      lessonId: "math-1",
      lessonTitle: "Интеграл",
      chapterTitle: "Интегрирование",
      tasks: [
        {
          taskId: "math-1-task-1",
          title: "Вычислить интеграл",
          prompt: "Найдите интеграл по шагам.",
          kind: "steps",
          criteria: ["верный первообразный", "объяснён каждый переход"],
          files: [
            {
              name: "solution.json",
              content: JSON.stringify({
                steps: [
                  {
                    formula: "\\int_0^1 x\\,dx = \\frac{x^2}{2}\\Big|_0^1",
                    explanation: "Находим первообразную и подставляем пределы.",
                  },
                  {
                    formula: "\\frac{1}{2} - 0 = \\frac{1}{2}",
                    explanation: "Считаем разность.",
                  },
                ],
                answer: "1/2",
              }),
            },
          ],
        },
      ],
      quiz: [],
      mentorPrompt: "Проверяй математику по шагам.",
    })

    const prompt = capturedPrompt
    expect(prompt).toContain("Решение по шагам")
    expect(prompt).toContain("Шаг 1")
    expect(prompt).toContain("Шаг 2")
    expect(prompt).toContain("первообразную")
    expect(prompt).toContain("Критерии")
    expect(prompt).toContain("Финальный ответ: 1/2")
    expect(prompt).not.toContain("Код ученика")
    expect(capturedSystem).toBe("Проверяй математику по шагам.")
  })
})
