import express, { type Express } from "express"
import type { DatabaseSync } from "./db"
import type { CourseSnapshot } from "./content/types"
import { buildContext, defaultContext, type AppContext } from "./context"
import { createCourseRouter } from "./routes/course"
import { createProgressRouter } from "./routes/progress"
import { createQuizRouter } from "./routes/quiz"
import { createTaskFilesRouter } from "./routes/task-files"
import { createRunRouter } from "./routes/run"
import { createTerminalRouter } from "./routes/terminal"
import { createSubmitRouter } from "./routes/submit"
import { createChapterQuizRouter } from "./routes/chapter-quiz"
import { createMentorAskRouter } from "./routes/mentor-ask"
import { getMentorService, type MentorService } from "./mentor/service"

export interface AppOptions {
  db?: DatabaseSync
  course?: CourseSnapshot
  progressPath?: string
  mentor?: MentorService
}

export function createApp(options: AppOptions = {}): Express {
  const app = express()
  app.use(express.json({ limit: "2mb" }))

  let context: AppContext | null = null
  const getContext = () => {
    if (!context) {
      context =
        options.db && options.course
          ? buildContext(options.db, options.course, options.progressPath)
          : defaultContext()
    }
    return context
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.use("/api", createCourseRouter(getContext))
  app.use("/api", createQuizRouter(getContext))
  app.use("/api", createTaskFilesRouter(getContext))
  app.use("/api", createRunRouter(getContext))
  app.use("/api", createTerminalRouter(getContext))
  app.use("/api", createSubmitRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createChapterQuizRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createMentorAskRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createProgressRouter(getContext))

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error)
    res.status(500).json({ error: "internal_error" })
  })

  return app
}
