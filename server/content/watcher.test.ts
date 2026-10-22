import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { once } from "node:events"
import { afterEach, describe, expect, it } from "vitest"
import { startContentWatcher } from "./watcher"

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("startContentWatcher", () => {
  it("reports a changed lesson file", async () => {
    const root = mkdtempSync(join(tmpdir(), "learninglua-watch-"))
    roots.push(root)
    mkdirSync(join(root, "courses", "lua", "lessons", "01-demo"), { recursive: true })
    writeFileSync(join(root, "courses", "lua", "lessons", "01-demo", "README.md"), "# Демо\n")
    mkdirSync(join(root, "courses", "lua", "course"), { recursive: true })
    writeFileSync(join(root, "courses", "lua", "course", "chapters.json"), '{"chapters":[]}')

    let changed: string | null = null
    const watcher = startContentWatcher({
      root,
      debounceMs: 80,
      onChange: (path) => {
        changed = path
      },
    })
    await once(watcher, "ready")
    await new Promise((resolve) => setTimeout(resolve, 250))
    writeFileSync(join(root, "courses", "lua", "lessons", "01-demo", "README.md"), "# Демо\n\n## Теория\n\nНовое\n")
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("watcher timeout")), 10_000)
      const check = setInterval(() => {
        if (changed) {
          clearInterval(check)
          clearTimeout(timer)
          resolve()
        }
      }, 50)
    })
    expect(changed).toContain("README.md")
    await watcher.close()
  })
})
