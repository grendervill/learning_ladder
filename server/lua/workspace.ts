import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import type { TaskFile } from "../content/types"

export function defaultWorkspaceRoot(): string {
  return resolve(process.cwd(), "data", "workspaces")
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export function workspacePath(
  lessonId: string,
  taskId: string,
  root = defaultWorkspaceRoot(),
): string {
  const dir = join(root, safeSegment(lessonId), safeSegment(taskId))
  mkdirSync(dir, { recursive: true })
  return dir
}

function safeTarget(dir: string, name: string): string {
  if (!name || name.startsWith("/") || name.includes("\\") || name.includes("\0")) {
    throw new Error(`unsafe_file_name:${name}`)
  }
  const target = resolve(dir, name)
  if (target !== dir && !target.startsWith(dir + sep)) {
    throw new Error(`unsafe_file_name:${name}`)
  }
  return target
}

export function writeTaskFiles(
  lessonId: string,
  taskId: string,
  files: TaskFile[],
  root = defaultWorkspaceRoot(),
): string {
  const dir = workspacePath(lessonId, taskId, root)
  for (const file of files) {
    const target = safeTarget(dir, file.name)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content, "utf8")
  }
  return dir
}

export async function resetTaskWorkspace(
  lessonId: string,
  taskId: string,
  starterFiles: TaskFile[],
  root = defaultWorkspaceRoot(),
): Promise<string> {
  const dir = workspacePath(lessonId, taskId, root)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const file of starterFiles) {
    const target = safeTarget(dir, file.name)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content, "utf8")
  }
  return dir
}
