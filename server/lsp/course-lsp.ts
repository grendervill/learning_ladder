import { join } from "node:path"
import type { AppContext } from "../context"
import { coursesOf } from "../content/courses"
import type { BridgeOptions } from "./bridge"

/**
 * Resolves the language server of one course. A missing course or an empty
 * LSP command is not an error: the editor and runner keep working without it.
 */
export function courseLspOptions(
  context: AppContext,
  courseId: string | null | undefined,
): BridgeOptions | null {
  if (!courseId) return null
  const course = coursesOf(context.getCourse()).find((item) => item.id === courseId)
  if (!course) return null
  const { lspCommand, lspArgs } = course.settings
  if (!lspCommand.trim()) return null
  const root = context.root ?? process.cwd()
  return {
    command: lspCommand,
    args: lspArgs,
    cwd: join(root, "courses", courseId),
  }
}
