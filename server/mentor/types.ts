export interface MentorFile {
  name: string
  content: string
}

export interface MentorRun {
  stdout: string
  stderr: string
  exitCode: number
  timedOut?: boolean
  syntaxError?: boolean
}

export interface MentorTerminalEntry {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface MentorTaskInput {
  taskId: string
  title: string
  prompt: string
  kind: string
  files: MentorFile[]
  lastRun?: MentorRun | null
  terminalHistory?: MentorTerminalEntry[]
  criteria?: string[]
}

export interface MentorQuizQuestion {
  id: string
  type: "single" | "text"
  prompt: string
  options?: string[]
  correct?: number
  referenceAnswer?: string
  criteria?: string[]
  answer?: number | string
}

export interface MentorReviewRequest {
  scope?: "lesson" | "chapter"
  lessonId: string
  lessonTitle: string
  chapterTitle: string
  theory?: string
  practiceIntro?: string
  tasks: MentorTaskInput[]
  quiz: MentorQuizQuestion[]
  previousAttempts?: Array<{ grade: number; summary: string; submittedAt: string }>
  mentorPrompt?: string
}

export interface MentorTaskFeedback {
  taskId: string
  status: "ok" | "needs_work" | "missing"
  comment: string
}

export interface MentorQuizFeedback {
  questionId: string
  correct: boolean
  comment: string
}

export interface MentorReviewResult {
  grade: number
  verdict: "pass" | "retry"
  summary: string
  strengths: string[]
  issues: string[]
  nextStep: string
  tasks: MentorTaskFeedback[]
  quiz: MentorQuizFeedback[]
}

export interface MentorContext {
  lessonId?: string
  lessonTitle?: string
  taskId?: string
  taskTitle?: string
  code?: MentorFile[]
  lastRun?: MentorRun | null
  history?: Array<{ role: "user" | "assistant"; content: string }>
  mentorPrompt?: string
}

export interface MentorClassification {
  assignments: Array<{ folder: string; chapterId: string }>
  newChapters: Array<{
    id: string
    title: string
    description: string
    folderIds: string[]
  }>
  reason: string
}

export interface SessionCourseStats {
  id: string
  title: string
  percent: number
  passed: number
  total: number
  chapters: Array<{ title: string; passed: number; total: number }>
  lessons: Array<{ title: string; grade: number | null; status: string }>
}

export interface SessionStats {
  startedAt: string
  endedAt: string
  courses: SessionCourseStats[]
  chapters: Array<{ title: string; passed: number; total: number }>
  lessons: Array<{ title: string; grade: number | null; status: string }>
  percent: number
  notes?: string
}
