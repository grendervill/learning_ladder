import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import type { AppContext } from "../context"
import { DEFAULT_COURSE_META } from "../content/defaults"
import type { CourseSnapshot } from "../content/types"
import { courseLspOptions } from "./course-lsp"

const root = resolve("/tmp/ladder-lsp-project")

function context(): AppContext {
  const snapshot: CourseSnapshot = {
    version: "test",
    courses: [
      {
        ...DEFAULT_COURSE_META,
        id: "c-demo",
        title: "C",
        mode: "programming",
        settings: {
          runtime: "c",
          runCommand: "gcc {file} -o {bin} && {bin}",
          lspCommand: "clangd",
          lspArgs: [],
          fileExtension: ".c",
          entry: "main.c",
        },
      },
      {
        ...DEFAULT_COURSE_META,
        id: "python-demo",
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
      {
        ...DEFAULT_COURSE_META,
        id: "general-demo",
        title: "General",
        mode: "general",
        settings: {
          runtime: "none",
          runCommand: "",
          lspCommand: "",
          lspArgs: [],
          fileExtension: ".txt",
          entry: "main.txt",
        },
      },
    ],
    chapters: [],
    lessons: {},
    unassigned: [],
    errors: [],
  }
  return {
    root,
    getCourse: () => snapshot,
  } as AppContext
}

describe("course lsp options", () => {
  it("uses the course command, args and folder", () => {
    expect(courseLspOptions(context(), "c-demo")).toEqual({
      command: "clangd",
      args: [],
      cwd: join(root, "courses", "c-demo"),
    })
    expect(courseLspOptions(context(), "python-demo")).toEqual({
      command: "pyright-langserver",
      args: ["--stdio"],
      cwd: join(root, "courses", "python-demo"),
    })
  })

  it("returns null for unknown courses and courses without an LSP", () => {
    expect(courseLspOptions(context(), "missing")).toBeNull()
    expect(courseLspOptions(context(), null)).toBeNull()
    expect(courseLspOptions(context(), "general-demo")).toBeNull()
  })
})
