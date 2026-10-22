import { cleanup, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PracticeTab } from "./PracticeTab"
import { renderWithProviders } from "../../test/render"

const lesson = {
  id: "python-1",
  title: "Первый скрипт",
  theoryMarkdown: "",
  practiceIntro: "",
  tasks: [
    {
      id: "python-1-task-1",
      title: "Выведи строку",
      prompt: "Напечатай приветствие.",
      kind: "code",
      entry: "main.py",
      files: [{ name: "main.py", content: 'print("hello")' }],
      args: [],
      stdin: "",
      timeoutMs: 3000,
    },
  ],
  quiz: null,
  errors: [],
  answers: {},
  access: "available",
  chapterId: "python-c1",
  chapterTitle: "Старт",
  course: {
    id: "python",
    title: "Python",
    mode: "programming",
    settings: {
      runtime: "python",
      runCommand: "python3 {file}",
      lspCommand: "pyright-langserver",
      lspArgs: ["--stdio"],
      fileExtension: ".py",
      entry: "main.py",
    },
  },
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

describe("course runtime", () => {
  it("passes Python to the editor and run panel", async () => {
    renderWithProviders(<PracticeTab lessonId="python-1" />)

    expect(await screen.findByText("Python")).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /Проверить/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "main.py" })).toBeInTheDocument()
  })
})
