import { randomUUID } from "node:crypto"

export type CourseJobStatus =
  | "queued"
  | "outline"
  | "lessons"
  | "saving"
  | "done"
  | "error"
  | "cancelled"

export interface CourseJob {
  id: string
  status: CourseJobStatus
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

export class CourseJobStore {
  private readonly jobs = new Map<string, CourseJob>()

  create(): CourseJob {
    const job: CourseJob = {
      id: `job-${randomUUID()}`,
      status: "queued",
      phase: "В очереди",
      completed: 0,
      total: 0,
      title: null,
      courseId: null,
      error: null,
      cancelRequested: false,
      createdAt: new Date().toISOString(),
    }
    this.jobs.set(job.id, job)
    return job
  }

  get(id: string): CourseJob | undefined {
    return this.jobs.get(id)
  }

  update(id: string, patch: Partial<CourseJob>): CourseJob | undefined {
    const job = this.jobs.get(id)
    if (!job) return undefined
    Object.assign(job, patch)
    return job
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job) return false
    if (["done", "error", "cancelled"].includes(job.status)) return false
    job.cancelRequested = true
    if (job.status === "queued") {
      job.status = "cancelled"
      job.phase = "Отменено"
    }
    return true
  }

  values(): CourseJob[] {
    return [...this.jobs.values()]
  }
}
