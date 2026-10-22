import { describe, expect, it } from "vitest"
import { resolve } from "node:path"
import { scanCourse } from "./scan"
import { validateQuiz, type Quiz } from "./quiz"

const fixtureRoot = resolve(process.cwd(), "server/content/__fixtures__")
const projectRoot = process.cwd()

describe("scanCourse", () => {
  it("splits theory from practice and reads tasks and quiz", () => {
    const course = scanCourse(fixtureRoot)
    const lesson = course.lessons["01-demo"]

    expect(lesson.theoryMarkdown).toContain("## Теория")
    expect(lesson.theoryMarkdown).not.toContain("## ✏️ Задания")
    expect(lesson.practiceIntro).toContain("task1.lua")
    expect(lesson.practiceIntro.startsWith("1.")).toBe(true)
    expect(lesson.tasks[0]).toMatchObject({
      id: "task1",
      entry: "task1.lua",
      kind: "code",
    })
    expect(lesson.tasks[0].prompt).toContain("напечатай привет")
    expect(lesson.quiz?.questions).toHaveLength(4)
    expect(course.chapters[0].quiz?.questions).toHaveLength(4)
  })

  it("reads folder tasks and sidecar metadata", () => {
    const course = scanCourse(fixtureRoot)
    const lesson = course.lessons["05-folder"]
    const folderTask = lesson.tasks.find((task) => task.id === "taskdir")
    const inputTask = lesson.tasks.find((task) => task.id === "task2_input")

    expect(folderTask).toMatchObject({
      entry: "main.lua",
      args: ["--demo"],
      stdin: "2\n",
    })
    expect(folderTask?.files.map((file) => file.name)).toEqual(["main.lua", "lib/calc.lua"])
    expect(inputTask).toMatchObject({ args: ["x"], stdin: "42\n" })
  })

  it("reports broken content without throwing", () => {
    const course = scanCourse(fixtureRoot)
    const lesson = course.lessons["03-broken"]

    expect(lesson.quiz).toBeNull()
    expect(course.errors.some((error) => error.lessonId === "03-broken" && error.code === "quiz_ratio")).toBe(true)
    expect(course.errors.some((error) => error.lessonId === "03-broken" && error.code === "lesson_missing_tasks")).toBe(true)
  })

  it("marks lessons that are not in a chapter as unassigned", () => {
    const course = scanCourse(fixtureRoot)
    expect(course.unassigned).toEqual(expect.arrayContaining(["04-unassigned", "05-folder"]))
  })

  it("ignores root files that are not lessons", () => {
    const course = scanCourse(projectRoot)
    expect(JSON.stringify(course)).not.toContain("Без названия")
  })
})

describe("validateQuiz", () => {
  const base = (): Quiz => ({
    title: "Тест",
    questions: [
      { id: "s1", type: "single", prompt: "1", options: ["a", "b"], correct: 0, explanation: "a" },
      { id: "s2", type: "single", prompt: "2", options: ["a", "b"], correct: 1, explanation: "b" },
      { id: "t1", type: "text", prompt: "3", referenceAnswer: "a", criteria: ["a"] },
      { id: "t2", type: "text", prompt: "4", referenceAnswer: "b", criteria: ["b"] },
    ],
  })

  it("accepts a balanced quiz", () => {
    expect(validateQuiz(base())).toEqual([])
  })

  it("rejects a non-50/50 quiz", () => {
    const quiz = base()
    quiz.questions = quiz.questions.filter((question) => question.type !== "text")
    expect(validateQuiz(quiz).map((error) => error.code)).toContain("quiz_ratio")
  })

  it("rejects duplicate ids and out-of-range answers", () => {
    const quiz = base()
    quiz.questions[1].id = "s1"
    if (quiz.questions[1].type === "single") quiz.questions[1].correct = 9
    const codes = validateQuiz(quiz).map((error) => error.code)
    expect(codes).toContain("quiz_duplicate_id")
    expect(codes).toContain("question_correct_out_of_range")
  })

  it("rejects a too-short quiz", () => {
    const quiz = base()
    quiz.questions = quiz.questions.slice(0, 2)
    expect(validateQuiz(quiz).map((error) => error.code)).toContain("quiz_too_short")
  })
})
