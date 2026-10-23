import { describe, expect, it, vi } from "vitest"
import type { AppContext } from "../context"
import { acquireMentorSession } from "../sessions/lifecycle"
import { createMentorService, type MentorGenerate, type MentorService } from "./service"

const reviewJson = JSON.stringify({
  grade: 4,
  verdict: "pass",
  summary: "Хорошо",
  strengths: [],
  issues: [],
  nextStep: "",
  tasks: [],
  quiz: [],
})

function serviceWith(generate: MentorGenerate) {
  return createMentorService({
    mock: false,
    generate,
    createSession: async () => "session",
    deleteSession: async () => {},
  })
}

describe("mentor scoping", () => {
  it("passes only the current course prompt into a lesson review", async () => {
    const generate = vi.fn(async () => reviewJson)
    const service = serviceWith(generate)
    await service.reviewLesson("session", {
      lessonId: "econ-1",
      lessonTitle: "Инфляция",
      chapterTitle: "Деньги",
      tasks: [],
      quiz: [],
      mentorPrompt: "Правила только для экономики.",
    })
    expect(generate).toHaveBeenCalledWith(
      "session",
      expect.stringContaining("Проверь урок"),
      "Правила только для экономики.",
    )
  })

  it("passes the course prompt into free-form mentor questions", async () => {
    const generate = vi.fn(async () => "Наводящий вопрос")
    const service = serviceWith(generate)
    const answer = await service.askMentor(
      "session",
      {
        lessonId: "lua-1",
        lessonTitle: "Первый запуск",
        mentorPrompt: "Правила только для Lua.",
      },
      "Почему print?",
    )
    expect(answer).toBe("Наводящий вопрос")
    expect(generate).toHaveBeenCalledWith(
      "session",
      expect.stringContaining("Почему print?"),
      "Правила только для Lua.",
    )
  })

  it("creates and deletes a fresh mentor session for every acquisition", async () => {
    let created = 0
    const createSession = vi.fn(async () => `session-${++created}`)
    const deleteSession = vi.fn(async () => {})
    const mentor = { createSession, deleteSession } as unknown as MentorService
    const context = {} as AppContext

    const first = await acquireMentorSession(context, mentor)
    const second = await acquireMentorSession(context, mentor)
    await first.release()
    await second.release()

    expect(createSession).toHaveBeenCalledTimes(2)
    expect(deleteSession).toHaveBeenCalledTimes(2)
    expect(first.sessionId).not.toBe(second.sessionId)
  })
})
