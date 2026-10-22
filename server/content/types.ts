export type QuestionType = "single" | "text"
export type TaskKind = "code" | "terminal" | "love" | "project" | "steps"

export type CourseMode = "general" | "math" | "programming"
export type RuntimeKind = "none" | "lua" | "c" | "cpp" | "python" | "javascript" | "custom"
export type CourseTheme = "forest" | "amber" | "ocean" | "plum" | "clay"
export type CourseIcon = "book" | "code" | "chart" | "globe" | "atom" | "scale" | "palette" | "heart"

export interface CourseSettings {
  runtime: RuntimeKind
  runCommand: string
  lspCommand: string
  lspArgs: string[]
  fileExtension: string
  entry: string
}

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
  criteria?: string[]
}

export interface ContentError {
  code: string
  message: string
  lessonId?: string
  chapterId?: string
  courseId?: string
  path?: string
}

export interface LessonContent {
  id: string
  courseId?: string
  title: string
  theoryMarkdown: string
  practiceIntro: string
  tasks: TaskContent[]
  quiz: Quiz | null
  errors: ContentError[]
}

export interface Chapter {
  id: string
  courseId?: string
  title: string
  description: string
  lessonIds: string[]
  quiz: Quiz | null
  errors: ContentError[]
}

export interface CourseSnapshot {
  version: string
  courses?: CourseMeta[]
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
