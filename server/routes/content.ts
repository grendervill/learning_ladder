import { Router } from "express"
import type { AppContext } from "../context"
import type { MentorService } from "../mentor/service"
import { classifyAndApply } from "../content/classify"

export function createContentRouter(
  getContext: () => AppContext,
  getMentor: () => MentorService,
): Router {
  const router = Router()

  router.post("/content/classify", async (_req, res, next) => {
    try {
      const result = await classifyAndApply(getContext(), getMentor())
      res.json({
        applied: result.applied,
        reason: result.reason ?? null,
        unassigned: result.snapshot.unassigned,
        chapters: result.snapshot.chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          lessonIds: chapter.lessonIds,
        })),
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
