import type { TaskFile } from "./content/types"

export function mergeTaskFiles(starter: TaskFile[], saved: TaskFile[]): TaskFile[] {
  const starterNames = new Set(starter.map((file) => file.name))
  const savedMap = new Map(saved.map((file) => [file.name, file.content]))
  const files = starter.map((file) => ({
    name: file.name,
    content: savedMap.get(file.name) ?? file.content,
  }))
  for (const file of saved) {
    if (!starterNames.has(file.name)) files.push(file)
  }
  return files
}
