import { fetchJson } from "./api"

export type Volume = "short" | "medium" | "long"

export interface ClarifyQuestion {
  id: string
  prompt: string
  type: "single" | "multiple"
  options: string[]
}

export interface ClarifyResponse {
  questions: ClarifyQuestion[]
  fallback?: boolean
}

export interface ClarifyAnswer {
  question: string
  answer: string
}

export interface CourseJob {
  id: string
  status: "queued" | "outline" | "lessons" | "saving" | "done" | "error" | "cancelled"
  phase: string
  completed: number
  total: number
  title: string | null
  courseId: string | null
  lessonTitles?: string[]
  error: string | null
  cancelRequested: boolean
  createdAt: string
}

export const LOCAL_FALLBACK_QUESTIONS: ClarifyQuestion[] = [
  {
    id: "goal",
    prompt: "Что вам важнее всего в этой теме?",
    type: "multiple",
    options: ["Понять основы", "Разобраться в практике", "Решить конкретную задачу", "Найти свой темп"],
  },
  {
    id: "level",
    prompt: "Какой у вас уровень?",
    type: "single",
    options: ["С нуля", "Что-то знаю", "Уверенно, хочу глубже"],
  },
  {
    id: "focus",
    prompt: "Что включить в курс?",
    type: "multiple",
    options: ["Главные идеи", "Примеры", "Разбор ошибок", "Продвинутые разделы"],
  },
]

export function clarifyCourse(topic: string): Promise<ClarifyResponse> {
  return fetchJson<ClarifyResponse>("/api/courses/clarify", {
    method: "POST",
    body: JSON.stringify({ topic }),
  })
}

export function startCourseGeneration(input: {
  topic: string
  answers: ClarifyAnswer[]
  volume: Volume
}): Promise<{ jobId: string }> {
  return fetchJson<{ jobId: string }>("/api/courses/generate", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function fetchCourseJob(jobId: string): Promise<CourseJob> {
  return fetchJson<CourseJob>(`/api/courses/jobs/${jobId}`)
}

export function cancelCourseJob(jobId: string): Promise<{ cancelled: boolean }> {
  return fetchJson<{ cancelled: boolean }>(`/api/courses/jobs/${jobId}/cancel`, {
    method: "POST",
  })
}
