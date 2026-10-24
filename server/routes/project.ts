import { accessSync, constants, existsSync } from "node:fs"
import { resolve } from "node:path"
import { Router } from "express"
import type { AppContext } from "../context"
import { coursesOf } from "../content/courses"
import type { ProjectManager } from "../project-controller"
import type { ProjectStatus } from "../project"

export function createProjectRouter(
  getContext: () => AppContext,
  project?: ProjectManager,
  getStatus?: () => ProjectStatus,
): Router {
  const router = Router()

  router.get("/project", (_req, res) => {
    const context = getContext()
    const root = context.root ?? process.cwd()
    const status = getStatus?.()
    const defaultRoot = status?.defaultRoot ?? root
    let writable = false
    try {
      accessSync(root, constants.W_OK)
      writable = true
    } catch {
      // A read-only project can still be inspected, just not created or saved.
    }
    res.json({
      root,
      courses: coursesOf(context.getCourse()).length,
      exists: existsSync(root),
      writable,
      defaultRoot,
      isDefault: resolve(root) === resolve(defaultRoot),
      ...(status?.fallbackError ? { fallbackError: status.fallbackError } : {}),
    })
  })

  router.put("/project", async (req, res) => {
    if (!project) {
      res.status(501).json({ error: "project_switch_unavailable" })
      return
    }
    const root = typeof req.body?.root === "string" ? req.body.root.trim() : ""
    if (!root) {
      res.status(400).json({ error: "project_root_required" })
      return
    }
    try {
      const result = await project.switch(root)
      res.json(result)
    } catch (error) {
      res.status(400).json({
        error: "project_switch_failed",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })

  return router
}
