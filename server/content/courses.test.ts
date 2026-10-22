import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_COURSE_META, DEFAULT_COURSE_SETTINGS, DEFAULT_LUA_COURSE_META } from "./defaults"
import {
  coursesOf,
  readMentorPrompt,
  scanProject,
  writeGeneratedCourse,
  writeMentorPrompt,
  type GeneratedCourse,
} from "./courses"
import type { Quiz } from "./types"

const fixtureRoot = resolve(process.cwd(), "server/content/__fixtures__")
let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-courses-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function quiz(): Quiz {
  return {
    title: "Проверка",
    questions: [
      { id: "s1", type: "single", prompt: "Раз", options: ["a", "b"], correct: 0, explanation: "a" },
      { id: "s2", type: "single", prompt: "Два", options: ["a", "b"], correct: 1, explanation: "b" },
      { id: "t1", type: "text", prompt: "Три", referenceAnswer: "Ответ", criteria: ["критерий"] },
      { id: "t2", type: "text", prompt: "Четыре", referenceAnswer: "Ответ", criteria: ["критерий"] },
    ],
  }
}

function generatedCourse(): GeneratedCourse {
  return {
    ...DEFAULT_COURSE_META,
    id: "econ",
    title: "Экономика",
    description: "Как читать рынки и решения.",
    theme: "amber",
    icon: "chart",
    mode: "general",
    builtIn: false,
    createdAt: "2026-10-22T10:00:00.000Z",
    chapters: [
      {
        id: "econ-c1",
        title: "Деньги",
        description: "Первая глава.",
        lessonIds: ["econ-1-1"],
        quiz: null,
        errors: [],
      },
    ],
    lessons: {
      "econ-1-1": {
        id: "econ-1-1",
        title: "Инфляция",
        theoryMarkdown: "# Инфляция",
        practiceIntro: "",
        tasks: [
          {
            id: "econ-task-1",
            title: "Разбор",
            prompt: "Объясните инфляцию.",
            kind: "steps",
            entry: "solution.json",
            files: [{ name: "solution.json", content: '{"steps":[],"answer":""}' }],
            args: [],
            stdin: "",
            timeoutMs: 3000,
            criteria: ["шаги"],
          },
        ],
        quiz: quiz(),
        errors: [],
      },
    },
  }
}

describe("scanProject", () => {
  it("returns an empty snapshot for a project without courses", () => {
    mkdirSync(join(dir, "courses"), { recursive: true })
    const snapshot = scanProject(dir)
    expect(snapshot.courses).toEqual([])
    expect(snapshot.chapters).toEqual([])
    expect(snapshot.lessons).toEqual({})
    expect(coursesOf(snapshot)).toEqual([])
  })

  it("loads a legacy course folder with a course.json and content", () => {
    const courseDir = join(dir, "courses", "demo")
    mkdirSync(courseDir, { recursive: true })
    cpSync(join(fixtureRoot, "lessons"), join(courseDir, "lessons"), { recursive: true })
    cpSync(join(fixtureRoot, "course"), join(courseDir, "course"), { recursive: true })
    writeFileSync(
      join(courseDir, "course.json"),
      JSON.stringify({ ...DEFAULT_LUA_COURSE_META, id: "demo", title: "Demo", builtIn: false }),
      "utf8",
    )

    const snapshot = scanProject(dir)
    expect(snapshot.courses).toHaveLength(1)
    expect(snapshot.courses?.[0]).toMatchObject({ id: "demo", title: "Demo" })
    expect(snapshot.lessons["01-demo"].courseId).toBe("demo")
    expect(snapshot.chapters[0].courseId).toBe("demo")
  })

  it("writes and reloads a generated course", () => {
    writeGeneratedCourse(dir, generatedCourse())
    const snapshot = scanProject(dir)
    expect(snapshot.courses).toHaveLength(1)
    expect(snapshot.courses?.[0]).toMatchObject({
      id: "econ",
      title: "Экономика",
      theme: "amber",
      icon: "chart",
      mode: "general",
      format: "generated",
    })
    expect(snapshot.chapters[0]).toMatchObject({ id: "econ-c1", courseId: "econ" })
    expect(snapshot.lessons["econ-1-1"]).toMatchObject({
      courseId: "econ",
      title: "Инфляция",
      quiz: { title: "Проверка" },
    })
    expect(snapshot.lessons["econ-1-1"].tasks[0].kind).toBe("steps")
    expect(existsSync(join(dir, "courses", "econ", "course.json"))).toBe(true)
  })

  it("skips a broken generated course and reports why", () => {
    const courseDir = join(dir, "courses", "broken")
    mkdirSync(courseDir, { recursive: true })
    writeFileSync(
      join(courseDir, "course.json"),
      JSON.stringify({ format: "generated", id: "broken", title: "Broken", chapters: "nope", lessons: {} }),
      "utf8",
    )
    const snapshot = scanProject(dir)
    expect(snapshot.courses).toEqual([])
    expect(snapshot.errors.some((error) => error.code === "course_content_invalid")).toBe(true)
  })

  it("keeps mentor prompts per course", () => {
    writeGeneratedCourse(dir, generatedCourse())
    expect(readMentorPrompt(dir, "econ")).toContain("Лестница обучения")
    writeMentorPrompt(dir, "econ", "Только экономика.")
    expect(readMentorPrompt(dir, "econ")).toBe("Только экономика.")
    expect(readMentorPrompt(dir, "lua")).toContain("Lua")
  })
})

describe("writeGeneratedCourse", () => {
  it("does not overwrite an existing course", () => {
    writeGeneratedCourse(dir, generatedCourse())
    expect(() => writeGeneratedCourse(dir, generatedCourse())).toThrow("course_exists")
  })

  it("persists the 50/50 quiz and the steps starter", () => {
    writeGeneratedCourse(dir, generatedCourse())
    const raw = JSON.parse(readFileSync(join(dir, "courses", "econ", "course.json"), "utf8"))
    expect(raw.format).toBe("generated")
    expect(raw.lessons["econ-1-1"].quiz.questions).toHaveLength(4)
    expect(raw.lessons["econ-1-1"].tasks[0].files[0].name).toBe("solution.json")
    expect(raw.settings).toEqual(DEFAULT_COURSE_SETTINGS)
  })
})
