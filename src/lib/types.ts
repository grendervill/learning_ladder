import type {
  CourseIcon,
  CourseMode,
  CourseSettings,
  CourseTheme,
  RuntimeKind,
} from "../../shared/runtimes"

export type {
  CourseIcon,
  CourseMode,
  CourseSettings,
  CourseTheme,
  RuntimeKind,
} from "../../shared/runtimes"

export type LessonStatus = "locked" | "available" | "in_progress" | "passed"
export type ChapterStatus = "locked" | "available" | "in_progress" | "passed"

export interface CourseMeta {
  id: string
  title: string
  description: string
  theme: CourseTheme
  icon: CourseIcon
  mode: CourseMode
  settings: CourseSettings
  builtIn: boolean
  createdAt: string
  format?: "legacy" | "generated"
}

export interface CourseProgress {
  passed: number
  total: number
  percent: number
  nextLessonId: string | null
  chapterCount: number
}

export interface CourseCard extends CourseMeta {
  progress: CourseProgress
}

export interface CoursesResponse {
  courses: CourseCard[]
  total: number
  page: number
  pageSize: number
  pages: number
}

export interface CourseDetailResponse {
  course: CourseMeta
  progress: CourseProgress
  chapters: ChapterSummary[]
  lessons: LessonSummary[]
  access: AccessState
  errors: Array<{ code: string; message: string }>
  unassigned: string[]
}

export interface ProjectResponse {
  root: string
  courses: number
  exists: boolean
  writable: boolean
}

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
  course?: CourseMeta
  progress?: CourseProgress
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
    kind: "code" | "terminal" | "love" | "project" | "steps"
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
      correct?: number
      explanation?: string
      referenceAnswer?: string
      criteria?: string[]
    }>
  } | null
  errors: Array<{ code: string; message: string }>
  answers: Record<string, number | string>
  access: LessonStatus
  chapterId: string | null
  chapterTitle: string | null
  course?: {
    id: string
    title: string
    mode: CourseMode
    settings: CourseSettings
  }
}
