import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { EditorView } from "@codemirror/view"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PracticeTab } from "./PracticeTab"
import { renderWithProviders } from "../../test/render"

const lesson = {
  id: "02-variables-types",
  title: "Переменные и типы",
  theoryMarkdown: "",
  practiceIntro: "1. `task1_types.lua` — угадай типы.",
  tasks: [
    {
      id: "task1_types",
      title: "Угадай тип",
      prompt: "Посмотри на значения и вызови type.",
      kind: "code",
      entry: "task1_types.lua",
      files: [{ name: "task1_types.lua", content: "local values = {}" }],
      args: [],
      stdin: "",
      timeoutMs: 3000,
    },
  ],
  quiz: null,
  errors: [],
  answers: {},
  access: "available",
  chapterId: "foundations",
  chapterTitle: "Основы",
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/files")) {
        if (init?.method === "PUT") {
          return { ok: true, json: async () => ({ files: lesson.tasks[0].files }) }
        }
        return {
          ok: true,
          json: async () => ({
            files: lesson.tasks[0].files,
            starterFiles: lesson.tasks[0].files,
            kind: "code",
          }),
        }
      }
      return { ok: true, json: async () => lesson }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("PracticeTab", () => {
  it("shows file tabs, mounts CodeMirror and saves edits", async () => {
    renderWithProviders(<PracticeTab lessonId="02-variables-types" />)

    expect(await screen.findByRole("tab", { name: "task1_types.lua" })).toBeInTheDocument()
    expect(document.querySelector(".cm-editor")).toBeInTheDocument()

    await waitFor(() => expect(document.querySelector(".cm-content")).toBeInTheDocument())
    const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)
    expect(view).not.toBeNull()
    view!.dispatch({
      changes: { from: 0, to: view!.state.doc.length, insert: 'print("edited")' },
    })

    await waitFor(
      () =>
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/files"),
          expect.objectContaining({ method: "PUT" }),
        ),
      { timeout: 2500 },
    )
  })

  it("shows the steps editor for math tasks and autosaves the solution JSON", async () => {
    const stepsLesson = {
      ...lesson,
      id: "math-1",
      title: "Интеграл",
      tasks: [
        {
          id: "math-1-task-1",
          title: "Площадь под параболой",
          prompt: "Решите по шагам.",
          kind: "steps",
          entry: "solution.json",
          files: [{ name: "solution.json", content: '{"steps":[],"answer":""}' }],
          args: [],
          stdin: "",
          timeoutMs: 3000,
          criteria: ["верный ход"],
        },
      ],
    }
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        if (String(url).includes("/files")) {
          if (init?.method === "PUT") {
            return { ok: true, json: async () => ({ files: stepsLesson.tasks[0].files }) }
          }
          return {
            ok: true,
            json: async () => ({
              files: stepsLesson.tasks[0].files,
              starterFiles: stepsLesson.tasks[0].files,
              kind: "steps",
            }),
          }
        }
        return { ok: true, json: async () => stepsLesson }
      },
    )

    renderWithProviders(<PracticeTab lessonId="math-1" />)

    expect(await screen.findByText("Покажи ход решения")).toBeInTheDocument()
    expect(document.querySelector(".cm-editor")).toBeNull()
    const formula = await screen.findByLabelText("Формула шага 1")
    fireEvent.change(formula, {
      target: { value: "\\int_0^1 x^2\\,dx" },
    })
    fireEvent.change(screen.getByLabelText("Финальный ответ"), {
      target: { value: "1/3" },
    })

    await waitFor(
      () =>
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/files"),
          expect.objectContaining({ method: "PUT" }),
        ),
      { timeout: 2500 },
    )
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const put = calls.find((call) => String(call[0]).includes("/files") && call[1]?.method === "PUT")
    const saved = JSON.parse(String(put?.[1]?.body)).files.find(
      (file: { name: string }) => file.name === "solution.json",
    )
    const solution = JSON.parse(saved.content)
    expect(solution.steps[0].formula).toBe("\\int_0^1 x^2\\,dx")
    expect(solution.answer).toBe("1/3")
  })
})
