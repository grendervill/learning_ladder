import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DEFAULT_CONSTRUCTOR_PROMPT } from "./prompts"

export function constructorPromptPath(root: string): string {
  return join(root, "prompts", "constructor.md")
}

export function readConstructorPrompt(root: string): string {
  const path = constructorPromptPath(root)
  if (existsSync(path)) {
    try {
      const body = readFileSync(path, "utf8").trim()
      if (body) return body
    } catch {
      // Fall through to the default.
    }
  }
  return DEFAULT_CONSTRUCTOR_PROMPT
}

export function writeConstructorPrompt(root: string, body: string): void {
  const path = constructorPromptPath(root)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${body.trim()}\n`, "utf8")
}
