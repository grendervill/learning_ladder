export type LessonStatus = "locked" | "available" | "in_progress" | "passed"
export type ChapterStatus = "locked" | "available" | "in_progress" | "passed"

export interface ChapterSummary {
  id: string
  title: string
  description: string
  lessonIds: string[]
  quiz: unknown | null
  errors: Array<{ code: string; message: string }>
}

export interface LessonSummary {
  id: string
  title: string
  errors: Array<{ code: string; message: string }>
}

export interface AccessState {
  lessons: Record<string, LessonStatus>
  chapters: Record<string, ChapterStatus>
  nextLessonId: string | null
  nextChapterQuizId: string | null
}

export interface CourseResponse {
  version: string
  chapters: ChapterSummary[]
  lessons: LessonSummary[]
  unassigned: string[]
  errors: Array<{ code: string; message: string }>
  access: AccessState
  currentSession: { id: string; startedAt: string; status: string; goal?: string } | null
}

export interface LessonDetail {
  id: string
  title: string
  theoryMarkdown: string
  practiceIntro: string
  tasks: Array<{
    id: string
    title: string
    prompt: string
    kind: "code" | "terminal" | "love" | "project"
    entry: string
    files: Array<{ name: string; content: string }>
    args: string[]
    stdin: string
    timeoutMs: number
  }>
  quiz: {
    title: string
    questions: Array<{
      id: string
      type: "single" | "text"
      prompt: string
      options?: string[]
      placeholder?: string
    }>
  } | null
  errors: Array<{ code: string; message: string }>
  access: LessonStatus
  chapterId: string | null
  chapterTitle: string | null
}
