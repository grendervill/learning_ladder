import express, { type Express } from "express"
import type { DatabaseSync } from "./db"
import type { CourseSnapshot } from "./content/types"
import { buildContext, defaultContext, type AppContext } from "./context"
import { createCourseRouter } from "./routes/course"
import { createProgressRouter } from "./routes/progress"

export interface AppOptions {
  db?: DatabaseSync
  course?: CourseSnapshot
  progressPath?: string
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
  app.use("/api", createProgressRouter(getContext))

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error)
    res.status(500).json({ error: "internal_error" })
  })

  return app
}
