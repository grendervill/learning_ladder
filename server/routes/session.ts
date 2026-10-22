import { Router } from "express"
import type { AppContext } from "../context"
import type { MentorService } from "../mentor/service"
import {
  finalizeSession,
  getActiveSession,
  getLastReport,
  recordActivity,
  startSession,
} from "../sessions/lifecycle"

export function createSessionRouter(
  getContext: () => AppContext,
  getMentor: () => MentorService,
): Router {
  const router = Router()

  router.post("/session/start", (_req, res) => {
    const context = getContext()
    const session = startSession(context)
    res.json({ sessionId: session.id, startedAt: session.started_at, status: session.status })
  })

  router.post("/session/activity", (req, res) => {
    const context = getContext()
    const kind = typeof req.body?.kind === "string" ? req.body.kind : ""
    if (!kind) {
      res.status(400).json({ error: "activity_kind_required" })
      return
    }
    recordActivity(context, {
      sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined,
      kind,
      lessonId: typeof req.body?.lessonId === "string" ? req.body.lessonId : undefined,
      taskId: typeof req.body?.taskId === "string" ? req.body.taskId : undefined,
      meta: req.body?.meta,
    })
    res.json({ ok: true })
  })

  router.post("/session/end", async (req, res, next) => {
    try {
      const context = getContext()
      const session = getActiveSession(context.db)
      if (!session) {
        res.json({ status: "idle" })
        return
      }
      const wait = req.body?.wait === true
      if (wait) {
        const report = await finalizeSession(context, getMentor(), session.id)
        res.json({ status: report.status, report })
        return
      }
      void finalizeSession(context, getMentor(), session.id).catch((error) => {
        console.error("[session] finalize failed", error)
      })
      res.json({ status: "finalizing", sessionId: session.id })
    } catch (error) {
      next(error)
    }
  })

  router.get("/session/current", (_req, res) => {
    const context = getContext()
    res.json({
      session: getActiveSession(context.db),
      lastReport: getLastReport(context.db),
    })
  })

  router.get("/session/report/:id", (req, res) => {
    const context = getContext()
    const row = context.db
      .prepare("select * from study_sessions where id = ?")
      .get(req.params.id)
    if (!row) {
      res.status(404).json({ error: "session_not_found" })
      return
    }
    res.json(row)
  })

  return router
}
