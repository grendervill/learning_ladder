import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CourseWizard } from "./CourseWizard"
import { renderWithProviders } from "../../test/render"

const questions = [
  { id: "goal", prompt: "Что важно?", type: "multiple" as const, options: ["Основы", "Практика"] },
  { id: "level", prompt: "Какой уровень?", type: "single" as const, options: ["С нуля", "Уверенно"] },
]

const job = {
  id: "job-1",
  status: "done",
  phase: "Курс готов",
  completed: 2,
  total: 2,
  title: "Личные финансы с нуля",
  courseId: "course-1",
  lessonTitles: ["Бюджет", "Инфляция"],
  error: null,
  cancelRequested: false,
  createdAt: "2026-10-22T10:00:00.000Z",
}

function json(value: unknown) {
  return { ok: true, json: async () => value }
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input)
      if (url === "/api/attachments") return json({ attachments: [{ id: "attachment-1", name: "notes.txt", mime: "text/plain", size: 12, kind: "text", createdAt: "2026-10-24T10:00:00.000Z" }] })
      if (url === "/api/courses/clarify") return json({ questions })
      if (url === "/api/courses/generate") return json({ jobId: "job-1" })
      if (url === "/api/courses/jobs/job-1") return json(job)
      return json({})
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("CourseWizard", () => {
  it("walks from topic through clarification to a generated course", async () => {
    const onClose = vi.fn()
    renderWithProviders(<CourseWizard open onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText(/Например/), {
      target: { value: "личные финансы" },
    })
    fireEvent.change(screen.getByLabelText("Выбрать файлы"), {
      target: { files: [new File(["Hello notes"], "notes.txt", { type: "text/plain" })] },
    })
    expect(await screen.findByText("notes.txt")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: /Сохранить исходники/ }))
    fireEvent.click(screen.getByRole("button", { name: /Продолжить/ }))
    expect(await screen.findByText("Что важно?")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Основы"))
    fireEvent.click(screen.getByLabelText("С нуля"))
    fireEvent.click(screen.getByRole("button", { name: /Короткий/ }))
    fireEvent.click(screen.getByRole("button", { name: /Собрать курс/ }))

    expect(await screen.findByText("Личные финансы с нуля")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Открыть курс/ })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const generate = calls.find((call) => String(call[0]) === "/api/courses/generate")
    expect(JSON.parse(String(generate?.[1]?.body))).toMatchObject({
      topic: "личные финансы",
      volume: "short",
      attachmentIds: ["attachment-1"],
      keepAttachments: true,
      answers: [
        { question: "Что важно?", answer: "Основы" },
        { question: "Какой уровень?", answer: "С нуля" },
      ],
    })
  })

  it("deletes unsent attachments when the wizard closes", async () => {
    const onClose = vi.fn()
    renderWithProviders(<CourseWizard open onClose={onClose} />)
    fireEvent.change(screen.getByLabelText("Выбрать файлы"), {
      target: { files: [new File(["Hello notes"], "notes.txt", { type: "text/plain" })] },
    })
    expect(await screen.findByText("notes.txt")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Закрыть мастер" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(
      "/api/attachments/attachment-1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
