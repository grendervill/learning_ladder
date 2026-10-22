import { describe, expect, it } from "vitest"
import { scanCourse } from "./scan"

function countTypes(quiz: NonNullable<ReturnType<typeof scanCourse>["chapters"][number]["quiz"]>) {
  return {
    single: quiz.questions.filter((question) => question.type === "single").length,
    text: quiz.questions.filter((question) => question.type === "text").length,
  }
}

describe("project content", () => {
  it("has a complete six-chapter course without content errors", () => {
    const course = scanCourse(process.cwd())
    expect(course.errors).toEqual([])
    expect(course.chapters).toHaveLength(6)
    expect(Object.keys(course.lessons)).toHaveLength(17)
    expect(course.unassigned).toEqual([])

    for (const lesson of Object.values(course.lessons)) {
      expect(lesson.tasks.length, `${lesson.id}: tasks`).toBeGreaterThan(0)
      expect(lesson.quiz, `${lesson.id}: quiz`).not.toBeNull()
      expect(countTypes(lesson.quiz!), `${lesson.id}: quiz ratio`).toEqual({ single: 2, text: 2 })
    }

    for (const chapter of course.chapters) {
      expect(chapter.quiz, `${chapter.id}: chapter quiz`).not.toBeNull()
      expect(countTypes(chapter.quiz!), `${chapter.id}: chapter quiz ratio`).toEqual({ single: 3, text: 3 })
    }
  })
})
