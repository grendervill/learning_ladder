import { resolve } from "node:path"
import type { AppContext } from "./context"
import { defaultContext } from "./context"
import { coursesOf } from "./content/courses"
import { closeDb } from "./db"
import { ensureProjectLayout, writeConfiguredProjectRoot } from "./project"

export interface ProjectSwitchResult {
  root: string
  courses: number
}

export interface ProjectManager {
  getContext(): AppContext
  root(): string
  switch(root: string): Promise<ProjectSwitchResult>
}

export interface ProjectManagerOptions {
  initialContext: AppContext
  createContext?: () => AppContext
  onAfterSwitch?: (
    context: AppContext,
    previous: AppContext,
    previousRoot: string,
  ) => void | Promise<void>
}

export function createProjectManager(options: ProjectManagerOptions): ProjectManager {
  const createContext = options.createContext ?? defaultContext
  let context = options.initialContext

  return {
    getContext: () => context,
    root: () => context.root ?? process.cwd(),
    async switch(root: string) {
      const target = resolve(root)
      if (!target) throw new Error("project_root_required")
      const previousRoot = process.cwd()
      const previous = context
      try {
        ensureProjectLayout(target)
        if (resolve(process.cwd()) !== target) process.chdir(target)
        closeDb()
        const next = createContext()
        context = next
        await options.onAfterSwitch?.(next, previous, previousRoot)
        writeConfiguredProjectRoot(target)
        return { root: target, courses: coursesOf(next.getCourse()).length }
      } catch (error) {
        try {
          closeDb()
          if (resolve(process.cwd()) !== previousRoot) process.chdir(previousRoot)
          context = createContext()
        } catch {
          // The original error is more useful than a cleanup failure.
        }
        throw error
      }
    },
  }
}
