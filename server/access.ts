import type { CourseSnapshot } from "./content/types"

export type LessonStatus = "locked" | "available" | "in_progress" | "passed"
export type ChapterStatus = "locked" | "available" | "in_progress" | "passed"

export interface LessonProgressRow {
  lessonId: string
  status: LessonStatus
}

export interface ChapterProgressRow {
  chapterId: string
  status: ChapterStatus
  chapterQuizGrade?: number | null
}

export interface AccessState {
  lessons: Record<string, LessonStatus>
  chapters: Record<string, ChapterStatus>
  nextLessonId: string | null
  nextChapterQuizId: string | null
}

export function isLessonAccessible(snapshot: CourseSnapshot, lessonId: string): boolean {
  return snapshot.chapters.some((chapter) => chapter.lessonIds.includes(lessonId))
}

export function computeAccess(
  snapshot: CourseSnapshot,
  lessonProgress: LessonProgressRow[],
  chapterProgress: ChapterProgressRow[],
): AccessState {
  const lessons = new Map(lessonProgress.map((row) => [row.lessonId, row.status]))
  const chapters = new Map(chapterProgress.map((row) => [row.chapterId, row.status]))
  const access: AccessState = {
    lessons: {},
    chapters: {},
    nextLessonId: null,
    nextChapterQuizId: null,
  }

  let previousChapterPassed = true
  for (const chapter of snapshot.chapters) {
    const chapterRowStatus = chapters.get(chapter.id)
    const chapterUnlocked =
      previousChapterPassed ||
      chapterRowStatus === "passed" ||
      chapterRowStatus === "available" ||
      chapterRowStatus === "in_progress"

    let allLessonsPassed = true
    let anyLessonPassed = false
    let nextAvailableSlot = true

    for (const lessonId of chapter.lessonIds) {
      const existing = lessons.get(lessonId)
      let status: LessonStatus = existing ?? "locked"

      if (status === "passed") {
        anyLessonPassed = true
      } else if (status === "available" || status === "in_progress") {
        nextAvailableSlot = false
      } else if (chapterUnlocked && nextAvailableSlot) {
        status = "available"
        nextAvailableSlot = false
      } else {
        status = "locked"
      }

      if (status !== "passed") allLessonsPassed = false
      access.lessons[lessonId] = status
      if (!access.nextLessonId && (status === "available" || status === "in_progress")) {
        access.nextLessonId = lessonId
      }
    }

    const chapterHasQuiz = Boolean(chapter.quiz)
    const chapterCompleted =
      chapter.lessonIds.length > 0 &&
      allLessonsPassed &&
      (!chapterHasQuiz || chapterRowStatus === "passed")

    let chapterStatus: ChapterStatus
    if (chapterRowStatus === "passed" || chapterCompleted) {
      chapterStatus = "passed"
    } else if (chapterUnlocked) {
      chapterStatus = allLessonsPassed || anyLessonPassed ? "in_progress" : "available"
    } else {
      chapterStatus = "locked"
    }

    access.chapters[chapter.id] = chapterStatus
    if (chapterHasQuiz && allLessonsPassed && chapterStatus !== "passed" && chapterUnlocked) {
      access.nextChapterQuizId = chapter.id
    }

    previousChapterPassed = chapterStatus === "passed"
  }

  return access
}
