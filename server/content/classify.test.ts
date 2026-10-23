import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { classifyAndApply } from "./classify"
import { scanCourse } from "./scan"
import { migrate, openDatabase } from "../db"
import type { MentorService } from "../mentor/service"
import type { CourseSnapshot, Quiz } from "./types"

const roots: string[] = []

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "learninglua-classify-"))
  roots.push(root)
  mkdirSync(join(root, "courses", "lua", "course", "chapter-quizzes"), { recursive: true })
  mkdirSync(join(root, "courses", "lua", "lessons", "01-demo"), { recursive: true })
  mkdirSync(join(root, "courses", "lua", "lessons", "new-topic", "tasks"), { recursive: true })
  writeFileSync(
    join(root, "courses", "lua", "course", "chapters.json"),
    JSON.stringify({
      chapters: [{ id: "foundations", title: "Основы", description: "", lessonIds: ["01-demo"] }],
    }),
  )
  writeFileSync(join(root, "courses", "lua", "lessons", "01-demo", "README.md"), "# Демо\n\n## Теория\n\nТекст\n")
  writeFileSync(
    join(root, "courses", "lua", "lessons", "new-topic", "README.md"),
    "# Новая тема\n\n## Теория\n\nТерминал и файлы\n",
  )
  writeFileSync(join(root, "courses", "lua", "lessons", "new-topic", "tasks", "task1.lua"), '-- task\nprint("ok")\n')
  return root
}

const quiz: Quiz = {
  title: "Квиз",
  questions: [
    { id: "q1", type: "single", prompt: "1", options: ["a", "b"], correct: 0, explanation: "a" },
    { id: "q2", type: "single", prompt: "2", options: ["a", "b"], correct: 1, explanation: "b" },
    { id: "q3", type: "text", prompt: "3", referenceAnswer: "a", criteria: ["a"] },
    { id: "q4", type: "text", prompt: "4", referenceAnswer: "b", criteria: ["b"] },
  ],
}

function mentor(overrides: Partial<MentorService> = {}): MentorService {
  return {
    createSession: async () => "m",
    deleteSession: async () => {},
    reviewLesson: async () => {
      throw new Error("not used")
    },
    askMentor: async () => "",
    summarizeSession: async () => "",
    classifyFolders: async () => ({
      assignments: [{ folder: "new-topic", chapterId: "foundations" }],
      newChapters: [],
      reason: "Подходит по теме",
    }),
    generateQuiz: async () => quiz,
    ...overrides,
  }
}

function contextFor(root: string, snapshot: CourseSnapshot) {
  const db = openDatabase(":memory:")
  migrate(db)
  return {
    db,
    getCourse: () => snapshot,
    refreshCourse: () => scanCourse(join(root, "courses", "lua"), "lua"),
    progressPath: join(root, "PROGRESS.md"),
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("classifyAndApply", () => {
  it("adds a new folder to an existing chapter and generates its quiz", async () => {
    const root = fixtureRoot()
    const snapshot = scanCourse(join(root, "courses", "lua"), "lua")
    const context = contextFor(root, snapshot)
    const result = await classifyAndApply(context, mentor(), root)

    expect(result.applied).toBe(true)
    const chapters = JSON.parse(readFileSync(join(root, "courses", "lua", "course", "chapters.json"), "utf8"))
    expect(chapters.chapters[0].lessonIds).toContain("new-topic")
    expect(existsSync(join(root, "courses", "lua", "lessons", "new-topic", "quiz.json"))).toBe(true)
    expect(result.snapshot.unassigned).not.toContain("new-topic")
  })

  it("creates a new chapter with its chapter quiz", async () => {
    const root = fixtureRoot()
    const snapshot = scanCourse(join(root, "courses", "lua"), "lua")
    const context = contextFor(root, snapshot)
    const result = await classifyAndApply(
      context,
      mentor({
        classifyFolders: async () => ({
          assignments: [],
          newChapters: [
            { id: "tools", title: "Инструменты", description: "Терминал", folderIds: ["new-topic"] },
          ],
          reason: "Новая тема",
        }),
      }),
      root,
    )
    expect(result.applied).toBe(true)
    const chapters = JSON.parse(readFileSync(join(root, "courses", "lua", "course", "chapters.json"), "utf8"))
    expect(chapters.chapters.some((chapter: any) => chapter.id === "tools")).toBe(true)
    expect(existsSync(join(root, "courses", "lua", "course", "chapter-quizzes", "tools.json"))).toBe(true)
  })

  it("leaves a folder unassigned on an invalid classification", async () => {
    const root = fixtureRoot()
    const snapshot = scanCourse(join(root, "courses", "lua"), "lua")
    const context = contextFor(root, snapshot)
    const result = await classifyAndApply(
      context,
      mentor({
        classifyFolders: async () => ({
          assignments: [{ folder: "new-topic", chapterId: "missing" }],
          newChapters: [],
          reason: "",
        }),
      }),
      root,
    )
    expect(result.applied).toBe(false)
    expect(result.snapshot.unassigned).toContain("new-topic")
    const chapters = JSON.parse(readFileSync(join(root, "courses", "lua", "course", "chapters.json"), "utf8"))
    expect(chapters.chapters[0].lessonIds).not.toContain("new-topic")
  })
})
