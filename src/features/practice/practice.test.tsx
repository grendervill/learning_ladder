import { cleanup, screen, waitFor } from "@testing-library/react"
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
})
