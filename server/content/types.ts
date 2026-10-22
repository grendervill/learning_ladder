export type QuestionType = "single" | "text"
export type TaskKind = "code" | "terminal" | "love" | "project"

export interface SingleQuestion {
  id: string
  type: "single"
  prompt: string
  options: string[]
  correct: number
  explanation: string
}

export interface TextQuestion {
  id: string
  type: "text"
  prompt: string
  placeholder?: string
  referenceAnswer: string
  criteria: string[]
}

export type Question = SingleQuestion | TextQuestion

export interface Quiz {
  title: string
  questions: Question[]
}

export interface TaskFile {
  name: string
  content: string
}

export interface TaskContent {
  id: string
  title: string
  prompt: string
  kind: TaskKind
  entry: string
  files: TaskFile[]
  args: string[]
  stdin: string
  timeoutMs: number
}

export interface ContentError {
  code: string
  message: string
  lessonId?: string
  chapterId?: string
  path?: string
}

export interface LessonContent {
  id: string
  title: string
  theoryMarkdown: string
  practiceIntro: string
  tasks: TaskContent[]
  quiz: Quiz | null
  errors: ContentError[]
}

export interface Chapter {
  id: string
  title: string
  description: string
  lessonIds: string[]
  quiz: Quiz | null
  errors: ContentError[]
}

export interface CourseSnapshot {
  version: string
  chapters: Chapter[]
  lessons: Record<string, LessonContent>
  unassigned: string[]
  errors: ContentError[]
}

export interface ChapterFile {
  id: string
  title: string
  description?: string
  lessonIds: string[]
  quizFile?: string
}
