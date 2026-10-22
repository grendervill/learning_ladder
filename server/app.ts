import { existsSync } from "node:fs"
import { join } from "node:path"
import express, { type Express } from "express"
import type { DatabaseSync } from "./db"
import type { CourseSnapshot } from "./content/types"
import { buildContext, defaultContext, type AppContext } from "./context"
import { createCourseRouter } from "./routes/course"
import { createCoursesRouter } from "./routes/courses"
import { createProjectRouter } from "./routes/project"
import type { ProjectManager } from "./project-controller"
import { createProgressRouter } from "./routes/progress"
import { createQuizRouter } from "./routes/quiz"
import { createTaskFilesRouter } from "./routes/task-files"
import { createRunRouter } from "./routes/run"
import { createTerminalRouter } from "./routes/terminal"
import { createSubmitRouter } from "./routes/submit"
import { createChapterQuizRouter } from "./routes/chapter-quiz"
import { createMentorAskRouter } from "./routes/mentor-ask"
import { createSessionRouter } from "./routes/session"
import { createContentRouter } from "./routes/content"
import { createEventsRouter } from "./routes/events"
import { createSettingsRouter } from "./routes/settings"
import { getMentorService, type MentorService } from "./mentor/service"

export interface AppOptions {
  db?: DatabaseSync
  course?: CourseSnapshot
  progressPath?: string
  root?: string
  staticRoot?: string
  getContext?: () => AppContext
  project?: ProjectManager
  mentor?: MentorService
  context?: AppContext
}

export function createApp(options: AppOptions = {}): Express {
  const app = express()
  app.use(express.json({ limit: "2mb" }))

  let context: AppContext | null = options.context ?? null
  const getContext = options.getContext ?? (() => {
    if (!context) {
      context =
        options.db && options.course
          ? buildContext(options.db, options.course, options.progressPath, options.root)
          : defaultContext()
    }
    return context
  })

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.use("/api", createCourseRouter(getContext))
  app.use("/api", createCoursesRouter(getContext))
  app.use("/api", createProjectRouter(getContext, options.project))
  app.use("/api", createQuizRouter(getContext))
  app.use("/api", createTaskFilesRouter(getContext))
  app.use("/api", createRunRouter(getContext))
  app.use("/api", createTerminalRouter(getContext))
  app.use("/api", createSubmitRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createChapterQuizRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createMentorAskRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createSessionRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createContentRouter(getContext, () => options.mentor ?? getMentorService()))
  app.use("/api", createEventsRouter())
  app.use("/api", createProgressRouter(getContext))
  app.use("/api", createSettingsRouter(getContext))

  const dist = join(options.staticRoot ?? process.cwd(), "dist")
  if (process.env.NODE_ENV === "production" && existsSync(dist)) {
    app.use(express.static(dist))
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/lsp")) {
        next()
        return
      }
      res.sendFile(join(dist, "index.html"))
    })
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error)
    res.status(500).json({ error: "internal_error" })
  })

  return app
}
