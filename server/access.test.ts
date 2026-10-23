import { describe, expect, it } from "vitest"
import { computeAccess, isLessonAccessible, type ChapterProgressRow, type LessonProgressRow } from "./access"
import type { CourseSnapshot, LessonContent, Quiz } from "./content/types"

const chapterQuiz: Quiz = { title: "Квиз главы", questions: [] }

function lesson(id: string): LessonContent {
  return {
    id,
    title: id,
    theoryMarkdown: "",
    practiceIntro: "",
    tasks: [],
    quiz: null,
    errors: [],
  }
}

const snapshot: CourseSnapshot = {
  version: "test",
  chapters: [
    {
      id: "foundations",
      title: "Основы",
      description: "",
      lessonIds: ["01", "02", "03"],
      quiz: chapterQuiz,
      errors: [],
    },
    {
      id: "next",
      title: "Дальше",
      description: "",
      lessonIds: ["04"],
      quiz: chapterQuiz,
      errors: [],
    },
  ],
  lessons: {
    "01": lesson("01"),
    "02": lesson("02"),
    "03": lesson("03"),
    "04": lesson("04"),
  },
  unassigned: [],
  errors: [],
}

function passed(lessonId: string): LessonProgressRow {
  return { lessonId, status: "passed" }
}

function available(lessonId: string): LessonProgressRow {
  return { lessonId, status: "available" }
}

function chapterPassed(chapterId: string): ChapterProgressRow {
  return { chapterId, status: "passed" }
}

describe("computeAccess", () => {
  it("opens the first lesson only", () => {
    const access = computeAccess(snapshot, [], [])
    expect(access.lessons["01"]).toBe("available")
    expect(access.lessons["02"]).toBe("locked")
    expect(access.chapters.foundations).toBe("available")
    expect(access.chapters.next).toBe("locked")
  })

  it("opens next lesson after passing the previous one", () => {
    const access = computeAccess(snapshot, [passed("01"), passed("02")], [])
    expect(access.lessons["03"]).toBe("available")
    expect(access.lessons["04"]).toBe("locked")
  })

  it("opens next lesson after pass and chapter quiz after all lessons", () => {
    const progress = [passed("01"), passed("02"), passed("03")]
    const access = computeAccess(snapshot, progress, [])
    expect(access.lessons["04"]).toBe("locked")
    expect(access.chapters.foundations).toBe("in_progress")
    expect(access.nextChapterQuizId).toBe("foundations")
  })

  it("opens next chapter after chapter quiz pass", () => {
    const progress = [passed("01"), passed("02"), passed("03")]
    const access = computeAccess(snapshot, progress, [chapterPassed("foundations")])
    expect(access.lessons["04"]).toBe("available")
    expect(access.chapters.next).toBe("available")
  })

  it("auto-passes a chapter without a quiz once all its lessons are passed", () => {
    const withoutQuiz: CourseSnapshot = {
      ...snapshot,
      chapters: [{ ...snapshot.chapters[0], quiz: null }, snapshot.chapters[1]],
    }
    const access = computeAccess(withoutQuiz, [passed("01"), passed("02"), passed("03")], [])
    expect(access.chapters.foundations).toBe("passed")
    expect(access.lessons["04"]).toBe("available")
  })

  it("never relocks an already available lesson", () => {
    const access = computeAccess(snapshot, [available("02")], [])
    expect(access.lessons["02"]).toBe("available")
  })

  it("treats a folder outside all chapters as inaccessible", () => {
    const withExtra: CourseSnapshot = {
      ...snapshot,
      lessons: { ...snapshot.lessons, "99-new": lesson("99-new") },
    }
    expect(isLessonAccessible(withExtra, "99-new")).toBe(false)
    expect(isLessonAccessible(withExtra, "01")).toBe(true)
  })

  it("keeps in-progress status and exposes the next lesson", () => {
    const progress: LessonProgressRow[] = [{ lessonId: "01", status: "in_progress" }]
    const access = computeAccess(snapshot, progress, [])
    expect(access.lessons["01"]).toBe("in_progress")
    expect(access.nextLessonId).toBe("01")
  })
})
